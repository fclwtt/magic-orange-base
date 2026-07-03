# Magic Orange Base

AI Agent 应用基础底座，提供完整的 Agent 运行时环境、插件系统和多渠道支持。

## 特性

- **Agent 循环引擎**: 完整的 Inner Loop 执行引擎
- **插件系统**: 支持工具、LLM 提供商、渠道等多种插件类型
- **多渠道支持**: 25+ 消息渠道适配（Discord、Telegram、Slack 等）
- **模型路由**: 支持多个 LLM 提供商（OpenAI、Anthropic、Google 等）
- **会话管理**: 多会话并发支持
- **状态持久化**: SQLite 状态存储
- **Outer Loop 编排**: 可选的目标驱动编排层

## 项目结构

```
magic-orange-base/
├── src/                    # 核心源码
│   ├── agents/            # Agent 循环引擎
│   ├── config/            # 配置管理
│   ├── infra/             # 基础设施
│   ├── plugins/           # 插件系统
│   ├── gateway/           # HTTP/WS 网关
│   ├── channels/          # 渠道适配
│   ├── cli/               # 命令行界面
│   └── ...                # 其他模块
├── packages/              # 核心包（6 个）
│   ├── normalization-core/
│   ├── model-catalog-core/
│   ├── media-core/
│   ├── acp-core/
│   └── net-policy/
├── extensions/            # 核心插件（9 个）
│   ├── openai/
│   ├── anthropic/
│   ├── memory-core/
│   ├── diffs/
│   ├── openshell/
│   ├── policy/
│   ├── oc-path/
│   ├── duckduckgo/
│   └── browser/
└── loop-modules/          # 可选 Outer Loop 模块
```

## 安装

```bash
pnpm install
```

## 构建

```bash
pnpm build
```

## 开发

```bash
pnpm dev
```

## 使用

### 启动服务

```bash
mo start
```

### 命令行交互

```bash
mo chat
```

## 配置

复制 `.env.example` 为 `.env` 并配置环境变量：

```bash
cp .env.example .env
```

## 插件开发

参考 `extensions/` 目录中的示例插件。

## 许可证

MIT
