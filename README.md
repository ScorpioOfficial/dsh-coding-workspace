# Python 工作区插件（@local/python-workspace）

一个装在 DSH Web 页面右侧栏的 Python 工作区：选一个目录 → 浏览文件树 → 编辑 `.py` → 用「系统 Python」或该目录下的 `.venv` 运行，输出显示在下方。

本文件是这次实现的说明书；照着它可以从零复刻，也可以据此改。

---

## 1. 结果

- 位置：右侧边栏 → 「开始 / Start」标签页 → 「Python 工作区」卡片（打开后是一个 tab）
- 能力：
  - **默认跟随当前会话的工作目录**（= 会话所在工作区的路径）；点「打开目录」换成别的目录后固定为手动模式，工具栏出现「↺ 会话目录」可一键回到跟随
  - 打开目录（原生文件夹选择框，或直接粘贴路径回车）
  - 文件树逐级展开，`.py` 文件带 `py` 标记
  - 文本编辑（textarea + Ctrl/Cmd+S 保存）
  - 解释器三选一：自动（有 `.venv` 就用它）/ 虚拟环境 / 系统
  - 一键 `python -m venv .venv`
  - 运行当前文件，轮询拿回 stdout+stderr 与退出码，可停止

## 2. 结构：一个 bundle，两半

```
python-workspace-plugin/
├─ package.json         # bundle 清单 + dsh.bundle.patch + dsh.client + 构建依赖
├─ cordis.patch.yml     # 往 profile 里插入一行插件
├─ index.js             # Host 半：文件 API、管道运行、真终端（PTY）
├─ src/client.js        # Client 半源码（xterm 终端 / 文件树 / 编辑器 / 高亮）
├─ client.js            # 构建产物 = xterm 打包 + src/client.js（勿手改）
├─ tools/xterm-entry.js # 唯一 import xterm 的地方
├─ tools/build-client.mjs
├─ icon.svg             # 插件图标（Plugin Manager 显示）
└─ locale/{en,zh}.json  # 插件标题与描述
```

Host 半和 Client 半是两个独立加载的产物：

- Host：`index.js` 在 DSH 主进程里跑，`export function apply(ctx)`，能拿 `ctx.webServer`、`node:fs`、`node:child_process`。
- Client：`client.js` 在浏览器里跑，格式是 `window.__ModuleLoader__.load({ id, factory(require) { ... return { inject, apply } } })`，React 从 `require('react')` 拿，不能 import 任何 `@deepseek-ai/dsh-client-*` 包。

两者之间没有 Remote 命名空间（那需要 typert 生成代码），所以走插件自己的 HTTP 路由——这是无构建的纯 JS 插件最省事的通道。

## 3. 为什么是「右侧栏 tab」而不是别的插槽

`cordis_inspect_query`（Client / Slots）显示右侧栏其实是一个 tab 系统：

- `rightbar` → `rightbar.session` → 两个座位：
  - `sidebar.right.pane.tab`（keyed，按 tab 类型的 `id` 分发内容）
  - `sidebar.right.pane.tab.title`（可选，tab 标题）
- tab 类型本身注册在 Client 服务 `ctx.sidebarRightTabs` 上（`id`/`kind`/`title`/`guide`）。

这正是 VS Code 编辑器组的模型：**先注册类型，再注册该类型的内容渲染器**，两者用同一个 `id` 对上。所以插件只做三件事：

```js
ctx.sidebarRightTabs.register({ id, kind, title, guide: [card] })   // 类型 + 启动页卡片
ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id }, Body) // 内容
```

`guide` 卡片就是「开始」页里那个可点的方块；点它，右侧栏用 `openTab(kind)` 打开 tab。

## 4. 逐步复刻

### 第 1 步：建 bundle 骨架

`package.json` 三段缺一不可：

```json
"exports": { ".": "./index.js", "./client": "./client.js", "./locale/*.json": "./locale/*.json", "./icon": "./icon.svg" },
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "immediately": true, "inject": ["@deepseek-ai/dsh-client-ui-sidebar-right", "@deepseek-ai/dsh-client-ui-workspace"] }
}
```

- `dsh.bundle.patch`：让这个包成为一个 bundle。
- `dsh.client`：声明它还有浏览器产物；`immediately` 表示页面启动就加载（不然要等有人打开才加载，插槽就晚了）。
- `dsh.client.inject`：只排加载顺序，不产生服务依赖。

`cordis.patch.yml` 只有一行插入：

