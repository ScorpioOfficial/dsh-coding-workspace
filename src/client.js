/**
 * Client half of the Python workspace bundle: a right-Sidebar tab type.
 *
 * Two registrations, exactly the shape the Sidebar documents for a page type:
 *   1. the type itself into `sidebarRightTabs` (its guide card opens it),
 *   2. the body into the keyed `sidebar.right.pane.tab` seat under the type id.
 * The body talks to the Host half over the plugin's own JSON route, so no
 * Harness Client package is imported and React comes from the browser module
 * table.
 */
window.__ModuleLoader__.load({
  id: '@local/python-workspace',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const TAB_ID = '@local/python-workspace'
    const TAB_KIND = 'pythonStudio'
    const NS = 'pythonStudio'
    const API = '/python-workspace/api'

    /** Copy for the panel; the panel owns every visible string. */
    const EN = {
      title: 'Python',
      entry: 'Python',
      entryHint: 'Open the Python workspace beside the chat',
      guideTitle: 'Python workspace',
      guideDescription: 'Open a folder, edit files, and run Python.',
      open: 'Open folder',
      follow: 'Session folder',
      newFile: '+ File',
      newFolder: '+ Folder',
      namePlaceholder: 'New name, then Enter',
      refresh: 'Refresh',
      pathPlaceholder: 'Paste a folder path…',
      empty: 'Pick a folder to start.',
      pickFile: 'Select a file to edit.',
      emptyFolder: 'Empty folder',
      loading: 'Loading…',
      save: 'Save',
      run: 'Run',
      stop: 'Stop',
      interpreter: 'Interpreter',
      auto: 'Auto',
      venv: 'Venv',
      system: 'System',
      createVenv: 'Create .venv',
      venvRunning: 'Creating .venv…',
      venvReady: '.venv ready',
      output: 'Output',
      stdinHint: 'Send a line to the running process (Enter)',
      clear: 'Clear',
      unsaved: 'Unsaved changes',
      running: 'Running…',
      exit: 'Exit',
      openFailed: 'Could not open the folder',
      noPython: 'not found',
    }
    const ZH = {
      title: 'Python',
      entry: 'Python',
      entryHint: '在对话右侧打开 Python 工作区',
      guideTitle: 'Python 工作区',
      guideDescription: '打开文件夹、编辑文件并运行 Python。',
      open: '打开目录',
      follow: '会话目录',
      newFile: '+ 文件',
      newFolder: '+ 目录',
      namePlaceholder: '输入名称后回车',
      refresh: '刷新',
      pathPlaceholder: '粘贴文件夹路径…',
      empty: '先选一个文件夹。',
      pickFile: '选择一个文件开始编辑。',
      emptyFolder: '空文件夹',
      loading: '加载中…',
      save: '保存',
      run: '运行',
      stop: '停止',
      interpreter: '解释器',
      auto: '自动',
      venv: '虚拟环境',
      system: '系统',
      createVenv: '创建 .venv',
      venvRunning: '正在创建 .venv…',
      venvReady: '.venv 已就绪',
      output: '输出',
      stdinHint: '给运行中的进程发一行（回车发送）',
      clear: '清空',
      unsaved: '有未保存的修改',
      running: '运行中…',
      exit: '退出码',
      openFailed: '无法打开该目录',
      noPython: '未找到',
    }

    /** A panel-scoped observable store: the module outlives any single tab. */
    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        get: () => state,
        set(patch) {
          state = { ...state, ...patch }
          for (const listener of listeners) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    }

    const token = name => `var(--dsw-alias-${name})`
    const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

    const styles = {
      root: {
        display: 'flex', flexDirection: 'column', height: '100%', flex: '1 1 auto', minHeight: 0, width: '100%',
        overflow: 'hidden', background: token('bg-base'), color: token('label-primary'), fontSize: 12, lineHeight: 1.45,
      },
      toolbar: {
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
        borderBottom: `1px solid ${token('border-l1')}`, flexWrap: 'wrap', flex: '0 0 auto',
      },
      main: { display: 'flex', flex: '1 1 auto', minHeight: 0 },
      treeColumn: {
        width: 176, flex: '0 0 auto', display: 'flex', flexDirection: 'column', minHeight: 0,
        borderRight: `1px solid ${token('border-l1')}`, background: token('bg-layer-1'),
      },
      tree: { flex: '1 1 auto', overflow: 'auto', padding: '4px 0', position: 'relative', minHeight: 0 },
      treeFoot: {
        display: 'flex', gap: 4, padding: 4, flex: '0 0 auto',
        borderTop: `1px solid ${token('border-l1')}`,
      },
      editorPane: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, minHeight: 0 },
      paneHead: {
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', flex: '0 0 auto',
        borderBottom: `1px solid ${token('border-l1')}`, background: token('bg-layer-2'),
      },
      editorWrap: { position: 'relative', flex: '1 1 auto', minHeight: 80, overflow: 'hidden', background: token('bg-base') },
      mirror: {
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, margin: 0, padding: 8,
        overflow: 'hidden', pointerEvents: 'none', whiteSpace: 'pre', boxSizing: 'border-box',
        fontFamily: mono, fontSize: 12, lineHeight: 1.5, tabSize: 4,
        color: token('label-primary'), background: 'transparent',
      },
      editorInput: {
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, margin: 0, padding: 8,
        border: 'none', outline: 'none', resize: 'none', overflow: 'auto', whiteSpace: 'pre',
        boxSizing: 'border-box', fontFamily: mono, fontSize: 12, lineHeight: 1.5, tabSize: 4,
        background: 'transparent', color: 'transparent', caretColor: token('label-primary'),
      },
      outputHead: {
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
        borderTop: `1px solid ${token('border-l1')}`, borderBottom: `1px solid ${token('border-l1')}`,
        background: token('bg-layer-2'), flex: '0 0 auto',
      },
      console: {
        flex: '0 0 36%', minHeight: 64, display: 'flex', flexDirection: 'column', minWidth: 0,
        background: token('bg-layer-2'),
      },
      consoleCommand: {
        flex: '0 0 auto', padding: '3px 8px', borderBottom: `1px solid ${token('border-l1')}`,
        color: token('label-tertiary'), fontFamily: mono, fontSize: 11.5,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      },
      termHost: { flex: '1 1 auto', minHeight: 0, overflow: 'hidden', padding: 4 },
      consoleBody: {
        flex: '1 1 auto', minHeight: 0, margin: 0, overflow: 'auto', padding: 8,
        background: 'transparent', color: token('label-secondary'), tabSize: 4,
        fontFamily: mono, fontSize: 11.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      },
      caret: {
        display: 'inline-block', width: 7, height: 13, marginLeft: 2, verticalAlign: 'text-bottom',
        background: token('label-secondary'),
      },
      stdinRow: {
        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', flex: '0 0 auto',
        borderTop: `1px solid ${token('border-l1')}`,
      },
      stdinPrompt: { color: token('label-tertiary'), fontFamily: mono, fontSize: 11.5 },
      stdinInput: {
        flex: '1 1 auto', minWidth: 0, height: 20, border: 'none', outline: 'none', background: 'transparent',
        color: token('label-primary'), fontFamily: mono, fontSize: 11.5,
      },
      echo: { color: token('label-tertiary'), fontFamily: mono },
      row: {
        display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
        cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden',
      },
      muted: { color: token('label-tertiary') },
      button: {
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px',
        borderRadius: 5, border: `1px solid ${token('border-l1')}`, background: token('bg-layer-1'),
        color: token('label-primary'), fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
      },
      primaryButton: {
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px',
        borderRadius: 5, border: '1px solid transparent', background: token('brand-primary'),
        color: '#ffffff', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
      },
      select: {
        height: 22, borderRadius: 5, border: `1px solid ${token('border-l1')}`, background: token('bg-layer-1'),
        color: token('label-primary'), fontSize: 11.5, fontFamily: 'inherit',
      },
      input: {
        height: 22, flex: '1 1 84px', minWidth: 84, borderRadius: 5, padding: '0 6px', boxSizing: 'border-box',
        border: `1px solid ${token('border-l1')}`, background: token('bg-layer-1'),
        color: token('label-primary'), fontSize: 11.5, fontFamily: 'inherit',
      },
      notice: { padding: '2px 8px 4px', fontSize: 11, color: token('state-error-primary') },
      entryButton: {
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px',
        borderRadius: 6, border: 'none', background: 'transparent',
        color: token('label-secondary'), fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      },
      entryStyle: '.pw-head-entry:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      runButton: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22,
        padding: 0, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer',
      },
    }

    /** One small button; a disabled one halves its opacity. */
    function Button(props) {
      const style = props.primary ? styles.primaryButton : styles.button
      return h('button', {
        type: 'button',
        title: props.title ?? props.label,
        onClick: props.onClick,
        disabled: props.disabled === true,
        style: { ...style, opacity: props.disabled === true ? 0.5 : 1 },
      }, props.label)
    }

    /**
     * The run control: a hollow green play arrow while idle, a solid red square
     * while a process is owned, and a click during that state stops it.
     */
    function RunButton(props) {
      const running = props.running === true
      return h('button', {
        type: 'button',
        className: 'pw-run',
        title: running ? props.stopLabel : props.runLabel,
        'aria-label': running ? props.stopLabel : props.runLabel,
        onClick: props.onClick,
        disabled: props.disabled === true,
        style: { ...styles.runButton, opacity: props.disabled === true ? 0.45 : 1 },
      },
      h('style', null, '.pw-run:not(:disabled):hover{background:var(--dsw-alias-bg-layer-2)}'),
      running
        ? h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true },
          h('rect', {
            x: 1.5, y: 1.5, width: 9, height: 9, rx: 1.5,
            fill: 'var(--dsw-alias-state-error-primary)',
          }))
        : h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true },
          h('path', {
            d: 'M4.1 2.4 11.2 7 4.1 11.6Z',
            fill: 'none',
            stroke: 'var(--dsw-alias-state-success-primary)',
            'stroke-width': 1.5,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          })))
    }

    /** Python words painted with the keyword color. */
    const PY_KEYWORDS = new Set(('False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield').split('|'))

    /** Python's two singletons plus `None`, painted as constants. */
    const PY_CONSTANTS = new Set(['True', 'False', 'None'])

    /** Common builtins and the receiver names, painted dimmer than keywords. */
    const PY_BUILTINS = new Set(('abs|all|any|bin|bool|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip|self|cls').split('|'))

    /** One pass over Python source: comment, string, number, decorator, word. */
    const PY_TOKEN = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[jJ]?)\b)|(@[\w.]+)|([A-Za-z_]\w*)/g

    /** Colors for the highlight layer: the host's own syntax palette, with
     *  theme-alias fallbacks. The shiki variables are the same ones the
     *  Conversation's code blocks use, so colors match the rest of the app and
     *  are never a washed-out accent. */
    const EDITOR_CSS = [
      '.pw-tok-comment{color:var(--shiki-token-comment,var(--dsw-alias-label-tertiary));font-style:italic}',
      '.pw-tok-string{color:var(--shiki-token-string,var(--dsw-alias-state-success-primary))}',
      '.pw-tok-number{color:var(--shiki-token-constant,var(--dsw-alias-state-warn-primary))}',
      '.pw-tok-constant{color:var(--shiki-token-constant,var(--dsw-alias-brand-primary))}',
      '.pw-tok-keyword{color:var(--shiki-token-keyword,var(--dsw-alias-brand-primary));font-weight:600}',
      '.pw-tok-decorator{color:var(--shiki-token-parameter,var(--dsw-alias-state-error-primary))}',
      '.pw-tok-parameter{color:var(--shiki-token-parameter,var(--dsw-alias-label-secondary))}',
      '.pw-tok-def{color:var(--shiki-token-function,var(--dsw-alias-label-primary));font-weight:600}',
      '.pw-tok-builtin{color:var(--shiki-token-function,var(--dsw-alias-label-secondary))}',
      '.pw-tok-call{color:var(--shiki-token-function,var(--dsw-alias-label-primary))}',
      '.pw-tok-type{color:var(--shiki-token-function,var(--dsw-alias-label-primary))}',
      '.pw-tok-namespace{color:var(--shiki-token-link,var(--dsw-alias-brand-primary))}',
      '.pw-tok-attribute{color:var(--shiki-token-parameter,var(--dsw-alias-label-secondary))}',
      '.pw-editor-input::placeholder{color:var(--dsw-alias-label-tertiary)}',
    ].join('')

    /**
     * The nearest non-space characters around one word.
     * @param source - the whole buffer.
     * @param index - word start offset.
     * @param length - word length.
     * @returns the character before and after, `''` when there is none.
     */
    function neighbour(source, index, length) {
      let before = ''
      for (let i = index - 1; i >= 0; i -= 1) {
        const ch = source[i]
        if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') { before = ch; break }
      }
      let after = ''
      for (let i = index + length; i < source.length; i += 1) {
        const ch = source[i]
        if (ch === ' ' || ch === '\t') continue
        after = ch
        break
      }
      return { before, after }
    }

    /**
     * Turn one file's text into highlighted spans.
     * @param source - the whole editor buffer.
     * @returns the nodes the mirror layer renders.
     */
    function highlightPython(source) {
      if (source === '') return ['']
      const out = []
      let last = 0
      let previousWord = ''
      let key = 0
      let match
      PY_TOKEN.lastIndex = 0
      while ((match = PY_TOKEN.exec(source)) !== null) {
        if (match.index > last) out.push(source.slice(last, match.index))
        const [text, comment, string, number, decorator, word] = match
        let cls = ''
        if (comment !== undefined) cls = 'pw-tok-comment'
        else if (string !== undefined) cls = 'pw-tok-string'
        else if (number !== undefined) cls = 'pw-tok-number'
        else if (decorator !== undefined) cls = 'pw-tok-decorator'
        else if (word !== undefined) {
          if (previousWord === 'def' || previousWord === 'class') cls = 'pw-tok-def'
          else if (PY_CONSTANTS.has(word)) cls = 'pw-tok-constant'
          else if (PY_KEYWORDS.has(word)) cls = 'pw-tok-keyword'
          else if (word === 'self' || word === 'cls') cls = 'pw-tok-parameter'
          else if (PY_BUILTINS.has(word)) cls = 'pw-tok-builtin'
          else {
            // Context decides what a plain identifier is: an imported name, an
            // object being dereferenced, an attribute, a called function, a type.
            const { before, after } = neighbour(source, match.index, text.length)
            if (previousWord === 'import' || previousWord === 'from') cls = 'pw-tok-namespace'
            else if (after === '.') cls = 'pw-tok-namespace'
            else if (before === '.') cls = 'pw-tok-attribute'
            else if (after === '(') cls = 'pw-tok-call'
            else if (word.charCodeAt(0) >= 65 && word.charCodeAt(0) <= 90) cls = 'pw-tok-type'
          }
        }
        out.push(cls === '' ? text : h('span', { key: key += 1, className: cls }, text))
        previousWord = word === undefined ? '' : word
        last = match.index + text.length
      }
      if (last < source.length) out.push(source.slice(last))
      return out
    }

    /** Console chrome: ANSI colors, a blinking caret, and the prompt line. */
    const CONSOLE_CSS = [
      '.ansi-red{color:var(--dsw-alias-state-error-primary)}',
      '.ansi-green{color:var(--dsw-alias-state-success-primary)}',
      '.ansi-yellow{color:var(--dsw-alias-state-warn-primary)}',
      '.ansi-blue{color:var(--shiki-token-link,var(--dsw-alias-brand-primary))}',
      '.ansi-magenta{color:var(--shiki-token-keyword,var(--dsw-alias-brand-primary))}',
      '.ansi-cyan{color:var(--shiki-token-function,var(--dsw-alias-brand-primary))}',
      '.ansi-white{color:var(--dsw-alias-label-primary)}',
      '.ansi-dim{color:var(--dsw-alias-label-tertiary)}',
      '.ansi-bold{font-weight:600}',
      '.pw-caret{animation:pw-blink 1.05s steps(1,end) infinite}',
      '@keyframes pw-blink{0%,49%{opacity:1}50%,100%{opacity:0}}',
    ].join('')

    /** SGR foreground codes mapped to the console's palette classes. */
    const ANSI_FG = {
      30: 'ansi-dim', 31: 'ansi-red', 32: 'ansi-green', 33: 'ansi-yellow', 34: 'ansi-blue',
      35: 'ansi-magenta', 36: 'ansi-cyan', 37: 'ansi-white', 90: 'ansi-dim',
      91: 'ansi-red', 92: 'ansi-green', 93: 'ansi-yellow', 94: 'ansi-blue',
      95: 'ansi-magenta', 96: 'ansi-cyan', 97: 'ansi-white',
    }

    /**
     * Apply one SGR sequence to the running style.
     * @param state - mutable style accumulator.
     * @param params - the sequence's parameter text.
     */
    function applySgr(state, params) {
      const codes = params === '' ? [0] : params.split(';').map(part => Number(part === '' ? '0' : part))
      for (const code of codes) {
        if (code === 0) { state.fg = ''; state.bold = false; state.dim = false }
        else if (code === 1) state.bold = true
        else if (code === 2) state.dim = true
        else if (code === 22) { state.bold = false; state.dim = false }
        else if (code === 39) state.fg = ''
        else if (ANSI_FG[code] !== undefined) state.fg = ANSI_FG[code]
      }
    }

    /**
     * Render console output as colored spans: SGR colors are kept, every other
     * control sequence is dropped so a program's escape codes never show up as
     * garbage.
     * @param text - the collected stdout/stderr text.
     * @returns the console's nodes.
     */
    function parseAnsi(text) {
      if (text === '') return ['']
      const out = []
      const state = { fg: '', bold: false, dim: false }
      let buffer = ''
      const flush = () => {
        if (buffer === '') return
        const className = [state.fg, state.bold ? 'ansi-bold' : '', state.dim ? 'ansi-dim' : ''].filter(Boolean).join(' ')
        out.push(className === '' ? buffer : h('span', { key: out.length, className }, buffer))
        buffer = ''
      }
      for (let index = 0; index < text.length; index += 1) {
        const ch = text[index]
        if (ch === '\x1b') {
          const rest = text.slice(index)
          const sgr = /^\x1b\[([0-9;]*)m/.exec(rest)
          if (sgr !== null) {
            flush()
            applySgr(state, sgr[1])
            index += sgr[0].length - 1
            continue
          }
          const other = /^\x1b\[[0-9;?]*[A-Za-z]/.exec(rest)
          if (other !== null) { index += other[0].length - 1; continue }
          index += 1
          continue
        }
        if (ch === '\r') continue
        buffer += ch
      }
      flush()
      return out
    }

    /**
     * The xterm classes the build parked on the window before this module ran.
     * @returns them, or a rejection when the bundle was built without them.
     */
    function loadXterm() {
      if (window.__PythonWorkspaceXterm !== undefined) return Promise.resolve(window.__PythonWorkspaceXterm)
      return Promise.reject(new Error('the bundled terminal is missing'))
    }

    /**
     * Terminal colors read from the host's own theme tokens.
     * @param element - element whose computed style carries the tokens.
     */
    function terminalTheme(element) {
      const computed = getComputedStyle(element)
      const read = (name, fallback) => computed.getPropertyValue(name).trim() || fallback
      return {
        background: read('--dsw-alias-bg-base', '#111318'),
        foreground: read('--dsw-alias-label-primary', '#e6e6e6'),
        cursor: read('--dsw-alias-label-primary', '#e6e6e6'),
        cursorAccent: read('--dsw-alias-bg-base', '#111318'),
        selectionBackground: read('--dsw-alias-bg-layer-2', '#334155'),
      }
    }

    /** The guide card's glyph. */    function PythonIcon(props) {
      const size = props?.size ?? 16
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: 'M3 7V4.5A1.5 1.5 0 0 1 4.5 3H8', fill: 'none', stroke: 'currentColor',
          'stroke-width': 1.4, 'stroke-linecap': 'round',
        }),
        h('path', {
          d: 'M5 10.5 7.5 8 5 5.5', fill: 'none', stroke: 'currentColor',
          'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M9 12h4', fill: 'none', stroke: 'currentColor',
          'stroke-width': 1.4, 'stroke-linecap': 'round',
        }))
    }

    /**
     * Install the Client half.
     * @param ctx - Client root Context with slots, locale and the right-Sidebar registry.
     */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'python-workspace: copy')

      const store = createStore({
        root: '',
        rootDraft: '',
        mode: 'session',
        sessionCwd: '',
        creating: null,
        draftName: '',
        tree: {},
        expanded: {},
        current: null,
        output: '',
        echoes: [],
        ptyId: null,
        fallback: false,
        command: '',
        running: false,
        runId: null,
        exitCode: null,
        interpreter: 'auto',
        env: null,
        notice: '',
        busy: '',
      })

      /** Call the Host half and surface its failure text. */
      async function api(pathname, init) {
        const response = await fetch(API + pathname, {
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          ...init,
        })
        const text = await response.text()
        let data = {}
        try { data = text === '' ? {} : JSON.parse(text) } catch { throw new Error(text.slice(0, 200) || response.statusText) }
        if (!response.ok) throw new Error(data.message ?? data.code ?? response.statusText)
        return data
      }

      /**
       * Load one folder of the tree, keeping the rest of the tree intact.
       * @param rel - folder path relative to the opened root.
       */
      async function loadDirectory(rel) {
        const root = store.get().root
        if (root === '') return
        const data = await api(`/list?root=${encodeURIComponent(root)}&path=${encodeURIComponent(rel)}`)
        store.set({ tree: { ...store.get().tree, [rel]: data.entries } })
      }

      /**
       * Open a folder: reset the tree and read its first level.
       * @param root - absolute folder path.
       * @param mode - `session` keeps following the Session's directory, `manual` pins this one.
       */
      async function openRoot(root, mode = 'manual') {
        if (typeof root !== 'string' || root.trim() === '') return
        const clean = root.trim()
        store.set({
          root: clean, rootDraft: clean, mode, tree: {}, expanded: {}, current: null,
          output: '', notice: '', runId: null, exitCode: null, running: false,
        })
        try {
          const env = await api(`/env?root=${encodeURIComponent(clean)}`)
          store.set({ env })
          await loadDirectory('')
        } catch (error) {
          store.set({ notice: `${t('openFailed')}: ${error.message}` })
        }
      }

      async function pickRoot() {
        try {
          const workspace = ctx.get('uiWorkspace')
          if (workspace === undefined) throw new Error('the workspace service is unavailable in this page')
          const picked = await workspace.pickDirectory()
          if (picked) await openRoot(picked)
        } catch (error) {
          store.set({ notice: String(error?.message ?? error) })
        }
      }

      async function toggleDirectory(entry) {
        const state = store.get()
        const expanded = { ...state.expanded }
        if (expanded[entry.path]) {
          delete expanded[entry.path]
          store.set({ expanded })
          return
        }
        expanded[entry.path] = true
        store.set({ expanded })
        if (state.tree[entry.path] === undefined) {
          try { await loadDirectory(entry.path) } catch (error) { store.set({ notice: error.message }) }
        }
      }

      async function openFile(entry) {
        try {
          const data = await api(`/read?root=${encodeURIComponent(store.get().root)}&path=${encodeURIComponent(entry.path)}`)
          store.set({ current: { path: data.path, content: data.content, saved: data.content }, notice: '' })
        } catch (error) {
          store.set({ notice: error.message })
        }
      }

      /**
       * Start an inline "new item" row at the top of one folder.
       * @param dir - folder path relative to the opened root, `''` for the root.
       * @param kind - file or folder.
       */
      function beginCreate(dir, kind) {
        const state = store.get()
        store.set({
          expanded: { ...state.expanded, [dir]: true },
          creating: { dir, kind },
          draftName: '',
          notice: '',
        })
        if (state.tree[dir] === undefined) {
          loadDirectory(dir).catch(error => store.set({ notice: error.message }))
        }
      }

      /** Drop the pending row without creating anything. */
      function cancelCreate() {
        store.set({ creating: null, draftName: '' })
      }

      /** Create the pending item, then reveal it (open a file, expand a folder). */
      async function commitCreate() {
        const { creating, draftName, root } = store.get()
        if (creating === null) return
        const name = draftName.trim()
        if (name === '') { cancelCreate(); return }
        const rel = creating.dir === '' ? name : `${creating.dir}/${name}`
        try {
          await api(creating.kind === 'file' ? '/mkfile' : '/mkdir', {
            method: 'POST',
            body: JSON.stringify({ root, path: rel }),
          })
          store.set({ creating: null, draftName: '' })
          await loadDirectory(creating.dir)
          if (creating.kind === 'folder') {
            store.set({ expanded: { ...store.get().expanded, [rel]: true } })
            await loadDirectory(rel)
          } else {
            await openFile({ path: rel })
          }
        } catch (error) {
          store.set({ notice: error.message })
        }
      }

      async function saveFile() {
        const { current, root } = store.get()
        if (current === null || current.content === current.saved) return
        try {
          await api('/write', { method: 'POST', body: JSON.stringify({ root, path: current.path, content: current.content }) })
          store.set({ current: { ...current, saved: current.content }, notice: '' })
        } catch (error) {
          store.set({ notice: error.message })
        }
      }

      async function runFile() {
        const state = store.get()
        const target = state.current
        if (target === null) return
        if (target.content !== target.saved) await saveFile()
        store.set({ output: '', echoes: [], exitCode: null, notice: '', running: true, runId: null, busy: t('running'), command: '' })
        try {
          const data = await api('/run', {
            method: 'POST',
            body: JSON.stringify({ root: state.root, path: target.path, interpreter: state.interpreter }),
          })
          const exe = String(data.interpreter ?? 'python').split(/[\\/]/).pop()
          store.set({ runId: data.runId, command: `$ ${exe} ${target.path}` })
        } catch (error) {
          store.set({ running: false, busy: '', notice: error.message })
        }
      }

      async function stopRun() {
        const { runId } = store.get()
        if (runId === null) return
        try { await api('/stop', { method: 'POST', body: JSON.stringify({ runId }) }) } catch { /* it may have finished already */ }
      }

      /**
       * Send one line to the running process's stdin, then echo it.
       * @param text - the line without its newline.
       */
      async function sendInput(text) {
        const { runId, running } = store.get()
        const line = String(text)
        if (!running || runId === null || line === '') return
        try {
          await api('/input', { method: 'POST', body: JSON.stringify({ runId, data: `${line}\n` }) })
          store.set({ echoes: [...store.get().echoes, line].slice(-100) })
        } catch (error) {
          store.set({ notice: error.message })
        }
      }

      async function createVenv() {
        const { root } = store.get()
        if (root === '') return
        store.set({ busy: t('venvRunning'), notice: '' })
        try {
          const data = await api('/venv', { method: 'POST', body: JSON.stringify({ root }) })
          store.set({ busy: '', env: { ...(store.get().env ?? {}), venv: data.python } })
        } catch (error) {
          store.set({ busy: '', notice: error.message })
        }
      }

      /**
       * Render one tree level, recursing into expanded folders.
       * @param nodes - loaded entries by folder path.
       * @param expanded - folders currently open.
       * @param activePath - the file shown in the editor.
       * @param rel - folder being rendered.
       * @param depth - indent level for this folder's entries.
       * @param out - accumulator of rows.
       * @param view - pending-creation state and the context-menu opener.
       */
      function renderTree(nodes, expanded, activePath, rel, depth, out, view) {
        const entries = nodes[rel]
        const { creating, draftName, onMenu } = view
        if (creating !== null && creating.dir === rel) {
          out.push(h('div', {
            key: `pw-creating:${rel}`,
            style: { ...styles.row, paddingLeft: 8 + depth * 12 },
          },
          h('span', { style: { ...styles.muted, width: 10, flex: '0 0 10px' } }, creating.kind === 'folder' ? '▸' : ''),
          h('input', {
            style: { ...styles.input, height: 18, fontSize: 11, flex: '1 1 auto', minWidth: 40 },
            value: draftName,
            autoFocus: true,
            placeholder: t('namePlaceholder'),
            spellCheck: false,
            onChange: event => store.set({ draftName: event.target.value }),
            onKeyDown: (event) => {
              if (event.key === 'Enter') { event.preventDefault(); void commitCreate() }
              else if (event.key === 'Escape') { event.preventDefault(); cancelCreate() }
            },
          })))
        }
        if (entries === undefined) return
        for (const entry of entries) {
          const open = expanded[entry.path] === true
          out.push(h('div', {
            key: entry.path,
            style: {
              ...styles.row,
              paddingLeft: 8 + depth * 12,
              background: activePath === entry.path ? token('bg-layer-2') : 'transparent',
            },
            title: entry.path,
            onClick: () => { void (entry.dir ? toggleDirectory(entry) : openFile(entry)) },
            onContextMenu: event => onMenu(event, entry.dir ? entry.path : (entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '')),
          },
          h('span', { style: { ...styles.muted, width: 10, flex: '0 0 10px' } }, entry.dir ? (open ? '▾' : '▸') : ''),
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, entry.name),
          entry.python ? h('span', { style: { ...styles.muted, marginLeft: 'auto', fontSize: 10 } }, 'py') : null))
          if (entry.dir && open) renderTree(nodes, expanded, activePath, entry.path, depth + 1, out, view)
        }
      }

      /** Header entry: one click opens the workspace beside the chat. */
      function HeaderEntry() {
        const open = (event) => {
          // Expand first: a collapsed column has no pane for the open to land in.
          if (!ctx.sidebarRight.isExpanded()) ctx.sidebarRight.toggleExpanded()
          const target = ctx.sidebarRight.commandTarget(event.currentTarget)
          if (target !== undefined) ctx.sidebarRight.openTabFromTarget(TAB_KIND, target)
        }
        return h(React.Fragment, null,
          h('style', null, styles.entryStyle),
          h('button', {
            type: 'button',
            className: 'pw-head-entry',
            title: t('entryHint'),
            'aria-label': t('entryHint'),
            onClick: open,
            style: styles.entryButton,
          },
          h(PythonIcon, { size: 14 }),
          h('span', null, t('entry'))))
      }

      /** The tab body: toolbar, file tree, editor, and run output. */
      function PythonWorkspace(props) {
        const [state, setState] = React.useState(store.get())
        const [draft, setDraft] = React.useState('')
        React.useEffect(() => store.subscribe(() => setState(store.get())), [])

        // The Session's own directory is the default root: it is the folder the
        // conversation works in, so the panel shows the same project.
        const readSessionCwd = props.useSessions
        const sessionCwd = readSessionCwd === undefined
          ? undefined
          : readSessionCwd(snapshot => snapshot.byId[props.sessionId]?.cwd)

        // Follow it until the user pins another folder, and re-follow when the
        // Session's directory changes underneath (workspace switch, new cwd).
        React.useEffect(() => {
          if (typeof sessionCwd !== 'string' || sessionCwd === '') return
          if (store.get().sessionCwd === sessionCwd && store.get().root === sessionCwd) return
          store.set({ sessionCwd })
          if (store.get().mode !== 'session' || store.get().root === sessionCwd) return
          void openRoot(sessionCwd, 'session')
        }, [sessionCwd])

        // Poll the owned run until it exits; remounting a hidden tab resumes it.
        React.useEffect(() => {
          if (!state.running || state.runId === null) return undefined
          let stopped = false
          const timer = setInterval(async () => {
            try {
              const data = await api(`/run?runId=${encodeURIComponent(state.runId)}`)
              if (stopped) return
              store.set({
                output: data.output,
                running: data.running,
                exitCode: data.exitCode,
                busy: data.running ? t('running') : '',
                notice: data.error ?? store.get().notice,
              })
            } catch (error) {
              if (stopped) return
              store.set({ running: false, busy: '', notice: error.message })
            }
          }, 400)
          return () => { stopped = true; clearInterval(timer) }
        }, [state.running, state.runId])

        // The tree's own context menu: creating items is the only way to add
        // something, and right-clicking is where a file tree puts it. The
        // browser menu is suppressed here on purpose; text fields keep theirs.
        const treeRef = React.useRef(null)
        const mirrorRef = React.useRef(null)
        const consoleRef = React.useRef(null)
        const termHostRef = React.useRef(null)
        const termRef = React.useRef(null)
        const fitRef = React.useRef(null)
        const ptyState = React.useRef({ id: null, since: 0, root: '', shell: '' })
        const shellTask = React.useRef(null)
        const [termReady, setTermReady] = React.useState(false)
        const [menu, setMenu] = React.useState(null)
        React.useEffect(() => {
          if (menu === null) return undefined
          const close = (event) => {
            if (event.target?.closest?.('[data-pw-menu]') !== null) return
            setMenu(null)
          }
          const onKey = (event) => { if (event.key === 'Escape') setMenu(null) }
          document.addEventListener('pointerdown', close)
          document.addEventListener('keydown', onKey)
          return () => {
            document.removeEventListener('pointerdown', close)
            document.removeEventListener('keydown', onKey)
          }
        }, [menu])

        // Keep the console pinned to the newest line, like a real terminal.
        React.useEffect(() => {
          const view = consoleRef.current
          if (view === null) return
          view.scrollTop = view.scrollHeight
        }, [state.output])

        // One xterm instance for this panel; the PTY is what it talks to.
        React.useEffect(() => {
          let disposed = false
          loadXterm().then(({ Terminal, FitAddon, css }) => {
            if (disposed) return
            const host = termHostRef.current
            if (host === null) return
            if (document.querySelector('style[data-pw-xterm]') === null) {
              const tag = document.createElement('style')
              tag.dataset.pwXterm = 'true'
              tag.textContent = css
              document.head.appendChild(tag)
            }
            const terminal = new Terminal({
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 12,
              lineHeight: 1.3,
              cursorBlink: true,
              scrollback: 5000,
              theme: terminalTheme(host),
            })
            const fit = new FitAddon()
            terminal.loadAddon(fit)
            terminal.open(host)
            termRef.current = terminal
            fitRef.current = fit
            terminal.onData((data) => {
              // A device-attributes reply belongs to a full-screen app; an
              // interactive Windows shell would echo it as typed text instead.
              if (/^\x1b\[\?[0-9;]*c$/.test(data)) return
              const id = ptyState.current.id
              if (id === null) return
              void api('/pty/input', { method: 'POST', body: JSON.stringify({ termId: id, data }) }).catch(() => {})
            })
            try { fit.fit() } catch { /* the pane may not be laid out yet */ }
            const observer = new ResizeObserver(() => {
              try { fit.fit() } catch { return }
              const id = ptyState.current.id
              if (id === null) return
              void api('/pty/resize', {
                method: 'POST',
                body: JSON.stringify({ termId: id, cols: terminal.cols, rows: terminal.rows }),
              }).catch(() => {})
            })
            observer.observe(host)
            setTermReady(true)
          }).catch((error) => {
            store.set({ notice: `terminal: ${error.message}` })
          })
          return () => {
            disposed = true
            if (termRef.current !== null) { termRef.current.dispose(); termRef.current = null }
          }
        }, [])

        // Poll the run's PTY and paint its bytes into the terminal. Exactly one
        // request is in flight at a time: overlapping reads would both start
        // from the same cursor and paint the same bytes twice.
        React.useEffect(() => {
          if (state.ptyId === null) return undefined
          let stopped = false
          let timer = null
          termRef.current?.reset()
          const tick = async () => {
            try {
              const data = await api(`/pty?termId=${encodeURIComponent(state.ptyId)}&since=${ptyState.current.since}`)
              if (stopped) return
              ptyState.current.since = data.since
              if (data.reset) termRef.current?.reset()
              if (data.data !== '') termRef.current?.write(data.data)
              if (!data.running) {
                store.set({ running: false, busy: '', exitCode: data.exitCode, ptyId: null, notice: data.error ?? '' })
                return
              }
            } catch (error) {
              if (!stopped) store.set({ running: false, busy: '', ptyId: null, notice: error.message })
              return
            }
            if (!stopped) timer = setTimeout(() => { void tick() }, 120)
          }
          void tick()
          return () => { stopped = true; if (timer !== null) clearTimeout(timer) }
        }, [state.ptyId])

        // Keep one shell alive per folder: the terminal is usable before the
        // first Run, exactly like an integrated terminal.
        React.useEffect(() => {
          if (!termReady || state.fallback || state.root === '') return
          void ensureShell().catch((error) => store.set({ fallback: true, notice: error.message }))
        }, [termReady, state.root, state.fallback])

        /**
         * Ensure the panel's interactive shell exists for the current folder.
         * Concurrent callers share one in-flight start, so a panel can never
         * end up with two shells fighting over the same screen.
         * @returns its terminal id, or `null` before the terminal is ready.
         */
        function ensureShell() {
          if (shellTask.current !== null) return shellTask.current
          const task = (async () => {
            const snapshot = store.get()
            const terminal = termRef.current
            if (terminal === null || snapshot.root === '') return null
            const current = ptyState.current
            if (current.id !== null && current.root === snapshot.root) return current.id
            if (current.id !== null) {
              try { await api('/pty/close', { method: 'POST', body: JSON.stringify({ termId: current.id }) }) } catch { /* already gone */ }
              ptyState.current = { id: null, since: 0, root: '', shell: '' }
              store.set({ ptyId: null })
            }
            try { fitRef.current?.fit() } catch { /* the pane may be hidden */ }
            const data = await api('/shell', {
              method: 'POST',
              body: JSON.stringify({ root: snapshot.root, cols: terminal.cols, rows: terminal.rows }),
            })
            ptyState.current = { id: data.termId, since: 0, root: snapshot.root, shell: data.shell }
            store.set({ ptyId: data.termId, command: data.cwd, fallback: false })
            return data.termId
          })()
          shellTask.current = task
          task.then(() => {}, () => {}).finally(() => { if (shellTask.current === task) shellTask.current = null })
          return task
        }

        /** Run the open file by typing its command into the shell. */
        async function startTerminalRun() {
          const snapshot = store.get()
          const target = snapshot.current
          if (target === null) return
          if (target.content !== target.saved) await saveFile()
          if (termRef.current === null) { await runFile(); return }
          try {
            const termId = await ensureShell()
            if (termId === null) { await runFile(); return }
            termRef.current.focus()
            const data = await api('/shell/run', {
              method: 'POST',
              body: JSON.stringify({
                termId,
                shell: ptyState.current.shell,
                root: snapshot.root,
                path: target.path,
                interpreter: snapshot.interpreter,
              }),
            })
            store.set({ command: data.command, notice: '' })
          } catch (error) {
            // No terminal provider (or an older Host half): fall back to the
            // pipe-based console so running still works.
            store.set({ fallback: true, notice: error.message })
            await runFile()
          }
        }

        /** Close the terminal's shell, or stop the fallback run. */
        async function stopTerminalRun() {
          const id = ptyState.current.id
          if (id === null) { await stopRun(); return }
          ptyState.current = { id: null, since: 0, root: '', shell: '' }
          store.set({ ptyId: null, running: false, busy: '' })
          try { await api('/pty/close', { method: 'POST', body: JSON.stringify({ termId: id }) }) } catch { /* gone */ }
        }
        const openMenu = (event, dir) => {
          if (event.target?.closest?.('input,textarea') !== null) return
          event.preventDefault()
          event.stopPropagation()
          const rect = treeRef.current?.getBoundingClientRect()
          if (rect === undefined) return
          setMenu({
            x: Math.max(0, Math.min(rect.width - 152, event.clientX - rect.left)),
            y: Math.max(0, Math.min(rect.height - 96, event.clientY - rect.top)),
            dir,
          })
        }
        const menuItem = (label, onClick) => h('button', {
          type: 'button',
          key: label,
          className: 'pw-menu-item',
          onClick,
          style: {
            display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', border: 'none',
            background: 'transparent', color: token('label-primary'), fontSize: 12, cursor: 'pointer',
            borderRadius: 4, fontFamily: 'inherit',
          },
        }, label)

        const treeRows = []
        renderTree(state.tree, state.expanded, state.current === null ? '' : state.current.path, '', 0, treeRows, {
          creating: state.creating,
          draftName: state.draftName,
          onMenu: openMenu,
        })
        const current = state.current
        const dirty = current !== null && current.content !== current.saved
        const treeBody = state.root === ''
          ? h('div', { style: { ...styles.muted, padding: 8 } }, t('empty'))
          : state.tree[''] === undefined
            ? h('div', { style: { ...styles.muted, padding: 8 } }, state.busy !== '' ? state.busy : t('loading'))
            : treeRows.length === 0
              ? h('div', { style: { ...styles.muted, padding: 8 } }, t('emptyFolder'))
              : treeRows

        return h('div', { style: styles.root },
          h('div', { style: styles.toolbar },
            h(Button, { label: t('open'), onClick: () => { void pickRoot() } }),
            state.mode === 'manual' && state.sessionCwd !== ''
              ? h(Button, {
                label: `↺ ${t('follow')}`,
                title: state.sessionCwd,
                onClick: () => { void openRoot(state.sessionCwd, 'session') },
              })
              : null,
            h('input', {
              style: styles.input,
              value: state.rootDraft,
              placeholder: t('pathPlaceholder'),
              spellCheck: false,
              onChange: event => store.set({ rootDraft: event.target.value }),
              onKeyDown: event => { if (event.key === 'Enter') void openRoot(event.currentTarget.value) },
            }),
            h('select', {
              style: styles.select,
              value: state.interpreter,
              title: t('interpreter'),
              onChange: event => store.set({ interpreter: event.target.value }),
            },
            h('option', { value: 'auto' }, state.env?.venv ? `${t('auto')} (${t('venv')})` : t('auto')),
            h('option', { value: 'venv' }, t('venv')),
            h('option', { value: 'system' }, `${t('system')}${state.env?.system ? '' : ` (${t('noPython')})`}`)),
            h(Button, {
              label: dirty ? `${t('save')} •` : t('save'),
              onClick: () => { void saveFile() },
              disabled: !dirty,
            }),
            h(RunButton, {
              running: state.running,
              disabled: current === null,
              runLabel: t('run'),
              stopLabel: t('stop'),
              onClick: () => { void (state.running ? stopTerminalRun() : startTerminalRun()) },
            }),
            h(Button, {
              label: state.env?.venv ? t('venvReady') : t('createVenv'),
              onClick: () => { void createVenv() },
              disabled: state.root === '' || state.busy !== '' || Boolean(state.env?.venv),
              title: state.env?.venv ?? t('createVenv'),
            })),
          state.notice !== '' ? h('div', { style: styles.notice }, state.notice) : null,
          h('div', { style: styles.main },
            h('div', { style: styles.treeColumn },
              h('div', {
                ref: treeRef,
                style: styles.tree,
                onContextMenu: event => openMenu(event, ''),
              },
              treeBody,
              menu === null ? null : h('div', {
                'data-pw-menu': 'true',
                style: {
                  position: 'absolute', left: menu.x, top: menu.y, zIndex: 30, minWidth: 148, padding: 4,
                  background: token('bg-overlay'), border: `1px solid ${token('border-l1')}`, borderRadius: 6,
                  boxShadow: '0 6px 20px rgba(0,0,0,.28)',
                },
              },
              h('style', null, '.pw-menu-item:hover{background:var(--dsw-alias-bg-layer-2)}'),
              menuItem(t('newFile'), () => { beginCreate(menu.dir, 'file'); setMenu(null) }),
              menuItem(t('newFolder'), () => { beginCreate(menu.dir, 'folder'); setMenu(null) }),
              menuItem(t('refresh'), () => {
                loadDirectory(menu.dir).catch(error => store.set({ notice: error.message }))
                setMenu(null)
              }))),
              h('div', { style: styles.treeFoot },
                h(Button, { label: t('newFile'), onClick: () => beginCreate('', 'file'), disabled: state.root === '' }),
                h(Button, { label: t('newFolder'), onClick: () => beginCreate('', 'folder'), disabled: state.root === '' }))),
            h('div', { style: styles.editorPane },
              h('div', { style: styles.paneHead },
                h('span', {
                  style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                  title: current?.path,
                }, current === null ? t('title') : current.path),
                h('span', { style: styles.muted }, dirty ? t('unsaved') : '')),
              h('div', { style: styles.editorWrap },
                h('style', null, EDITOR_CSS),
                h('pre', { ref: mirrorRef, style: styles.mirror, 'aria-hidden': true },
                  h('code', { style: { font: 'inherit', color: 'inherit' } },
                    highlightPython(current === null ? '' : current.content))),
                h('textarea', {
                  className: 'pw-editor-input',
                  style: styles.editorInput,
                  value: current === null ? '' : current.content,
                  spellCheck: false,
                  wrap: 'off',
                  autoCapitalize: 'off',
                  autoCorrect: 'off',
                  disabled: current === null,
                  placeholder: state.root === '' ? t('empty') : t('pickFile'),
                  onChange: event => {
                    const next = store.get().current
                    if (next === null) return
                    store.set({ current: { ...next, content: event.target.value } })
                  },
                  onScroll: event => {
                    const mirror = mirrorRef.current
                    if (mirror === null) return
                    mirror.scrollTop = event.currentTarget.scrollTop
                    mirror.scrollLeft = event.currentTarget.scrollLeft
                  },
                  onKeyDown: event => {
                    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                      event.preventDefault()
                      void saveFile()
                      return
                    }
                    if (event.key === 'Tab' && !event.shiftKey) {
                      event.preventDefault()
                      const field = event.currentTarget
                      const start = field.selectionStart
                      const end = field.selectionEnd
                      const next = store.get().current
                      if (next === null) return
                      store.set({ current: { ...next, content: `${next.content.slice(0, start)}    ${next.content.slice(end)}` } })
                      requestAnimationFrame(() => { field.selectionStart = field.selectionEnd = start + 4 })
                    }
                  },
                })),
              h('div', { style: styles.outputHead },
                h('span', { style: { flex: '1 1 auto' } }, t('output')),
                state.running ? h('span', { style: styles.muted }, t('running')) : null,
                state.exitCode !== null && state.exitCode !== undefined
                  ? h('span', {
                    style: {
                      ...styles.muted,
                      color: state.exitCode === 0 ? token('state-success-primary') : token('state-error-primary'),
                    },
                  }, `${t('exit')} ${state.exitCode}`)
                  : null,
                h(Button, { label: t('clear'), onClick: () => store.set({ output: '', echoes: [], exitCode: null, command: '' }) })),
              h('div', { style: styles.console },
                h('style', null, CONSOLE_CSS),
                state.command === '' ? null : h('div', { style: styles.consoleCommand, title: state.command }, state.command),
                h('div', { ref: termHostRef, style: { ...styles.termHost, display: termReady && !state.fallback ? 'block' : 'none' } }),
                termReady && !state.fallback ? null : h('pre', { ref: consoleRef, style: styles.consoleBody },
                  parseAnsi(state.output),
                  state.echoes.map((line, index) => h('div', { key: `echo-${index}`, style: styles.echo }, `› ${line}`)),
                  state.running ? h('span', { key: 'caret', className: 'pw-caret', style: styles.caret }) : null),
                (termReady && !state.fallback) || !state.running
                  ? null
                  : h('div', { style: styles.stdinRow },
                    h('span', { style: styles.stdinPrompt }, '›'),
                    h('input', {
                      style: styles.stdinInput,
                      value: draft,
                      spellCheck: false,
                      placeholder: t('stdinHint'),
                      onChange: event => setDraft(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        const line = event.currentTarget.value
                        setDraft('')
                        void sendInput(line)
                      },
                    }))))))
      }

      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        title: () => t('title'),
        guide: [{
          id: 'open',
          order: 40,
          title: () => t('guideTitle'),
          description: () => t('guideDescription'),
          icon: PythonIcon,
        }],
      }), 'python-workspace: tab type')

      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
        { name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS },
        PythonWorkspace,
      )), 'python-workspace: tab body')

      ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'python-workspace-open',
        order: -20,
        locale: NS,
      }, HeaderEntry)), 'python-workspace: header entry')
    }

    return {
      inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'],
      apply,
    }
  },
})
