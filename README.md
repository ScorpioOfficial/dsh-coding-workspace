# dsh-coding-workspace

> 给 [DSH](https://github.com/deepseek-ai/deepseek-harness) Web 界面加一个**右侧栏 Coding 工作区**：打开目录、浏览/编辑/新建/重命名/删除文件、挑 Python 解释器、跑代码，并且带一个**真终端**（PTY + xterm）。

一个 DSH bundle 插件，Host 半 + Client 半，零外部服务依赖。

---

## 功能

### 文件与编辑

| 功能 | 说明 |
|---|---|
| 打开目录 | 原生文件夹选择框，或直接粘贴路径回车 |
| 跟随会话 | 新开的 tab 默认落在**当前会话的工作目录**（工作区路径），不用每次手动选 |
| 文件树 | 逐级展开，目录优先排序，`.py` 文件带标记 |
| 编辑保存 | 内置编辑器，`Ctrl/Cmd+S` 保存；有未保存修改时按钮变 `保存 •` |
| 语法高亮 | Python 关键字/字符串/数字/注释/装饰器/def 名/调用/属性/模块名，配色取自宿主自带的 shiki 调色板（深浅色主题自动跟随） |
| 新建 | 右键菜单「+ 文件 / + 目录」，在目标目录顶部就地命名；**回车或点别处即创建**，`Esc` 取消 |
| 重命名 | 右键「重命名」，就地改名；重名拒绝、根目录不可改、正在编辑的文件改名后路径自动同步 |
| 删除 | 右键「删除」，**两段式确认**（删除 → 确认删除/取消）；文件直删、目录递归删（Host 要求显式 `recursive`）、根目录不可删 |
| 刷新 | 右键「刷新」重新读盘（外部改动，例如 Agent 或终端里改了文件之后） |
| 布局可拖 | 目录列宽度、终端区高度都能拖动调整（悬停高亮、拖动时禁用文本选择） |

### 运行与终端

| 功能 | 说明 |
|---|---|
| 解释器选择 | 点工具栏解释器按钮 → 面板列出 **自动 / 虚拟环境 / 系统**（各自显示完整路径）+ **自定义路径**输入 |
| 一键建 venv | 目标目录没有 `.venv` 时显示「创建 .venv」，执行 `python -m venv .venv` |
| 真终端 | 底部内嵌 **xterm.js + PTY**：有提示符、能打字、方向键/Tab 补全、`Ctrl+C`、ANSI 颜色、窗口尺寸同步（`vim`/`top` 会正确重排） |
| 运行 | 绿色箭头把 `python 文件` **敲进终端**执行（按 shell 家族正确加引号：pwsh `& '…'`、cmd `"…"`、bash `'…'`） |
| 终端开关 | 状态条左侧「终端 ▸/▾」折叠/展开（xterm 与 shell 保持存活，展开不重开进程） |
| 状态条 | 底部通栏：左侧终端开关，右侧显示**当前解释器绝对路径** |

### 多标签

每个 tab 是一个独立工作区：**各自的目录、打开的文件、终端会话、输出**，互不串台。开始页卡片或标题栏入口每点一次都会新建一个。

---

## 环境要求

- DSH（Web profile）——插件以 bundle 形式安装到 profile
- Python 3（系统 Python 或目录内的 `.venv`）
- 宿主需提供终端 provider（`subprocess.spawnTerminal`，DSH 自带 `subprocess-local` 基于 node-pty）

不装 Node/pnpm 也能**直接用**：仓库里已提交构建产物 `client.js`。

---

## 安装

### 方式一：让 DSH 安装本地目录（推荐）

把仓库克隆到任意位置，然后让 DSH 把**这个目录**装进当前 profile：

```
plugin_manager  install_bundle  target: "<本机 dsh-coding-workspace 目录的绝对路径>"
```

装完刷新页面。首次安装 Host 半随之生效。

### 方式二：手动加入 profile

在 profile 的 `cordis.patch.yml` 里插入一行（与 `cordis.patch.yml` 同目录的 bundle 会自动带出自己的 patch）：

```yaml
- insert:
    - id: python-workspace
      name: '@local/python-workspace'
```

> 插件包名目前仍是 `@local/python-workspace`，HTTP 路由前缀为 `/python-workspace`；它们与仓库名不同名，功能不受影响。

---

## 使用

1. 打开右侧栏（会话标题行最右端的方框按钮，或 `Ctrl+Shift+B`）
2. 两种入口，**都是新建一个 tab**：
   - 右侧栏「开始」页 → **Coding 工作区** 卡片
   - 会话标题行左侧的 **头像 + Coding 工作区** 按钮
3. 面板自动落在当前会话目录；要换目录点「打开目录」
4. 点文件编辑 → 绿色箭头在终端里跑

### 常用交互

| 操作 | 结果 |
|---|---|
| 左键点文件 | 打开并高亮该行 |
| 左键点目录 | 展开/收起，并高亮 |
| 右键文件/目录 | 新建 / 重命名 / 删除 / 刷新（菜单显示在点击高度） |
| `Ctrl/Cmd+S` | 保存 |
| `Tab` | 编辑器内插入 4 个空格 |
| 拖动目录列右缘 / 终端区上缘 | 调整宽度 / 高度 |

---

## 开发

```bash
pnpm install          # 只有要重新构建时才需要（esbuild + xterm）
npm run build         # 重新打包 client.js（xterm + src/client.js）
```

- **客户端改动**：改 `src/client.js` → `npm run build` → 刷新页面（宿主的 client 产物会自动重建）
- **Host 改动**：改 `index.js` → **重启一次 dsh**（Host 代码不热更）
- 自测脚本不随仓库发布（本机工作区的 `.python-workspace-check/`）：Host 44 项、分词 21 项、构建产物冒烟

### 目录结构

```
dsh-coding-workspace/
├─ package.json          # bundle 清单（dsh.bundle.patch / dsh.client）+ 构建依赖
├─ cordis.patch.yml      # 往 profile 插入插件行
├─ index.js              # Host 半：文件 API、运行、venv、PTY、shell
├─ src/client.js         # Client 半源码（改这个）
├─ client.js             # 构建产物 = xterm bundle + src/client.js（勿手改）
├─ tools/xterm-entry.js  # 唯一 import xterm 的地方
├─ tools/build-client.mjs
├─ locale/{en,zh}.json   # 插件管理页的标题与描述
└─ icon.svg
```

### Host 接口（`/python-workspace` 前缀，全部要求页面自己的登录 Cookie）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/env?root=` | 系统/venv 解释器路径 |
| GET | `/api/list?root=&path=` | 列目录 |
| GET | `/api/read?root=&path=` | 读文本文件（拒绝二进制/过大） |
| POST | `/api/write` | 写文件 |
| POST | `/api/mkfile` `/api/mkdir` | 新建文件/目录（重名 409） |
| POST | `/api/rename` | 重命名（根目录保护、重名 409） |
| POST | `/api/delete` | 删除（目录需 `recursive:true`） |
| POST | `/api/venv` | `python -m venv .venv` |
| POST | `/api/run` + GET `/api/run` + POST `/api/input` | 管道运行、读输出、写 stdin（无 PTY 时的回退路径） |
| POST | `/api/shell` `/api/shell/run` | 起交互 shell、往 shell 里敲运行命令 |
| POST/GET | `/api/pty`、`/api/pty/input`、`/api/pty/resize`、`/api/pty/close` | PTY 生命周期与数据面 |

所有路径都经 `resolveInside(root, rel)` 约束在打开的目录内；跨域/无凭据请求一律 401/403。

---

## 已知限制

- **shell 是 `cmd.exe`**（宿主未报告默认 shell）；想换 PowerShell 改 `index.js` 的 `shellFor()`（`pwsh.exe` → `powershell.exe` → `cmd.exe`）
- 编辑器是"高亮叠加层"，不是完整 IDE：没有补全、多光标、折叠、跳转定义
- 语法高亮是正则分词：`getattr(obj,"x")`、f-string 内的表达式等分不出来
- 删除是**物理删除**，不进回收站
- 目录/终端尺寸只按 tab 保存，重启后回默认值
- 仅测过 Windows（venv 路径、shell 选择、命令引号都做了 POSIX 分支，但未实测）

---

## 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| 面板空白、右侧栏提示"这类内容还没有可用的查看方式" | 客户端模块没加载。检查 `package.json` **不能有 UTF-8 BOM**，然后刷新；再不行重启 dsh |
| `no route POST /python-workspace/api/...` | Host 半还是旧代码，**重启一次 dsh** |
| 终端没有提示符、打字没反应 | `/api/shell` 未生效（同上）或宿主没有终端 provider |
| 换目录后弹 `that terminal is gone` 红字 | 旧版本竞态，已修复；若仍有，刷新即可 |

---

## License

未指定（若要发布请先选择许可证并补充 `LICENSE`）。
