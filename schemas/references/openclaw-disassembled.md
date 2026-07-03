# OpenClaw Disassembled — 参考手册

> 生成时间: 2026-07-01
> 路径: E:\aiproject\openclaw-disassembled
> 最后更新: 2026-07-01
> 索引位置: schemas/references/openclaw-disassembled.md

## 项目概述

| 项目 | 说明 |
|------|------|
| **名称** | OpenClaw Disassembled（拆解版） |
| **定位** | OpenClaw 核心骨架 + 插件库的拆解版本，用于学习和二次开发 |
| **核心内容** | 核心包（agent-core、llm-core、plugin-sdk 等）+ 135 个插件 |
| **技术栈** | TypeScript、pnpm monorepo |

## 目录结构

```
E:\aiproject\openclaw-disassembled\
├── core/                           # 核心骨架
│   └── packages/                   # 21 个核心包
│       ├── agent-core/             # Agent 引擎（Inner Loop）
│       ├── llm-core/               # LLM 接口定义
│       ├── plugin-sdk/             # 插件 SDK（50+ 子路径导出）
│       ├── gateway-protocol/       # 网关协议
│       ├── acp-core/               # ACP 核心协议
│       └── ...
├── plugin-library/                 # 插件库
│   ├── all-plugins/                # 135 个插件
│   │   ├── openai/                 # OpenAI 提供商
│   │   ├── anthropic/              # Anthropic 提供商
│   │   ├── memory-core/            # 核心记忆系统
│   │   ├── diffs/                  # 代码差异工具
│   │   ├── browser/                # 浏览器自动化
│   │   ├── discord/                # Discord 渠道
│   │   └── ...
│   ├── PLUGIN-CATALOG.md           # 插件完整目录
│   └── all-plugins/AGENTS.md       # 插件开发边界规则
└── README.md
```

## 架构设计

### 核心包架构

```
core/packages/
├── agent-core/          # Agent 引擎
│   ├── agent-loop.ts    # runAgentLoop（Inner Loop 核心）
│   ├── agent.ts         # Agent 有状态包装
│   ├── harness/         # CoreAgentHarness 编排层
│   └── types.ts         # AgentEvent, AgentTool 等类型
├── llm-core/            # LLM 接口定义
├── plugin-sdk/          # 插件开发 SDK
│   └── 50+ 子路径导出    # provider-entry, channel-entry, memory-core 等
└── gateway-protocol/    # 网关通信协议
```

### 插件分类（135 个）

| 类别 | 数量 | 代表插件 |
|------|------|---------|
| LLM 提供商 | 20+ | openai, anthropic, google, mistral |
| 消息渠道 | 25+ | discord, telegram, slack, whatsapp |
| 记忆系统 | 8 | memory-core, memory-lancedb, active-memory |
| 工具插件 | 30+ | diffs, browser, openshell, search |
| 媒体生成 | 10 | fal, pixverse, runway, image-generation-core |
| 集成类 | 10 | skills, llm-task, raft, codex-supervisor |
| 诊断/运维 | 5 | admin-http-rpc, diagnostics-otel, prometheus |
| QA/测试 | 4 | qa-channel, qa-lab, qa-matrix, test-support |

## 接口设计

### Plugin SDK 核心接口

```typescript
// 插件入口定义
definePluginEntry({
  name: string,
  version: string,
  register: (context: PluginContext) => void
})

// Provider 注册（LLM 提供商）
registerLLMProvider(provider: LLMProviderDefinition)

// Channel 注册（消息渠道）
registerChannel(channel: ChannelDefinition)

// Tool 注册（工具）
registerTool(tool: ToolDefinition)

// Memory 注册（记忆系统）
registerMemoryProvider(memory: MemoryProviderDefinition)

// Hook 注册
registerHook(hook: HookDefinition)
```

### Plugin SDK 子路径导出

