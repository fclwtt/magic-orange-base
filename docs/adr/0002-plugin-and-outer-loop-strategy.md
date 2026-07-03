# ADR-0002: 插件与 Outer Loop 策略

**状态**: ✅ 已解决（2026-07-02）
**关联**: decision-map: plugin-strategy, loop-modules, outer-loop, core-plugins

## 背景

底座需要确定哪些插件内置、哪些按需选择，以及 Outer Loop 编排层的定位。

## 决策

### 1. 插件策略 — 核心必选 + 可选扩展

核心必选插件（底座内置）：openai、anthropic、memory-core、diffs、openshell、policy、oc-path。

可选插件（按需安装）：duckduckgo、browser 及其他 127+ 插件从 OpenClaw 插件库按需选择。

### 2. Outer Loop 定位 — 可选增值模块

- 底座核心 = OpenClaw src（Inner Loop 执行引擎）
- `loop-modules/` 作为可选增值模块，不强制依赖
- 统一发布为 `@magic-orange/loop-core` npm 包
- 导出领域预设：legalPreset、medicalPreset、financePreset
- 垂直产品可选择预设或完全自定义

## 理由

- 插件分离让底座保持轻量，只有 8 个必选，避免"全家桶"式捆绑
- Outer Loop 作为可选模块，使得不需要编排的场景（简单问答）可以跳过
- 领域预设降低垂直产品的集成成本

## 影响

- 插件通过动态加载机制接入，非硬编码依赖
- 需维护插件清单（核心 vs 可选）和版本兼容性
- `loop-modules/` 后续需重构为依赖注入模式以支持可插拔后端
