# OpenClaw 依赖分析报告

> 生成时间: 2026-07-02
> 目标: 确定提取 `src/` 时需要带哪些依赖

## 一、packages/ 依赖（核心包）

`src/` 中有 **2237 处**引用了 `@openclaw/*` 包，分布如下：

| 包名 | 引用次数 | 优先级 | 说明 |
|------|----------|--------|------|
| `@openclaw/normalization-core` | 1777 | **核心必选** | 数据规范化，几乎每个模块都依赖 |
| `@openclaw/model-catalog-core` | 168 | **核心必选** | 模型目录，Agent 运行时必需 |
| `@openclaw/media-core` | 106 | **核心必选** | 媒体处理，多模态能力基础 |
| `@openclaw/acp-core` | 90 | **核心必选** | Agent Client Protocol，会话管理 |
| `@openclaw/fs-safe` | 51 | **核心必选** | 安全文件操作 |
| `@openclaw/net-policy` | 34 | **核心必选** | 网络策略控制 |
| `@openclaw/llm-core` | 6 | 可选 | LLM 接口定义（实际通过插件加载） |
| `@openclaw/proxyline` | 4 | 可选 | 代理支持 |
| `@openclaw/plugin-sdk` | 1 | 可选 | 插件 SDK（实际通过插件系统加载） |

**结论**：必须提取 **6 个核心包**，其他 15 个包可选或不需要。

---

## 二、src/ 内部模块依赖

`src/` 内部有 **8305 处**相对路径引用，各模块被引用频率：

### 核心引擎层（必选）

| 模块 | 引用次数 | 职责 |
|------|----------|------|
| `config/` | 2448 | 配置加载、类型定义 |
| `infra/` | 1619 | 基础设施（数据库、缓存等） |
| `plugins/` | 1235 | 插件系统：发现、加载、注册 |
| `agents/` | 1045 | Agent 循环引擎（Inner Loop） |
| `shared/` | 346 | 共享工具和类型 |
| `utils/` | 282 | 通用工具函数 |
| `logging/` | 209 | 日志系统 |
| `state/` | 117 | SQLite 状态管理 |
| `types/` | 9 | 类型定义 |

### 产品功能层（可选）

| 模块 | 引用次数 | 职责 | 是否保留 |
|------|----------|------|----------|
| `channels/` | 605 | 25+ 消息渠道适配 | 可选 |
| `auto-reply/` | 331 | 自动回复逻辑 | 可选 |
| `gateway/` | 253 | HTTP/WS 控制平面 | 可选 |
| `cli/` | 207 | 命令行界面 | 可选 |
| `routing/` | 187 | 消息路由 | 可选 |
| `llm/` | 130 | 模型提供商路由 | 可选 |
| `secrets/` | 115 | 密钥管理 | 可选 |
| `sessions/` | 101 | 会话管理 | 可选 |
| `process/` | 97 | 进程管理 | 可选 |
| `tasks/` | 88 | 任务系统 | 可选 |

**结论**：核心引擎层 9 个模块必选，产品功能层 10+ 个模块可选。

---

## 三、extensions/ 依赖

`src/` 中只有 **26 处**直接引用 `extensions/`，且集中在：
- `src/agents/sessions/extensions/` — 插件加载器
- `src/gateway/server-import-boundary.test.ts` — 测试文件

**关键发现**：`src/` 通过**插件系统动态加载** `extensions/`，不是硬编码依赖。

**结论**：`extensions/` 不需要随 `src/` 一起提取，可以按需选择插件。

---

## 四、第三方 npm 依赖

根目录 `package.json` 有 **55 个运行时依赖**：

### 核心运行时依赖（必选）

| 包名 | 用途 |
|------|------|
| `@anthropic-ai/sdk` | Anthropic API |
| `@google/genai` | Google AI API |
| `@mistralai/mistralai` | Mistral API |
| `openai` | OpenAI API |
| `@modelcontextprotocol/sdk` | MCP 协议 |
| `@agentclientprotocol/sdk` | ACP 协议 |
| `typebox` | Schema 验证 |
| `typescript` | TypeScript 运行时 |
| `zod` | 数据验证 |
| `yaml` / `json5` | 配置解析 |
| `chalk` | 终端颜色 |
| `commander` | CLI 框架 |
| `express` | HTTP 服务器 |
| `ws` | WebSocket |
| `kysely` | 数据库 ORM |
| `chokidar` | 文件监听 |
| `glob` / `minimatch` | 文件匹配 |
| `ignore` | .gitignore 解析 |
| `dotenv` | 环境变量 |

### 可选依赖（按需）

| 包名 | 用途 | 是否保留 |
|------|------|----------|
| `playwright-core` | 浏览器自动化 | 可选 |
| `grammy` | Telegram 渠道 | 可选 |
| `node-edge-tts` | TTS 语音 | 可选 |
| `clawpdf` | PDF 解析 | 可选 |
| `rastermill` | 图像处理 | 可选 |
| `tree-sitter-bash` | Bash 解析 | 可选 |
| `web-tree-sitter` | 代码解析 | 可选 |

---

## 五、提取建议

### 通用底座最小提取标准（重新定义）

**核心原则**: 所有垂直产品都会用到的公共能力 = 底座必须包含

#### 核心引擎层（9 个模块，~3000 文件）— 必须提取

