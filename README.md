# 个人足迹 · 时间轴

以「时间点」为核心的本地相册工具：每个时间点包含日期、一段说明和若干张图片，按年份分组展示。
纯前端，无后端、无数据库 —— 数据直接读写你电脑上的本地文件夹。

## 环境要求

- Node.js ≥ 20.19（Vite 8 的要求；开发时用的是 v24.17）
- Chrome 或 Edge（读写本地目录需要 File System Access API）

## 安装与启动

```bash
npm install
npm run dev      # http://localhost:5173
```

其他命令：

```bash
npm run build    # 类型检查 + 打包到 dist/
npm run preview  # 本地预览打包结果
npm run lint     # oxlint
```

## 首次使用：选择数据目录

点页头「选择数据目录」，**选项目根目录**（含 `index.html` 的那一层）。选好之后：

- 数据写入 `<根目录>/data.json`
- 图片写入 `<根目录>/photos/<日期>/<时间戳-序号>.<后缀>`

必须是项目根目录，因为页面里的图片走 `photos/...` 相对路径，由 dev server 或静态服务器从站点根目录解析。

## 目录结构

```
个人足迹/
├── index.html
├── data.json              # 运行时写入：全部时间点
├── photos/                # 运行时写入：图片，按日期分目录
│   └── 2026-09-26/
│       ├── 1790695618164-1.jpg
│       └── 1790695618164-2.jpg
└── src/
    ├── components/        # Timeline / YearGroup / EventCard / PhotoGrid / Lightbox
    │                      # BottomScrubber / EditToolbar / EventForm / DataSourceBar
    │                      # ThemeToggle / PhotoDraftsProvider
    ├── hooks/             # useFileSystem / useDirectory / usePhotoDrafts
    │                      # useTheme / useTimelineScroll
    ├── lib/               # photoFiles（图片落盘）/ backup（降级导出）
    │                      # directoryStore（记住上次目录）
    ├── styles/index.css
    ├── types.ts
    └── App.tsx
```

## 数据存在哪里

| 状态 | 数据位置 |
| --- | --- |
| 还没选数据目录 | 浏览器 localStorage（临时暂存）。页头会提醒「图片刷新后会丢失」 |
| 已选数据目录 | 读写该目录下的 `data.json`，每次修改自动保存；图片写入 `photos/` |
| 主题偏好 | localStorage |
| 上次选过的目录 | IndexedDB（刷新后能自动接回） |

切到数据目录时，如果 `data.json` 已存在就以磁盘内容为准（避免覆盖丢失）；如果目录里还没有 `data.json`，会先沿用浏览器里的临时数据。

写 `data.json` 前会先读一遍磁盘：如果文件在页面外被改过，会把磁盘上多出来的时间点合并进来，不会直接覆盖。

## 主题

页头右上角按钮在 `跟随系统 → 浅色 → 深色` 之间循环。选「跟随系统」时会实时跟随系统设置，切换后也会记住手动选择。

想加背景图：改 `src/styles/index.css` 里的 `--app-background-image`，组件不用动。

## 打包部署

```bash
npm run build
```

把 `photos/` 和 `data.json` 一起放进 `dist/`，然后把 `dist/` 当作站点根目录发布，并在站点里把 `dist` 选为数据目录。

注意：File System Access API 只在 `localhost` 或 `https` 下可用；用 `http://` 访问远程主机会退化到「导出 data.json / 导出图片清单」的手动方案。

## 已知限制

- **目录授权**：同一浏览器会话内刷新会自动接回上次的目录；重启浏览器后授权会退回待确认状态，页头会出现「恢复访问…」按钮，点一下即可。
- **未选目录时也能保存**：方便先录入，但图片不会落盘（页头有琥珀色提醒），刷新后只能看到占位块。补救方式是用「导出图片清单」把待放置的图片列出来，手动放进 `photos/`。
- **移除图片不删磁盘文件**：从表单里移除图片只改 `data.json`，磁盘上的文件保留。
- **图片缺失显示占位块**：图片被移动、改名或删除时，网格位置会显示灰色虚线占位块并标出路径，不会让布局塌掉。
