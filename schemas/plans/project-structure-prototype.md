# Magic Orange Base — 项目结构原型

> 生成时间: 2026-07-02
> 目标: 设计提取后的项目目录结构

## 目录结构

```
magic-orange-base/
├── src/                              # OpenClaw 核心源码（提取自 E:\aiproject\openclaw\src）
│   │
│   │ # === 核心引擎层（必选） ===
│   ├── agents/                       # Agent 循环引擎（Inner Loop）
│   ├── config/                       # 配置加载、类型定义
│   ├── infra/                        # 基础设施（数据库、缓存等）
│   ├── plugins/                      # 插件系统：发现、加载、注册
│   ├── shared/                       # 共享工具和类型
│   ├── utils/                        # 通用工具函数
│   ├── logging/                      # 日志系统
│   ├── state/                        # SQLite 状态管理
│   ├── types/                        # 类型定义
│   │
│   │ # === 产品功能层（可选，按需保留） ===
│   ├── gateway/                      # HTTP/WS 控制平面
│   ├── channels/                     # 消息渠道适配
│   ├── cli/                          # 命令行界面
│   ├── auto-reply/                   # 自动回复逻辑
│   ├── llm/                          # 模型提供商路由
│   ├── routing/                      # 消息路由
│   ├── secrets/                      # 密钥管理
│   ├── sessions/                     # 会话管理
│   ├── tasks/                        # 任务系统
│   ├── process/                      # 进程管理
│   ├── tui/                          # 终端 UI
│   ├── hooks/                        # Hook 事件总线
│   ├── tools/                        # 工具规划系统
│   ├── context-engine/               # 上下文管理引擎
│   ├── acp/                          # Agent Client Protocol 运行时
│   ├── mcp/                          # Model Context Protocol 支持
│   ├── memory/                       # 记忆插件运行时
│   ├── media*/                       # 媒体处理相关
│   ├── web-search/                   # Web 搜索运行时
│   ├── web-fetch/                    # Web 抓取运行时
│   │
│   │ # === 入口文件 ===
│   ├── entry.ts                      # 主入口
│   ├── index.ts                      # 库入口
│   ├── runtime.ts                    # 运行时
│   ├── globals.ts                    # 全局状态
│   └── ...
│
├── packages/                         # 核心包（从 openclaw/packages 提取）
│   ├── normalization-core/           # 数据规范化（1777 次引用，最高频）
│   ├── model-catalog-core/           # 模型目录（168 次引用）
│   ├── media-core/                   # 媒体处理（106 次引用）
│   ├── acp-core/                     # ACP 协议（90 次引用）
│   ├── fs-safe/                      # 安全文件操作（51 次引用）
│   └── net-policy/                   # 网络策略（34 次引用）
│
├── extensions/                       # 核心必选插件（10 个）
│   ├── openai/                       # OpenAI 提供商
│   ├── anthropic/                    # Anthropic 提供商
│   ├── memory-core/                  # 基础记忆系统
│   ├── diffs/                        # 代码差异工具
│   ├── openshell/                    # Shell 执行工具
│   ├── policy/                       # 权限策略控制
│   ├── oc-path/                      # 路径处理工具
│   ├── skills/                       # 技能管理
│   ├── duckduckgo/                   # Web 搜索（可选）
│   └── browser/                      # 浏览器自动化（可选）
│
├── loop-modules/                     # 可选的 Outer Loop 模块
│   ├── index.ts                      # 统一导出
│   ├── types.ts                      # 共享类型
│   ├── outer-loop.ts                 # 核心编排器
│   ├── goal-manager.ts               # 目标管理器
│   ├── state-file.ts                 # 状态文件
│   ├── gate-runner.ts                # 硬闸门
│   ├── adversarial-evaluator.ts      # 对抗验证器
│   ├── automation-scheduler.ts       # 自动化调度
│   └── worktree-manager.ts           # Git Worktree 隔离
│
├── plugin-library/                   # 插件库索引（指向 openclaw-disassembled）
│   └── README.md                     # 说明如何从插件库安装更多插件
│
├── config/                           # 配置文件
│   ├── tsconfig.json                 # TypeScript 配置
│   ├── vitest.config.ts              # 测试配置
│   └── ...
│
├── package.json                      # 根包配置
├── pnpm-workspace.yaml               # pnpm 工作区定义
├── tsconfig.json                     # TypeScript 根配置
├── tsconfig.core.json                # 核心编译配置
├── tsdown.config.ts                  # 构建配置
├── .env.example                      # 环境变量模板
└── README.md                         # 项目说明
```

## 文件规模估算

| 目录 | 文件数 | 来源 |
|------|--------|------|
| `src/`（核心引擎层） | ~3000 | 9 个核心模块 |
| `src/`（通用产品层） | ~5000 | 16 个通用产品模块 |
| `src/`（领域可选层） | ~1000 | ~35 个可选模块 |
| `packages/` | ~200 | 6 个核心包 |
| `extensions/` | ~500 | 10 个核心插件 |
| `loop-modules/` | 8 | Outer Loop 模块 |
| **总计** | ~9700 | |

## 通用底座最小提取标准（重新定义）

**核心原则**: 所有垂直产品都会用到的公共能力 = 底座必须包含

### 核心引擎层（9 个模块，~3000 文件）— 必须提取

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

### 通用产品层（16 个模块，~5000 文件）— 必须提取

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

### 领域可选层（~35 个模块，~1000 文件）— 按需提取

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

## 垂直产品扩展方式

```
magic-orange-legal/                  # 垂直领域产品
├── magic-orange-base/               # git submodule 或 npm 依赖
├── extensions/                      # 领域特定插件
│   ├── legal-search/                # 法规检索
│   ├── case-analysis/               # 案例分析
│   └── compliance-check/            # 合规检查
├── config/
│   ├── system-prompt.md             # 法律领域系统提示词
│   └── gate-commands.yaml           # 领域特定闸门命令
├── package.json
└── .env
```

## 下一步

1. 确定选择"最小提取"还是"完整提取"
2. 执行提取操作
3. 调整构建系统（见 `build-system` ticket）
4. 执行项目级重命名（见 `rename-scope` ticket）