```
@openclaw/plugin-sdk/provider-entry      # Provider 入口
@openclaw/plugin-sdk/channel-entry       # Channel 入口
@openclaw/plugin-sdk/memory-core-host    # Memory 宿主接口
@openclaw/plugin-sdk/plugin-state-runtime # 插件状态存储
@openclaw/plugin-sdk/provider-auth       # Provider 认证
@openclaw/plugin-sdk/provider-tools      # Provider 工具兼容
```

### Agent Core 接口

```typescript
// Inner Loop 核心
async function runAgentLoop(
  context: AgentContext,
  eventSink: EventSink,
  config: AgentLoopConfig
): Promise<void>

// Hook 点
prepareNextTurn?: (context) => context
shouldStopAfterTurn?: (state) => boolean
getSteeringMessages?: () => Message[]
getFollowUpMessages?: () => Message[]
```

## 设计哲学

### 插件化设计原则

1. **窄腰宽边（Narrow Waist, Wide Brim）** — 核心保持精简，扩展通过插件实现
2. **声明式清单** — 每个插件有 `openclaw.plugin.json` 清单文件
3. **子路径导出** — Plugin SDK 通过 50+ 子路径提供精确的接口
4. **合约驱动** — 插件通过合约（Contract）与核心交互

### 插件开发边界规则（来自 AGENTS.md）

- ✅ 插件可以：注册工具、Provider、Channel、Hook
- ✅ 插件可以：使用 Plugin SDK 的子路径导出
- ❌ 插件不能：直接修改核心包代码
- ❌ 插件不能：绕过 Plugin SDK 直接访问内部 API

## 关键模块索引

### 核心包

| 模块 | 路径 | 说明 |
|------|------|------|
| agent-core | `core/packages/agent-core/` | Agent 引擎（Inner Loop） |
| agent-loop | `core/packages/agent-core/src/agent-loop.ts` | runAgentLoop 核心循环 |
| agent-harness | `core/packages/agent-core/src/harness/` | CoreAgentHarness 编排层 |
| llm-core | `core/packages/llm-core/` | LLM 接口定义 |
| plugin-sdk | `core/packages/plugin-sdk/` | 插件开发 SDK |
| gateway-protocol | `core/packages/gateway-protocol/` | 网关通信协议 |
| acp-core | `core/packages/acp-core/` | ACP 核心协议 |

### 重要插件

| 插件 | 路径 | 说明 |
|------|------|------|
| openai | `plugin-library/all-plugins/openai/` | OpenAI 提供商 |
| anthropic | `plugin-library/all-plugins/anthropic/` | Anthropic 提供商 |
| memory-core | `plugin-library/all-plugins/memory-core/` | 核心记忆系统 |
| diffs | `plugin-library/all-plugins/diffs/` | 代码差异工具 |
| browser | `plugin-library/all-plugins/browser/` | 浏览器自动化 |
| openshell | `plugin-library/all-plugins/openshell/` | Shell 执行工具 |
| discord | `plugin-library/all-plugins/discord/` | Discord 渠道 |
| skills | `plugin-library/all-plugins/skills/` | 技能管理 |

### 文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 插件目录 | `plugin-library/PLUGIN-CATALOG.md` | 135 个插件完整目录 |
| 插件开发规则 | `plugin-library/all-plugins/AGENTS.md` | 插件开发边界规则 |
| Loop Engineering 分析 | `openclaw-loop-engineering-analysis.md` | 改造方案分析 |

## 配置与约定

### 插件清单格式

```json
// openclaw.plugin.json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "entry": "./src/index.ts",
  "capabilities": ["tool", "provider"],
  "dependencies": ["@openclaw/plugin-sdk"]
}
```

### 代码规范
- TypeScript strict mode
- 使用 Plugin SDK 子路径导出
- 遵循插件开发边界规则

## 查阅日志

- 2026-07-01: 初始生成（Loop Engineering 改造项目）
