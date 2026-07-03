# Domain Docs

Engineering skills 探索 codebase 时，应如何消费这个 repo 的 domain documentation。

## Before exploring, read these

- repo 根目录的 **`CONTEXT.md`**，或
- repo 根目录的 **`CONTEXT-MAP.md`**（如果存在）— 它指向每个 context 的一个 `CONTEXT.md`。读取与当前话题相关的每个文件。
- **`docs/adr/`** — 读取与你即将处理区域相关的 ADRs。在 multi-context repos 中，也检查 `src/<context>/docs/adr/` 中的 context-scoped decisions。

如果这些文件不存在，**静默继续**。不要标记缺失；不要提前建议创建。producer skill（`/grill-with-docs`）会在 terms 或 decisions 实际被解决时懒创建它们。
### Additionally, read these schemas/ files

这个 repo 的知识沉淀在 `schemas/` 目录中，技能在探索时应同时查阅：

- **`schemas/index.md`** — 知识库索引，所有参考手册的总入口
- **`schemas/decision-map.md`** — 架构决策地图（已解决的 / 待解决的问题追踪）
- **`schemas/rules/query.md`** — 如何在项目中查阅知识
- **`schemas/rules/ingest.md`** — 如何将新发现回补到知识库

根据任务需要，还可查阅：
- **`schemas/dependency-analysis.md`** — 依赖分析报告
- **`schemas/analysis-report.md`** — Loop Engineering 分析
- **`schemas/magic-orange-base-detailed-review.md`** — 框架结构详细审查
- **`schemas/references/`** — 上游项目参考手册（OpenClaw、Hermes Agent）

查阅顺序：先读 `schemas/index.md` 定位，再按需深入具体文档。
使用 glossary 中定义的术语，避免使用模糊同义词。

## File structure

Single-context repo（当前仓库）：

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo（根目录存在 `CONTEXT-MAP.md`）：

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

当你的输出命名某个 domain concept 时（issue title、refactor proposal、hypothesis、test name），使用 `CONTEXT.md` 中定义的 term。不要漂移到 glossary 明确避免的 synonyms。

如果你需要的概念还不在 glossary 中，这是一个信号：要么你正在发明项目没有使用的语言（重新考虑），要么确实存在缺口（为 `/grill-with-docs` 记录）。


如果你的输出与现有 ADR 矛盾，明确指出，而不是静默覆盖：

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
### With schemas knowledge base (this repo)

```
/
├── CONTEXT.md                       ← 领域术语表（本文件）
├── docs/
│   ├── agents/                      ← agent 技能配置
│   │   ├── issue-tracker.md
│   │   ├── triage-labels.md
│   │   └── domain.md
│   └── adr/                         ← 架构决策记录（尚未创建）
├── schemas/                         ← 项目知识库
│   ├── index.md                     ← 知识库索引
│   ├── decision-map.md              ← 决策地图
│   ├── dependency-analysis.md       ← 依赖分析
│   ├── analysis-report.md           ← Loop 分析报告
│   ├── architecture-review-*.md     ← 架构审查报告
│   ├── references/                  ← 上游参考手册
│   └── rules/                       ← 查阅与回补规则
└── src/
```

## Flag conflicts with schemas/ decisions

当你的输出与 `schemas/decision-map.md` 中的已解决决策矛盾时，明确指出，而不是静默覆盖：

> _Contradicts decision-map: plugin-strategy (core-only for base) — but worth reopening because…_

同样，如果与 `schemas/` 中的架构审查或分析报告有冲突，也需明确标记。
