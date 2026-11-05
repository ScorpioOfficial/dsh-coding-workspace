/**
 * Host half of the Python workspace bundle.
 *
 * The whole capability is one authenticated HTTP surface mounted on the Web
 * server the page already talks to. The Client half is a right-Sidebar tab, so
 * it has no Host Remote namespace of its own; a small JSON API keeps the plain
 * JavaScript bundle buildless:
 *
 *   GET  /python-workspace/api/env?root=<dir>        interpreter availability
 *   GET  /python-workspace/api/list?root=<dir>&path= one directory listing
 *   GET  /python-workspace/api/read?root=<dir>&path= one UTF-8 file
 *   POST /python-workspace/api/write                 { root, path, content }
 *   POST /python-workspace/api/run                   { root, path, interpreter }
 *   GET  /python-workspace/api/run?runId=            collected stdout/stderr
 *   POST /python-workspace/api/stop                  { runId }
 *   POST /python-workspace/api/input                 { runId, data } -> the process's stdin
 *   POST /python-workspace/api/pty                   { root, path, interpreter, cols, rows } -> a real PTY
 *   POST /python-workspace/api/shell                 { root, cols, rows } -> an interactive shell PTY
 *   POST /python-workspace/api/shell/run             { termId, root, path, interpreter } -> types the command
 *   GET  /python-workspace/api/pty?termId=&since=    terminal output since a cursor
 *   POST /python-workspace/api/pty/input             { termId, data }
 *   POST /python-workspace/api/pty/resize            { termId, cols, rows }
 *   POST /python-workspace/api/pty/close             { termId }
 *   POST /python-workspace/api/venv                  { root } -> creates .venv
 *
 * Every path is resolved against the folder the user picked and refused when it
 * escapes that folder. Requests are rejected unless they carry the page's own
 * authenticated browser peer, so another origin cannot drive the API.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'

/** Web route prefix owned by this plugin. */
export const ROUTE_PREFIX = '/python-workspace'
/** Hard dependency: without a Web server there is nothing to serve. */
export const inject = ['webServer']

const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_OUTPUT_CHARS = 400_000
const PTY_MAX_CHARS = 400_000
const IGNORED_NAMES = new Set(['node_modules', '.git', '__pycache__', '.DS_Store'])
const PY_FILE = /\.py$/i

/** Throw a status-coded error the route turns into JSON. */
function fail(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

/** Read and parse a JSON request body with a size bound. */
async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw fail(413, 'payload-too-large', 'request body is too large')
    chunks.push(chunk)
  }
  if (size === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw fail(400, 'bad-json', 'request body is not JSON')
  }
}

/** Answer one JSON value. */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

/**
 * Resolve `rel` under `root`, refusing anything that leaves it.
 * @param root - absolute folder the user opened.
 * @param rel - `''`-rooted relative path, `/`- or `\`-separated.
 * @returns the absolute target path.
 */
function resolveInside(root, rel) {
  if (typeof root !== 'string' || root.trim() === '') throw fail(400, 'root-required', 'root is required')
  const base = path.resolve(root)
  const target = path.resolve(base, rel ?? '.')
  const relative = path.relative(base, target)
  if (relative !== '' && (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative))) {
    throw fail(400, 'path-outside-root', 'path leaves the opened folder')
  }
  return target
}

/** Normalize a relative path for the wire: `/`-separated, no leading slash. */
function wirePath(root, abs) {
  return path.relative(path.resolve(root), abs).split(path.sep).join('/')
}

/** The interpreter candidate list for this platform. */
function interpreterCandidates() {
  const candidates = []
  const override = process.env.DSH_PYTHON
  if (override !== undefined && override !== '') candidates.push({ exe: override, args: [] })
  if (process.platform === 'win32') {
    candidates.push({ exe: 'python', args: [] }, { exe: 'py', args: ['-3'] }, { exe: 'python3', args: [] })
  } else {
    candidates.push({ exe: 'python3', args: [] }, { exe: 'python', args: [] })
  }
  return candidates
}

let systemPythonCache

/**
 * Discover a usable system interpreter once per plugin generation.
 * @returns the interpreter argv prefix, or `undefined` when none answers.
 */