| 模块 | 引用次数 | 职责 |
|------|----------|------|
| `config/` | 2448 | 配置加载、类型定义 |
| `infra/` | 1619 | 基础设施（数据库、缓存等） |
| `plugins/` | 1235 | 插件系统：发现、加载、注册 |
| `agents/` | 1045 | Agent 循环引擎（Inner Loop） |
| `shared/` | 346 | 共享工具和类型 |
| `utils/` | 282 | 通用工具函数 |
| `logging/` | 209 | 日志系统 |
| `state/` | 117 | SQLite 状态管理 |
| `types/` | 9 | 类型定义 |

#### 通用产品层（16 个模块，~5000 文件）— 必须提取

| 模块 | 引用次数 | 职责 | 为什么必须提取 |
|------|----------|------|----------------|
| `gateway/` | 253 | HTTP/WS 控制平面 | 每个垂直产品都需要对外暴露 API |
| `cli/` | 207 | 命令行界面 | 每个产品都需要 CLI 入口 |
| `llm/` | 130 | 模型提供商路由 | 每个产品都需要切换/管理 LLM |
| `channels/` | 605 | 渠道抽象层 | 每个产品都需要消息渠道适配 |
| `routing/` | 187 | 消息路由 | 多渠道时必须有路由 |
| `sessions/` | 101 | 会话管理 | 每个产品都需要多会话 |
| `secrets/` | 115 | 密钥管理 | 每个产品都需要安全管理 API Key |
| `hooks/` | 66 | Hook 事件总线 | 插件间通信基础 |
| `tools/` | 11 | 工具规划系统 | Agent 工具选择基础 |
| `context-engine/` | 13 | 上下文管理 | 上下文窗口管理 |
| `acp/` | 98 | Agent Client Protocol | Agent 间通信标准 |
| `mcp/` | 15 | Model Context Protocol | 模型上下文标准 |
| `memory/` | 0 | 记忆运行时 | 记忆系统宿主 |
| `process/` | 34 | 进程管理 | 子进程/工具执行 |
| `tasks/` | 60 | 任务系统 | 后台任务管理 |
| `auto-reply/` | 568 | 自动回复框架 | 消息响应基础框架 |

#### 领域可选层（~35 个模块，~1000 文件）— 按需提取

| 模块 | 职责 | 为什么可选 |
|------|------|------------|
| `tui/` | 终端 UI | 不是所有产品都需要终端 UI |
| `media*/` | 媒体处理 | 只有需要多媒体时才需要 |
| `web-search/` | Web 搜索运行时 | 可通过插件提供 |
| `web-fetch/` | Web 抓取运行时 | 可通过插件提供 |
| `image-generation/` | 图像生成 | 特定场景 |
| `video-generation/` | 视频生成 | 特定场景 |
| `tts/` | TTS 语音 | 特定场景 |
| `talk/` | 语音通话 | 特定场景 |
| `wizard/` | 设置向导 | 可选的用户引导 |
| `daemon/` | 守护进程 | 可选的后台运行 |
| `cron/` | 定时任务 | 可选的定时能力 |

### 提取规模对比

| 类别 | 模块数 | 文件数 |
|------|--------|--------|
| 核心引擎层 | 9 | ~3000 |
| 通用产品层 | 16 | ~5000 |
| **通用底座合计** | **25** | **~8000** |
| 领域可选层 | ~35 | ~1000 |
| 总计 | ~60 | ~9000 |

**结论**: 通用底座 ≈ 完整提取（~8000 vs ~9000），只差一小撮特定场景模块。

### 核心包（packages/）

| 包名 | 引用次数 | 优先级 |
|------|----------|--------|
| `normalization-core` | 1777 | **核心必选** |
| `model-catalog-core` | 168 | **核心必选** |
| `media-core` | 106 | **核心必选** |
| `acp-core` | 90 | **核心必选** |
| `fs-safe` | 51 | **核心必选** |
| `net-policy` | 34 | **核心必选** |

### 核心插件（extensions/）

| 插件 | 必要性 | 说明 |
|------|--------|------|
| `openai` | **必需** | LLM 提供商 |
| `anthropic` | **必需** | LLM 提供商 |
| `memory-core` | **必需** | 基础记忆系统 |
| `diffs` | **必需** | 代码差异工具 |
| `openshell` | **必需** | Shell 执行工具 |
| `policy` | **必需** | 权限策略控制 |
| `oc-path` | **必需** | 路径处理工具 |
| `skills` | **必需** | 技能管理 |
| `duckduckgo` | 可选 | Web 搜索 |
| `browser` | 可选 | 浏览器自动化 |

### 第三方依赖

**核心运行时依赖（20 个）**:
- LLM SDK: `openai`、`@anthropic-ai/sdk`、`@google/genai`、`@mistralai/mistralai`
- 协议: `@modelcontextprotocol/sdk`、`@agentclientprotocol/sdk`
- 基础: `typebox`、`typescript`、`zod`、`yaml`、`json5`
- 服务器: `express`、`ws`
- 数据库: `kysely`
- 工具: `chalk`、`commander`、`chokidar`、`glob`、`minimatch`、`ignore`、`dotenv`

---

## 六、下一步行动

1. 确定选择"最小提取"还是"完整提取"
2. 确定核心必选插件清单（见 `core-plugins` ticket）
3. 设计提取后的项目结构（见 `project-structure` ticket）