```yaml
- insert:
    - id: python-workspace
      name: '@local/python-workspace'
```

### 第 2 步：Host 半——一个带鉴权的 JSON 路由

`ctx.webServer.register({ kind: 'prefix', path: '/python-workspace', handler })`，handler 是原始 Node `(req, res)`，所以：

- GET 走查询参数，POST 走 JSON body；
- 每个请求先做 `ctx.get('connection').requestRejection(req)`：校验 Host/Origin 并检查页面自己的登录 Cookie，非本页来源直接 401/403（否则任何网页都能通过 `127.0.0.1` 写你的文件）；
- 所有相对路径都经 `resolveInside(root, rel)` 解析，逃出所选目录直接 400。

路由清单见 `index.js` 顶部注释。要点：

- **列目录**：`fs.readdir(..., { withFileTypes: true })`，目录优先排序，跳过 `node_modules/.git/__pycache__`。
- **读文件**：>8MB 或前 8KB 含 NUL 字节（二进制）就拒绝。
- **写文件**：`mkdir -p` + `writeFile`。
- **解释器**：`systemPython()` 依次探测 `python` / `py -3` / `python3`（`spawnSync` 验证 `sys.version_info[0] === 3`，结果缓存）；`venvPython(root)` 看 `.venv/Scripts/python.exe`（Windows）或 `.venv/bin/python`。
- **运行**：`spawn(python, [file], { cwd: 文件所在目录, env: { PYTHONUNBUFFERED: '1' } })`，stdout/stderr 追加进 `runs` Map 里的缓冲区（上限 40 万字符），客户端轮询 `/api/run?runId=` 拿增量快照。
- **建 venv**：`python -m venv .venv`，把日志一起返回。
- 所有子进程都在 `ctx.effect` 里挂清理，插件卸载时整批 kill。

### 第 3 步：Client 半——注册 tab 类型与内容

```js
window.__ModuleLoader__.load({
  id: '@local/python-workspace',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    function apply(ctx) { /* 注册 */ }
    return { inject: ['slots', 'locale', 'sidebarRightTabs'], apply }
  },
})
```

- `inject` 里写**服务名**：`sidebarRightTabs` 不 ready 时模块保持 pending，等它出现再 apply。
- 文案走 `ctx.locale.register(NS, { en, zh })` + `ctx.locale.bind(NS)`。
- 样式全部用主题 token：`var(--dsw-alias-bg-base)`、`--dsw-alias-border-l1`、`--dsw-alias-label-primary`、`--dsw-alias-brand-primary`、`--dsw-alias-state-success-primary`…… 不写死颜色，浅色/深色都跟主题走。
- 面板状态放在模块级 store（`createStore`）里，所以关掉 tab 再打开，目录、打开的文件、输出都还在。
- 运行中的轮询用 `useEffect` 挂在 `[running, runId]` 上，卸载/结束自动清定时器；关掉 tab 再打开会接着轮询同一个 run。
- 「打开目录」调 `ctx.get('uiWorkspace').pickDirectory()`——那是 DSH 自己的原生目录选择框，返回 Host 绝对路径。

### 第 4 步：先离线验证 Host 半

`.python-workspace-check/host-check.mjs` 用假 `ctx`/假 `req`/`res` 把 `apply` 挂起来，直接打路由：列目录、读、写、越权路径、系统 Python、运行、失败退出码、建 venv 并在 venv 里跑、未鉴权请求 401。

```powershell
node ..\.python-workspace-check\host-check.mjs <一个临时目录>
```

（子进程管道捕获在 workspace 沙箱下会 EPERM，需要完整权限跑。）

### 第 5 步：安装并确认真的活了

`plugin_manager install_bundle` 指向这个目录即可（它会做 pnpm 链接、写入 profile bundle 列表）。判断「活没活」只看返回值：

- `application: applied`：Host 行已生效；
- 再用 `cordis_inspect_query`（Client / Slots，root=`sidebar.right.pane.tab`）确认 occupant 里有 `@local/python-workspace` 且 `active: true`——这说明浏览器里的模块真的加载并注册成功了；
- 用 `curl` 打 `http://127.0.0.1:3080/python-workspace/api/env` 得 401，说明路由已挂上且鉴权生效。

### 第 6 步：改与卸载

- 改 `client.js` → 刷新页面即可（如果只是这一次安装后的改动，刷新也会带上新文件）。
- 改 `index.js` → 需要重载 Host 半：重启 `dsh` 或让我重载插件行。
- 卸载：`plugin_manager remove_bundle`，target 用 `@local/python-workspace`。

