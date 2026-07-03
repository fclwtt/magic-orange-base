# ADR-0001: 底座提取策略

**状态**: ✅ 已解决（2026-07-02）
**关联**: decision-map: src-split, consumption, engineering, naming

## 背景

Magic Orange Base 从 OpenClaw 项目提取。需要确定提取粒度、消费方式和命名方案。

## 决策

### 1. 拆分粒度 — 全部保留

整个 `src/` 都保留，不做裁剪。核心引擎层（config/infra/plugins/agents 等 9 个模块）+ 产品功能层（channels/gateway/cli 等 10+ 模块）全部提取。

### 2. 消费方式 — 独立部署的应用

每个垂直产品独立部署，引用底座作为依赖。底座作为完整运行时提供，而非库。

### 3. 工程操作 — 源码提取

提取 `src/` + 必要依赖，重新组织成可独立运行的项目。对等保留 6 个核心包。

### 4. 命名方案

| 层级 | 命名 | 示例 |
|------|------|------|
| 底座项目 | `magic-orange-base` | CLI 命令 `mo` |
| 垂直产品 | `magic-orange-<领域名>` | `magic-orange-legal` |
| npm 包名 | 内部保留 `@openclaw/*` | `@openclaw/agent-core`（暂不重命名） |

## 理由

- 完整保留 src/ 确保向后兼容，不会被裁剪遗漏关键路径
- 独立部署方式最适合垂直领域产品的使用场景
- 源码提取优于 patch 方式，避免累积技术债务
- npm 包名暂不重命名以减少变更风险

## 影响

- 底座项目体积较大（~3000-4000 文件的最小提取）
- 后续可以通过 tree-shaking 和按需加载优化