function systemPython() {
  if (systemPythonCache !== undefined) return systemPythonCache
  systemPythonCache = null
  for (const candidate of interpreterCandidates()) {
    const probe = spawnSync(candidate.exe, [...candidate.args, '-c', 'import sys;print(sys.version_info[0])'], {
      encoding: 'utf8', timeout: 8000, windowsHide: true,
    })
    if (probe.status === 0 && String(probe.stdout).trim() === '3') {
      systemPythonCache = { exe: candidate.exe, args: candidate.args }
      return systemPythonCache
    }
  }
  return systemPythonCache
}

/** The `.venv` interpreter inside an opened folder, when it exists. */
function venvPython(root) {
  const base = path.resolve(root)
  const candidate = process.platform === 'win32'
    ? path.join(base, '.venv', 'Scripts', 'python.exe')
    : path.join(base, '.venv', 'bin', 'python')
  return existsSync(candidate) ? { exe: candidate, args: [] } : undefined
}

/**
 * Pick the interpreter argv prefix for one run.
 * @param root - the opened folder.
 * @param mode - `auto` prefers the venv, `venv` requires it, `system` ignores it.
 * @returns the interpreter argv prefix.
 */
function interpreterFor(root, mode) {
  if (mode === 'venv') {
    const found = venvPython(root)
    if (found === undefined) throw fail(400, 'venv-missing', 'this folder has no .venv yet')
    return found
  }
  if (mode === 'system') {
    const found = systemPython()
    if (found === null) throw fail(400, 'python-missing', 'no system Python 3 was found')
    return found
  }
  const venv = venvPython(root)
  if (venv !== undefined) return venv
  const system = systemPython()
  if (system === null) throw fail(400, 'python-missing', 'no system Python 3 was found')
  return system
}

/**
 * Turn one folder into entries for the tree.
 * @param root - the opened folder.
 * @param rel - the folder to list, relative to `root`.
 */
async function listDirectory(root, rel) {
  const abs = resolveInside(root, rel)
  const dirents = await fs.readdir(abs, { withFileTypes: true })
  const entries = []
  for (const dirent of dirents) {
    if (IGNORED_NAMES.has(dirent.name)) continue
    const entryAbs = path.join(abs, dirent.name)
    const isDirectory = dirent.isDirectory()
    entries.push({
      name: dirent.name,
      path: wirePath(root, entryAbs),
      dir: isDirectory,
      python: !isDirectory && PY_FILE.test(dirent.name),
    })
  }
  entries.sort((left, right) => Number(right.dir) - Number(left.dir) || left.name.localeCompare(right.name))
  return { path: wirePath(root, abs) || '', entries }
}

/** Read one UTF-8 file, refusing binary content. */
async function readFileText(root, rel) {
  const abs = resolveInside(root, rel)
  const stat = await fs.stat(abs)
  if (stat.isDirectory()) throw fail(400, 'is-directory', 'this path is a folder')
  if (stat.size > MAX_BODY_BYTES) throw fail(413, 'file-too-large', 'this file is too large to edit here')
  const bytes = await fs.readFile(abs)
  if (bytes.subarray(0, 8000).includes(0)) throw fail(415, 'binary-file', 'this file is not UTF-8 text')
  return { path: wirePath(root, abs), content: bytes.toString('utf8'), size: stat.size }
}