## 5. 已知边界

- 编辑器是受控 `<textarea>`，不是 Monaco：没有语法高亮、补全、多文件标签。要这些能力需要引入构建产物（`dsh.client.external` 声明依赖，用部署的 Client 构建工具打包），不再是纯 JS 单文件。
- 只按「文件」运行，不支持调试、REPL、notebook。
- 目录选择依赖 `uiWorkspace.pickDirectory()`，在无原生选择框的环境里仍可手动粘贴路径。
- Host 路由只绑定在 DSH 自己的监听地址上，且逐个请求鉴权；不要把它改成无鉴权的公开端口。

## 6. 构建与生效规则

```powershell
node tools/build-client.mjs   # 重新打包 client.js（xterm + src/client.js）
```

- **改 `src/client.js` 之后必须跑一次构建**；`client.js` 是产物，手改会被覆盖。
- 打包需要 esbuild 子进程，在 DSH 的 workspace 沙箱下会 EPERM，需要完整权限或在工作区外执行。
- **Client 半热更**：`client.js` 一变，宿主就会重新构建并提供新版本，刷新页面即可。
- **Host 半不热更**：`hmr.root` 是空数组，`index.js` 的改动要**重启一次 dsh** 才生效（会话本身会保留）。
- 构建依赖：`esbuild`、`@esbuild/win32-x64`、`@xterm/xterm`、`@xterm/addon-fit`，装在本包自己的 `node_modules` 里，不进 profile。

## 7. 代码在哪 / 搬到自己的仓库 / 明天继续

插件源码就在这个目录：

```
C:\Users\Administrator\Documents\deepseek-harness\default-workspace\python-workspace-plugin
```

要提交的（12 个文件，约 550 KB）：

| 文件 | 说明 |
|---|---|
| `package.json`、`cordis.patch.yml` | bundle 清单与插入行 |
| `index.js` | Host 半（文件 API、运行、venv、PTY、shell） |
| `src/client.js` | Client 半**源码**（改这个） |
| `client.js` | 构建产物（提交它，别人不用装 esbuild 也能直接用） |
| `tools/xterm-entry.js`、`tools/build-client.mjs` | 打包脚本 |
| `locale/*.json`、`icon.svg`、`README.md`、`.gitignore` | 资源与文档 |
| `pnpm-lock.yaml` | 构建依赖锁（可复现） |

不要提交的：`node_modules/`（15.8 MB 的 esbuild + xterm）、`.build/`（打包临时目录），已在 `.gitignore` 里。

### ⚠️ 移动目录会让 profile 失联

当前 profile 用的是**绝对路径 link**：

```
~/.dsh/profiles/web/package.json
  "@local/python-workspace": "link:C:/Users/Administrator/Documents/.../python-workspace-plugin"
```

把目录搬走之后，插件会加载失败。搬家后需要「卸掉旧的、从新路径装一次」：

```
plugin_manager  remove_bundle   target: "@local/python-workspace"
plugin_manager  install_bundle  target: "<新路径>"
```

### 明天继续的检查清单

1. 改 UI → 改 `src/client.js` → `node tools/build-client.mjs` → **刷新页面**
2. 改 Host → 改 `index.js` → **重启 dsh 一次**（Host 代码不热更，`hmr.root: []`）
3. 自测：`node ../.python-workspace-check/host-check.mjs <临时目录>`（31+ 项）、`node ../.python-workspace-check/highlight-check.mjs`、`node ../.python-workspace-check/client-smoke.mjs`
4. 已知待办：shell 目前是 `cmd.exe`，想换 PowerShell 就改 `index.js` 的 `shellFor()`（优先 `pwsh.exe` → `powershell.exe` → `cmd.exe`）

## 8. 想继续加的东西（按代价从小到大）

1. 新建/删除文件（Host 加两个路由，UI 加两个按钮）。
2. 记住上次打开的目录（`ctx.settings` 或 profile config）。
3. 给运行加「cwd = 所选根目录」的开关，方便 `python -m` 包内执行。
4. 语法高亮：换成 `dsh.client.external` + 构建产物的 CodeMirror。
5. 让 Agent 也能用：把「运行」做成一个 Host 服务方法，同时暴露成 Agent Tool（见 `references/user-actions.md` 的「一次实现，两个调用方」）。
