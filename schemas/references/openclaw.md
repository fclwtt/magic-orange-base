# OpenClaw — 参考手册

> 生成时间: 2026-07-01
> 路径: https://github.com/openclaw/openclaw
> 最后更新: 2026-07-01
> 索引位置: schemas/references/openclaw.md

## 项目概述

| 项目 | 说明 |
|------|------|
| **名称** | OpenClaw |
| **版本** | 2026.6.11 |
| **定位** | 个人 AI 助手 — 运行在用户自有设备上，通过消息渠道提供 AI 交互 |
| **核心功能** | 多渠道 AI 网关、Agent 循环引擎、插件系统、工具调用、会话管理、MCP 支持 |
| **技术栈** | TypeScript (ESM strict)、Node.js 22.19+、pnpm monorepo、TypeBox、Hono、SQLite |
| **口号** | "The AI that actually does things." |

## 目录结构

```
https://github.com/openclaw/openclaw
├── src/                    # 核心运行时源码
│   ├── agents/             # Agent 运行时：embedded-agent-runner、sessions、tools、hooks
│   ├── gateway/            # Gateway 控制平面：HTTP/WS 服务、认证、配置
│   ├── channels/           # 渠道抽象层：注册表、路由、消息流控
│   ├── plugins/            # 插件系统：发现、清单验证、加载、注册表
│   ├── hooks/              # Hook 系统：事件总线、动态加载
│   ├── llm/                # 模型/提供商注册表、传输助手
│   ├── cli/                # CLI 命令解析与路由
│   ├── config/             # 配置加载、类型定义
│   ├── tools/              # 工具规划系统（可用性评估、计划构建）
│   ├── acp/                # Agent Client Protocol 运行时
│   ├── mcp/                # Model Context Protocol 支持
│   ├── memory/             # 记忆插件运行时
│   ├── context-engine/     # 上下文管理引擎
│   └── state/              # 状态管理（SQLite）
├── packages/               # 内部共享包（21 个核心包）
├── extensions/             # 内置插件（146+ 个）
├── ui/                     # Web 控制面板 UI
├── apps/                   # 原生伴侣应用（iOS、Android、macOS）
├── docs/                   # 文档源文件
├── skills/                 # 内置 Skill 定义
└── scripts/                # 构建/发布/运维脚本
```

## 架构设计

### 整体架构模式：分层插件化网关架构

```
CLI / Companion Apps
    ↓
Gateway 控制平面 (HTTP/WS)
    ↓
┌──────────┬──────────┬───────────┬──────────────┐
│ Channels │  Agent   │  Plugins  │  Hook System │
│ 渠道适配  │  循环引擎 │  插件系统  │  事件钩子总线 │
└──────────┴──────────┴───────────┴──────────────┘
    ↓
LLM Provider Runtime (多提供商路由)
    ↓
Core Packages (packages/*)
    ↓
Extensions (146+ 插件)
```

### 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| Agent Loop | `src/agents/` | Inner Loop 执行引擎 |
| Gateway | `src/gateway/` | HTTP/WS 服务、认证、配置重载 |
| Plugin System | `src/plugins/` | 插件发现、验证、加载、注册 |
| Hook System | `src/hooks/` | 事件总线、动态 Hook 加载 |
| Channel Layer | `src/channels/` | 25+ 消息渠道适配 |
| LLM Runtime | `src/llm/` | 多模型提供商路由 |

### 关键设计原则

1. **插件优先** — 核心保持精简，功能通过插件扩展
2. **Hook 驱动** — 通过 Hook 系统实现松耦合
3. **状态外置** — SQLite 持久化，不依赖内存状态
4. **多渠道统一** — 统一 API 适配 25+ 消息平台

## 接口设计

### Agent Loop 接口

```typescript
// 核心循环函数
async function runAgentLoop(context, eventSink, config): Promise<void>

// Agent 有状态包装
class Agent {
  async run(prompt: string): Promise<AgentResult>
}

// 编排层
class CoreAgentHarness {
  async execute(config: HarnessConfig): Promise<void>
}
```

### Hook 接口

```typescript
// 关键 Hook 点
prepareNextTurn?: (context) => context
shouldStopAfterTurn?: (state) => boolean
getSteeringMessages?: () => Message[]
getFollowUpMessages?: () => Message[]
```

### Plugin SDK 接口

```typescript
// 插件入口
definePluginEntry({
  name: string,
  version: string,
  register: (context: PluginContext) => void
})

// 插件能力注册
registerTool(tool: ToolDefinition)
registerProvider(provider: ProviderDefinition)
registerChannel(channel: ChannelDefinition)
registerHook(hook: HookDefinition)
```

## 设计哲学

### 核心原则

1. **插件优先（Plugin-First）** — 核心保持精简，功能通过插件扩展
2. **本地优先（Local-First）** — 运行在用户设备，数据不离开用户控制
3. **渠道无关（Channel-Agnostic）** — 统一 API 适配所有消息平台
4. **可扩展性（Extensibility）** — Hook 系统实现松耦合扩展

### 权衡取舍

- **复杂性换灵活性** — 插件系统增加了复杂度，但提供了极强的扩展性
- **本地存储换隐私** — SQLite 本地存储，牺牲分布式能力换取隐私
- **TypeScript 严格模式** — 开发成本高，但类型安全性强

### 反模式（项目明确避免的做法）

- ❌ 在核心代码中添加功能（应该用插件）
- ❌ 硬编码渠道特定逻辑（应该用渠道抽象）
- ❌ 直接修改 Inner Loop（应该用 Hook 扩展）

## 关键模块索引

| 模块 | 路径 | 说明 |
|------|------|------|
| Agent Loop | `src/agents/` | Inner Loop 执行引擎 |
| Gateway | `src/gateway/` | HTTP/WS 控制平面 |
| Plugin System | `src/plugins/` | 插件生命周期管理 |
| Hook System | `src/hooks/` | 事件钩子总线 |
| Channels | `src/channels/` | 消息渠道抽象层 |
| LLM Runtime | `src/llm/` | 模型提供商路由 |
| CLI | `src/cli/` | 命令行入口 |
| Config | `src/config/` | 配置管理 |
| Tools | `src/tools/` | 工具规划系统 |
| ACP | `src/acp/` | Agent Client Protocol |
| MCP | `src/mcp/` | Model Context Protocol |
| Memory | `src/memory/` | 记忆系统 |
| Context Engine | `src/context-engine/` | 上下文管理 |
| State | `src/state/` | SQLite 状态存储 |

## 配置与约定

### 构建命令
- 安装依赖: `pnpm install`
- 构建: `pnpm build`
- 类型检查: `pnpm typecheck`
- Lint: `pnpm lint`
- 测试: `pnpm test`

### 代码规范
- TypeScript strict mode
- ESM 模块
- TypeBox 用于 schema 验证
- oxfmt 格式化
- oxlint 检查

### 已知坑点
- Inner Loop（runAgentLoop）不可修改，所有扩展必须通过 Hook
- 插件必须通过清单验证（openclaw.plugin.json）
- 状态存储使用 SQLite WAL 模式

## 查阅日志

- 2026-07-01: 初始生成（Loop Engineering 改造项目）