/** Create one managed run and start its process. */
function startRun(ctx, runs, request) {
  const root = request.root
  const fileAbs = resolveInside(root, request.path)
  if (!existsSync(fileAbs)) throw fail(400, 'file-missing', 'the file to run does not exist')
  const interpreter = interpreterFor(root, request.interpreter)
  const cwd = path.dirname(fileAbs)
  const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const record = { id: runId, output: '', exitCode: null, signal: null, running: true, error: null, startedAt: Date.now(), child: null }
  runs.set(runId, record)
  const child = spawn(interpreter.exe, [...interpreter.args, fileAbs], {
    cwd,
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  record.child = child
  const append = (chunk) => {
    if (record.output.length >= MAX_OUTPUT_CHARS) return
    record.output += chunk.toString('utf8')
    if (record.output.length > MAX_OUTPUT_CHARS) {
      record.output = `${record.output.slice(0, MAX_OUTPUT_CHARS)}\n… output truncated …\n`
    }
  }
  child.stdout.on('data', append)
  child.stderr.on('data', append)
  child.on('error', (error) => {
    record.running = false
    record.error = String(error.message ?? error)
  })
  child.on('close', (code, signal) => {
    record.running = false
    record.exitCode = code
    record.signal = signal
  })
  ctx.effect(() => () => { try { child.kill() } catch { /* already gone */ } }, `python-workspace.run(${runId})`)
  return { runId, interpreter: interpreter.exe, cwd }
}

/** Create `.venv` with the system interpreter, resolving with the captured log. */
async function createVenv(root) {
  const system = systemPython()
  if (system === null) throw fail(400, 'python-missing', 'no system Python 3 was found')
  const base = path.resolve(root)
  return await new Promise((resolve, reject) => {
    const child = spawn(system.exe, [...system.args, '-m', 'venv', '.venv'], { cwd: base, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    const append = (chunk) => { log += chunk.toString('utf8'); if (log.length > 20000) log = log.slice(-20000) }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.on('error', error => { reject(fail(500, 'venv-failed', String(error.message ?? error))) })
    child.on('close', (code) => {
      if (code === 0 && venvPython(base) !== undefined) resolve({ ok: true, python: venvPython(base).exe, log })
      else reject(fail(500, 'venv-failed', log.trim() || `python -m venv exited with ${code}`))
    })
  })
}

/** Clamp one numeric body field into a safe range. */
function clampInt(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/** Track one terminal handle: buffer its output and follow its exit. */
function trackPty(ctx, ptys, id, handle) {
  const record = { id, handle, output: '', offset: 0, running: true, exitCode: null, error: null, shell: undefined }
  if (typeof handle.output.setEncoding === 'function') handle.output.setEncoding('utf8')
  handle.output.on('data', (chunk) => {
    record.output += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    if (record.output.length > PTY_MAX_CHARS) {
      const drop = record.output.length - PTY_MAX_CHARS
      record.output = record.output.slice(drop)
      record.offset += drop
    }
  })
  handle.done.then((outcome) => {
    record.running = false
    record.exitCode = outcome.exitCode
  }).catch((error) => {
    record.running = false
    record.error = String(error?.message ?? error)
  })
  ptys.set(id, record)
  ctx.effect(() => () => { handle.terminate().catch(() => {}) }, `python-workspace.pty(${id})`)
  return record
}

/**
 * Build one command line in the syntax of the shell that will receive it.
 * @param shellPath - the shell executable's path.
 * @param argv - the words to run.
 * @returns the line, without its Enter.
 */
function shellCommand(shellPath, argv) {
  const name = path.basename(String(shellPath ?? '')).toLowerCase()
  const single = word => `'${String(word).replace(/'/g, "''")}'`
  const double = word => `"${word}"`
  if (name.startsWith('pwsh') || name.startsWith('powershell')) return `& ${argv.map(single).join(' ')}`
  if (name.startsWith('cmd')) return argv.map(double).join(' ')
  return argv.map(single).join(' ')
}

/** Resolve this host's interactive shell. */
async function shellFor(subprocess) {
  try {
    const environment = await subprocess.terminalEnvironment?.()
    if (environment?.defaultShell !== undefined) return environment.defaultShell
  } catch { /* fall back to the platform default */ }
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'cmd.exe'
  return process.env.SHELL ?? '/bin/bash'
}

/**
 * Start an interactive shell in the opened folder: the panel's real terminal.
 * @param ctx - Host context, read for the subprocess provider.
 * @param ptys - live terminal records by id.
 * @param request - `{ root, cols, rows }`.
 */
async function startShell(ctx, ptys, request) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined || typeof subprocess.spawnTerminal !== 'function') {
    throw fail(501, 'no-pty', 'this profile has no terminal provider')
  }
  const cwd = resolveInside(request.root, '')
  const shellPath = await shellFor(subprocess)
  const id = `pty-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const handle = await subprocess.spawnTerminal({
    argv: [shellPath],
    cwd,
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
    rows: clampInt(request.rows, 12, 80, 24),
    cols: clampInt(request.cols, 24, 300, 80),
    terminalType: 'xterm-256color',
    graceMs: 5000,
  })
  const record = trackPty(ctx, ptys, id, handle)
  record.shell = shellPath
  return { termId: id, shell: shellPath, cwd }
}

/**
 * Start a real terminal for one script: a PTY, so the program sees a console
 * (colors, `input()`, Ctrl+C) instead of a pipe.
 * @param ctx - Host context, read for the subprocess provider.
 * @param ptys - live terminal records by id.
 * @param request - `{ root, path, interpreter, cols, rows }`.
 */
async function startPty(ctx, ptys, request) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined || typeof subprocess.spawnTerminal !== 'function') {
    throw fail(501, 'no-pty', 'this profile has no terminal provider')
  }
  const fileAbs = resolveInside(request.root, request.path)
  if (!existsSync(fileAbs)) throw fail(400, 'file-missing', 'the file to run does not exist')
  const interpreter = interpreterFor(request.root, request.interpreter)
  const id = `pty-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const handle = await subprocess.spawnTerminal({
    argv: [interpreter.exe, ...interpreter.args, fileAbs],
    cwd: path.dirname(fileAbs),
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
    rows: clampInt(request.rows, 12, 80, 24),
    cols: clampInt(request.cols, 24, 300, 80),
    terminalType: 'xterm-256color',
    graceMs: 5000,
  })
  trackPty(ctx, ptys, id, handle)
  return {
    termId: id,
    command: `$ ${path.basename(interpreter.exe)} ${path.basename(fileAbs)}`,
    cwd: path.dirname(fileAbs),
  }
}

/**
 * Install the Host half: one guarded JSON route plus run lifetime.
 * @param ctx - Host context providing `webServer`.
 */
export function apply(ctx) {
  const connection = ctx.get('connection')
  const runs = new Map()
  const ptys = new Map()

  const route = async (req, res) => {
    try {
      if (connection !== undefined) {
        const rejection = connection.requestRejection(req)
        if (rejection !== undefined) {
          res.statusCode = rejection
          res.end()
          return
        }
      }
      const url = new URL(String(req.url), 'http://localhost')
      const suffix = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, '')
      const method = String(req.method ?? 'GET').toUpperCase()
      const query = url.searchParams

      if (method === 'GET' || method === 'HEAD') {
        if (suffix === 'api/env') {
          const root = query.get('root') ?? ''
          const venv = venvPython(root)
          const system = systemPython()
          sendJson(res, 200, {
            platform: process.platform,
            system: system === null ? null : system.exe,
            venv: venv === undefined ? null : venv.exe,
            root: path.resolve(root),
          })
          return
        }
        if (suffix === 'api/list') {
          const root = query.get('root') ?? ''
          sendJson(res, 200, { root: path.resolve(root), ...await listDirectory(root, query.get('path') ?? '') })
          return
        }
        if (suffix === 'api/read') {
          const root = query.get('root') ?? ''
          sendJson(res, 200, await readFileText(root, query.get('path') ?? ''))
          return
        }
        if (suffix === 'api/run') {
          const run = runs.get(query.get('runId') ?? '')
          if (run === undefined) throw fail(404, 'run-missing', 'that run is gone')
          sendJson(res, 200, { runId: run.id, output: run.output, running: run.running, exitCode: run.exitCode, signal: run.signal, error: run.error })
          return
        }
        if (suffix === 'api/pty') {
          const record = ptys.get(query.get('termId') ?? '')
          if (record === undefined) throw fail(404, 'pty-missing', 'that terminal is gone')
          const since = Number(query.get('since') ?? '0') || 0
          let data = ''
          let reset = false
          if (since < record.offset) {
            reset = true
            data = record.output
          } else {
            data = record.output.slice(since - record.offset)
          }
          sendJson(res, 200, {
            data,
            since: record.offset + record.output.length,
            reset,
            running: record.running,
            exitCode: record.exitCode,
            error: record.error,
          })
          return
        }
        throw fail(404, 'not-found', `no route ${method} ${url.pathname}`)
      }

      if (method !== 'POST') throw fail(405, 'method-not-allowed', `${method} is not allowed`)
      const body = await readJson(req)
      if (suffix === 'api/write') {
        const target = resolveInside(body.root, body.path)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, String(body.content ?? ''), 'utf8')
        sendJson(res, 200, { ok: true, path: wirePath(body.root, target), size: Buffer.byteLength(String(body.content ?? ''), 'utf8') })
        return
      }
      if (suffix === 'api/delete') {
        const rel = String(body.path ?? '')
        if (rel === '') throw fail(400, 'root-protected', 'the opened folder itself cannot be deleted')
        const target = resolveInside(body.root, rel)
        const info = await fs.stat(target).catch(() => undefined)
        if (info === undefined) throw fail(404, 'missing', 'that file or folder is gone')
        // A folder is only removed when the caller says so; a mistargeted delete
        // must never take a tree with it.
        if (info.isDirectory() && body.recursive !== true) {
          throw fail(400, 'recursive-required', 'deleting a folder needs recursive: true')
        }
        await fs.rm(target, { recursive: info.isDirectory(), force: false })
        sendJson(res, 200, { ok: true, path: wirePath(body.root, target), dir: info.isDirectory() })
        return
      }
      if (suffix === 'api/mkfile' || suffix === 'api/mkdir') {
        const asDirectory = suffix === 'api/mkdir'
        const target = resolveInside(body.root, body.path)
        if (path.basename(target) === '') throw fail(400, 'name-required', 'a name is required')
        try {
          if (asDirectory) await fs.mkdir(target)
          else await fs.writeFile(target, '', { flag: 'wx' })
        } catch (error) {
          if (error.code === 'EEXIST') throw fail(409, 'exists', 'a file or folder with that name already exists')
          throw error
        }
        sendJson(res, 200, { ok: true, path: wirePath(body.root, target), dir: asDirectory })
        return
      }
      if (suffix === 'api/run') {
        sendJson(res, 200, startRun(ctx, runs, body))
        return
      }
      if (suffix === 'api/shell') {
        sendJson(res, 200, await startShell(ctx, ptys, body))
        return
      }
      if (suffix === 'api/shell/run') {
        const record = ptys.get(body.termId ?? '')
        if (record === undefined) throw fail(404, 'pty-missing', 'that terminal is gone')
        if (!record.running) throw fail(409, 'pty-not-running', 'that terminal has finished')
        const fileAbs = resolveInside(body.root, body.path)
        if (!existsSync(fileAbs)) throw fail(400, 'file-missing', 'the file to run does not exist')
        const interpreter = interpreterFor(body.root, body.interpreter)
        const command = shellCommand(body.shell ?? record.shell, [interpreter.exe, ...interpreter.args, fileAbs])
        await record.handle.write(`${command}\r`)
        sendJson(res, 200, { ok: true, command })
        return
      }
      if (suffix === 'api/pty') {
        sendJson(res, 200, await startPty(ctx, ptys, body))
        return
      }
      if (suffix === 'api/pty/input') {
        const record = ptys.get(body.termId ?? '')
        if (record === undefined) throw fail(404, 'pty-missing', 'that terminal is gone')
        if (!record.running) throw fail(409, 'pty-not-running', 'that terminal has finished')
        await record.handle.write(String(body.data ?? ''))
        sendJson(res, 200, { ok: true })
        return
      }
      if (suffix === 'api/pty/resize') {
        const record = ptys.get(body.termId ?? '')
        if (record === undefined) throw fail(404, 'pty-missing', 'that terminal is gone')
        if (record.running) {
          await record.handle.resize(clampInt(body.cols, 24, 300, 80), clampInt(body.rows, 12, 80, 24))
        }
        sendJson(res, 200, { ok: true })
        return
      }
      if (suffix === 'api/pty/close') {
        const record = ptys.get(body.termId ?? '')
        if (record !== undefined) {
          ptys.delete(record.id)
          await record.handle.terminate().catch(() => {})
        }
        sendJson(res, 200, { ok: true })
        return
      }
      if (suffix === 'api/stop') {
        const run = runs.get(body.runId ?? '')
        if (run === undefined) throw fail(404, 'run-missing', 'that run is gone')
        try { run.child?.kill() } catch { /* already gone */ }
        sendJson(res, 200, { ok: true })
        return
      }
      if (suffix === 'api/input') {
        const run = runs.get(body.runId ?? '')
        if (run === undefined) throw fail(404, 'run-missing', 'that run is gone')
        if (!run.running || run.child?.stdin === null || run.child?.stdin === undefined) {
          throw fail(409, 'run-not-running', 'that run has already finished')
        }
        run.child.stdin.write(String(body.data ?? ''), 'utf8')
        sendJson(res, 200, { ok: true })
        return
      }
      if (suffix === 'api/venv') {
        sendJson(res, 200, await createVenv(body.root))
        return
      }
      throw fail(404, 'not-found', `no route ${method} ${url.pathname}`)
    } catch (error) {
      const status = typeof error.status === 'number' ? error.status : 500
      const code = typeof error.code === 'string' ? error.code : 'internal'
      sendJson(res, status, { code, message: String(error.message ?? error) })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: route }), 'python-workspace: JSON API')
  ctx.effect(() => () => {
    for (const run of runs.values()) { try { run.child?.kill() } catch { /* already gone */ } }
    runs.clear()
  }, 'python-workspace: run lifetime')
}

/** Testing seam: the pure helpers, used by the workspace harness only. */
export const __testing = { resolveInside, systemPython, venvPython, interpreterFor, listDirectory, readFileText }
