# Magic Orange 底座决策地图

> 创建时间: 2026-07-02
> 目标: 将 OpenClaw 的 src/ 拆分为独立的 AI Agent 应用基础底座，支持垂直领域产品通过插件扩展

## 已解决的决策

### src-split: 拆分粒度
Status: resolved
**决策**: 整个 `src/` 都保留，不做裁剪

### consumption: 消费方式
Status: resolved
**决策**: 独立部署的应用（方式A）— 每个垂直产品独立部署，引用底座作为依赖

### engineering: 工程操作
Status: resolved
**决策**: 提取 `src/` + 必要依赖，重新组织成可独立运行的项目（方式B）

### loop-modules: Outer Loop 定位
Status: resolved
**决策**: 底座核心 = OpenClaw src，`loop-modules/` 作为可选增值模块（方式B）

### plugin-strategy: 插件处理策略
Status: resolved
**决策**: 核心必选插件做底座（约 5-8 个），其他 127+ 个放入插件库按需选择

### naming: 命名方案
Status: resolved
**决策**: 
- 底座项目名: `magic-orange-base`
- 垂直产品名: `magic-orange-<领域名>`
- 重命名范围: 方案B — 只替换项目级名称（CLI、仓库名、配置文件），内部 npm 包名（`@openclaw/agent-core` 等）暂时保留

### outer-loop: Outer Loop 管理方式
Status: resolved
**决策**: 统一 npm 包 + 领域预设
- `@magic-orange/loop-core` — 核心逻辑（不变的部分）
- 导出多个预设: `legalPreset`、`medicalPreset`、`financePreset`
- 垂直产品可选择预设或完全自定义

## 开放的问题（Fog of War）

### dependency-map: 依赖关系梳理
Blocked by: 
Status: resolved
Type: Research

**答案**: 详见 `dependency-analysis.md`

**核心发现**:
- `src/` 对 `packages/` 的依赖集中在 **6 个核心包**（normalization-core 1777次、model-catalog-core 168次、media-core 106次、acp-core 90次、fs-safe 51次、net-policy 34次）
- `src/` 对 `extensions/` 只有 26 处引用，且通过插件系统动态加载，非硬编码依赖
- `src/` 内部核心引擎层 9 个模块（config/infra/plugins/agents/shared/utils/logging/state/types）被高频引用
- 第三方依赖 55 个运行时包，核心 20 个必选
- **最小提取**: ~3000-4000 文件（6 packages + 9 src 模块 + 20 deps）
- **完整提取**: ~10000+ 文件（全部 packages + 全部 src + 按需 extensions）

---

### core-plugins: 核心必选插件清单
Blocked by: dependency-map
Status: resolved
Type: Research

**答案**: 基于 `PLUGIN-CATALOG.md` 的最小启动集 + 底座定位，核心必选插件为：

| 插件 | 必要性 | 说明 |
|------|--------|------|
| `openai` | **必需** | LLM 提供商（主选，覆盖 GPT/TTS/DALL-E/嵌入） |
| `anthropic` | **必需** | LLM 提供商（备选，Claude 系列） |
| `memory-core` | **必需** | 基础记忆系统（SQLite），无此则无跨会话记忆 |
| `diffs` | **必需** | 代码差异工具，编程场景基础能力 |
| `openshell` | **必需** | Shell 执行工具，命令执行基础能力 |
| `policy` | **必需** | 权限策略控制，安全基础 |
| `oc-path` | **必需** | 路径处理工具 |
| `skills` | **必需** | 技能管理，Agent 能力扩展基础 |
| `duckduckgo` | 可选 | Web 搜索（免费无需 API Key） |
| `browser` | 可选 | 浏览器自动化（Playwright） |

**总计**: 8 个必选 + 2 个可选 = 10 个核心插件
**插件库**: 剩余 125+ 个插件按需从 `openclaw-disassembled/plugin-library/` 选取

---

### project-structure: 提取后的项目结构
Blocked by: dependency-map, core-plugins
Status: resolved
Type: Prototype

**答案**: 详见 `project-structure-prototype.md`

**通用底座最小提取标准**（重新定义）:

核心原则: **所有垂直产品都会用到的公共能力 = 底座必须包含**

| 类别 | 模块数 | 文件数 | 说明 |
|------|--------|--------|------|
| 核心引擎层 | 9 | ~3000 | Agent 运行必需的基础设施 |
| 通用产品层 | 16 | ~5000 | 所有垂直产品都会用到的公共能力 |
| **通用底座合计** | **25** | **~8000** | |
| 领域可选层 | ~35 | ~1000 | 特定场景才需要 |
| 总计 | ~60 | ~9000 | |

