# Magic Orange Base — 领域术语表 (Glossary)

> 此文件定义本项目的核心领域概念，供 engineering skills 统一词汇。详细文档见 `schemas/`。

## 项目定位

**Magic Orange Base** 是一个 AI Agent 应用基础底座，从 OpenClaw 项目提取并重构。提供完整的 Agent 运行时环境、插件系统和多渠道支持。

## 核心概念

### Agent 与执行循环

| 术语 | 定义 |
|------|------|
| **Agent** | 三层结构：CoreAgentHarness（编排）→ Agent（有状态包装）→ runAgentLoop（无状态纯函数循环） |
| **Inner Loop** | 执行层循环：感知 → 推理 → 行动 → 观察（ReAct 模式），位于 `src/agents/` |
| **Outer Loop** | 编排层循环：目标拆解 → 任务分配 → 结果汇总 → 再计划，位于 `loop-modules/` |
| **CoreAgentHarness** | 编排层，调度 Agent 生命周期，位于 `packages/agent-core/harness/` |
| **runAgentLoop** | 无状态纯函数循环，处理 tool calls 和消息流转 |

### 插件与扩展

| 术语 | 定义 |
|------|------|
| **Plugin** | 插件系统，通过动态加载扩展 Agent 能力。核心必选插件：openai、anthropic、memory-core、diffs、openshell、policy、oc-path |
| **Extension** | 插件在项目中的物理目录，位于 `extensions/` |
| **Connector** | 通过 MCP 协议接入外部工具链（GitHub、Linear、Slack 等） |

### 消息与渠道

| 术语 | 定义 |
|------|------|
| **Channel** | 消息渠道适配器，支持 25+ 渠道（Discord、Telegram、Slack、飞书等），位于 `src/channels/` |
| **Gateway** | HTTP/WS 控制平面，位于 `src/gateway/` |
| **Session** | 会话管理，多会话并发支持 |

### 核心包

| 包名 | 职责 |
|------|------|
| `@openclaw/normalization-core` | 数据规范化（1777 处引用，依赖最深） |
| `@openclaw/model-catalog-core` | 模型目录，Agent 运行时必需 |
| `@openclaw/media-core` | 媒体处理，多模态能力基础 |
| `@openclaw/acp-core` | Agent Client Protocol，会话管理 |
| `@openclaw/fs-safe` | 安全文件操作 |
| `@openclaw/net-policy` | 网络策略控制 |

### 架构原则

| 术语 | 定义 |
|------|------|
| **Skill** | 项目知识沉淀为文档，Agent 每轮直接读取 |
| **Sub-agent** | 写代码的和验收的分开，形成对抗验证 |
| **Worktree** | Git worktree 隔离多 Agent 并行工作区 |
| **状态外置** | Agent 状态存储在 SQLite 而非内存中 |

## 项目结构

```
magic-orange-base/
├── src/                    # 核心源码（9 个核心引擎模块 + 10+ 可选产品模块）
├── packages/               # 6 个核心 npm 包（normalization-core、model-catalog-core 等）
├── extensions/             # 核心插件（openai、anthropic、memory-core 等）
├── loop-modules/           # 可选 Outer Loop 模块（@magic-orange/loop-core）
├── schemas/                # 项目知识库（决策地图、架构审查、参考手册、查阅规则）
└── docs/agents/            # Codex 技能配置（issue tracker、triage labels、domain rules）
```

## 知识库入口

详细的项目决策记录、架构分析、上游参考手册和依赖分析，均存放在 `schemas/` 目录下：

- `schemas/index.md` — 知识库索引，所有参考手册的总入口
- `schemas/decision-map.md` — 架构决策地图（resolved / open 状态追踪）
- `schemas/dependency-analysis.md` — 依赖分析报告
- `schemas/analysis-report.md` — Loop Engineering 分析报告
- `schemas/magic-orange-base-detailed-review.md` — 项目框架结构详细审查报告
- `schemas/references/` — 上游项目参考手册（OpenClaw、Hermes Agent）
- `schemas/rules/` — 知识查阅和回补规则

> 任何技能在需要深入理解项目时，应优先查阅 `schemas/` 下的相关文档，而非直接从代码推断。
> 当工作涉及参考项目查阅或新手册生成时，按 `schemas/rules/` 中的流程操作。
>
> 避免使用的同义词：不要在 glossary 中使用"组件"、"服务"、"API"等模糊术语替代上述精确定义的概念。
### Workflow rules

当需要查阅参考项目手册时，先读 `schemas/rules/query.md` 了解查阅流程，按"先查手册，后查代码"原则操作。

当需要生成新的参考手册时，先读 `schemas/rules/gen.md` 了解 7 维度调查方法和统一格式，在新项目源码上按维度逐一调查后生成。

查阅过程中的新发现，按 `schemas/rules/ingest.md` 规则及时回补，形成知识复利。

### Architecture Decision Records (ADRs)

架构决策记录位于 `docs/adr/` 目录。当需要进行架构决策时，先查阅 ADRs 了解已做的决策，避免重复讨论；当做出新决策时，创建新的 ADR 文件记录。