**核心引擎层（9 个）**: agents/config/infra/plugins/shared/utils/logging/state/types

**通用产品层（16 个）**: gateway/cli/llm/channels/routing/sessions/secrets/hooks/tools/context-engine/acp/mcp/memory/process/tasks/auto-reply

**领域可选层（~35 个）**: tui/media*/web-search/web-fetch/image-generation/video-generation/tts/talk/wizard/daemon/cron 等

**结论**: 通用底座 ≈ 完整提取（~8000 vs ~9000），只差一小撮特定场景模块。

**其他**:
- `packages/`: 提取 6 个核心包
- `extensions/`: 提取 10 个核心插件
- `loop-modules/`: 可选增值模块

---

### loop-refactor: loop-modules 改造方案
Blocked by: project-structure
Status: resolved
Type: Prototype

**答案**: 详见 `loop-refactor-plan.md`

**改造步骤**:
1. 提取接口（`IStateStore`、`IGateRunner`、`IGoalManager`、`IEvaluator`）
2. 改造 OuterLoop 为依赖注入
3. 实现默认后端（`FileStateStore` 等）
4. 添加领域预设（`legalPreset`、`medicalPreset`、`financePreset`）
5. 打包为 `@magic-orange/loop-core`

**工作量**: 8-12 小时

---

### rename-scope: 重命名具体范围
Blocked by: project-structure
Status: resolved
Type: Research

**答案**: 方案B — 只替换项目级名称，内部 npm 包名保留

| 类别 | 原名 | 新名 | 影响范围 |
|------|------|------|----------|
| CLI 命令 | `openclaw` | `mo` | package.json bin, src/cli/ |
| 插件清单 | `openclaw.plugin.json` | `mo.plugin.json` | 135 个插件文件 + src/plugins/ 加载逻辑 |
| 环境变量 | `OPENCLAW_*` | `MO_*` | src/ 中 8421 处引用（主要在测试和配置中） |
| 包名 | `openclaw` | `magic-orange-base` | 根 package.json |
| 仓库 URL | `github.com/openclaw/openclaw` | 新仓库地址 | package.json, README |
| README/文档 | OpenClaw | Magic Orange | 项目文档 |

**不改动**:
- 内部 npm 包名 `@openclaw/agent-core` 等 — 保留
- import 路径 `from '@openclaw/...'` — 保留
- 第三方包名引用 — 保留

---

### build-system: 构建系统调整
Blocked by: project-structure
Status: resolved
Type: Prototype

**答案**:

| 文件 | 调整内容 |
|------|----------|
| `package.json` | `name: "openclaw"` → `"magic-orange-base"`；`bin.openclaw` → `bin.mo` |
| `pnpm-workspace.yaml` | 保留 `packages/*` 和 `extensions/*`；移除 `ui`（不需要 Web UI）；添加 `loop-modules` |
| `tsconfig.json` | `paths` 中 `@openclaw/*` 映射保留不动（内部包名不改）；`include` 调整为新的目录结构 |
| `tsconfig.core.json` | 同上，`include` 调整 |
| `tsdown.config.ts` | 构建入口基本不变，只需调整插件构建脚本中的路径 |
| `vitest.config.ts` | 测试配置保留 |

**关键决策**: 由于内部 npm 包名（`@openclaw/*`）不改，`tsconfig.json` 中的 `paths` 映射几乎不需要调整，大幅降低迁移成本。

---

### first-vertical: 第一个垂直领域产品
Blocked by: 
Status: resolved
Type: Grilling

**决策**: 暂不考虑垂直领域产品，先做好通用底座。

**理由**: 
1. 底座应该是通用的，不应过早绑定到特定领域
2. 评估标准、闸门命令等可以先用通用配置，后续接入垂直领域时再调整
3. 领域预设（legalPreset、medicalPreset 等）作为可选扩展包，不是底座核心

**处理方式**:
- 底座提供通用的 Outer Loop 框架和可插拔接口
- 提供默认的通用配置（`defaultPreset`）
- 领域预设作为独立扩展包（`@magic-orange/preset-legal` 等），后续按需开发

## Notes

### 项目命名
- 底座: `magic-orange-base`
- 垂直产品: `magic-orange-<领域名>`
- 不再出现 `openclaw` 字样（项目级）

### 技术栈
- TypeScript (ESM strict)
- Node.js 22.19+
- pnpm monorepo
- SQLite (状态存储)

### 参考资源
- OpenClaw 源码: `E:\aiproject\openclaw`
- OpenClaw 拆解版: `E:\aiproject\openclaw-disassembled`
- 插件分类文档: `schemas/references/openclaw-disassembled.md`
