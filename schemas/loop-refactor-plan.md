# Loop Modules 改造方案

> 生成时间: 2026-07-02
> 目标: 将 `loop-modules/` 改造为可选增值模块，发布为 `@magic-orange/loop-core`

## 当前状态

`loop-modules/` 包含 8 个 TypeScript 文件，实现了 Outer Loop 编排层：

| 文件 | 职责 | 当前实现 |
|------|------|----------|
| `types.ts` | 共享类型定义 | 接口 + 类型 ✅ |
| `outer-loop.ts` | 核心编排器 | 具体类，直接实例化依赖 ❌ |
| `state-file.ts` | 状态持久化 | 具体类，硬编码文件系统 ❌ |
| `gate-runner.ts` | 硬闸门检查 | 具体类 ❌ |
| `adversarial-evaluator.ts` | 对抗验证 | 具体类，但 LLM 通过注入 ✅ |
| `goal-manager.ts` | 目标管理 | 具体类，硬编码文件系统 ❌ |
| `automation-scheduler.ts` | 定时调度 | 具体类 ❌ |
| `worktree-manager.ts` | Git 隔离 | 具体类 ❌ |

## 改造目标

1. **依赖倒置** — 提取接口，OuterLoop 通过接口注入依赖
2. **存储可插拔** — 支持文件/数据库/云存储后端
3. **领域预设** — 导出 `legalPreset`、`medicalPreset` 等预设配置
4. **独立发布** — 打包为 `@magic-orange/loop-core` npm 包

## 改造步骤

### Step 1: 提取接口

```typescript
// interfaces.ts

/** 状态存储接口 */
export interface IStateStore {
  load(goalId: string): Promise<LoopState>;
  save(state: LoopState): Promise<void>;
  listAll(): Promise<LoopState[]>;
  delete(goalId: string): Promise<void>;
}

/** 闸门执行器接口 */
export interface IGateRunner {
  check(commands: string[]): Promise<GateResult>;
  checkSingle(command: string): Promise<GateCommandResult>;
}

/** 目标管理接口 */
export interface IGoalManager {
  create(input: Omit<GoalDefinition, 'id'>): Promise<GoalDefinition>;
  get(goalId: string): Promise<GoalDefinition | undefined>;
  updateStatus(goalId: string, status: GoalStatus, runtime?: Partial<GoalRuntimeState>): Promise<void>;
  list(filter?: { status?: GoalStatus }): Promise<GoalDefinition[]>;
}

/** 评估器接口 */
export interface IEvaluator {
  evaluate(request: EvaluationRequest): Promise<EvaluationResult>;
  evaluateWithHistory(request: EvaluationRequest, history: EvaluationResult[]): Promise<EvaluationResult>;
}
```

### Step 2: 改造 OuterLoop 依赖注入

```typescript
// outer-loop.ts (改造后)

export class OuterLoop {
  constructor(deps: {
    innerLoop: InnerLoopFn;
    stateStore: IStateStore;        // 接口注入
    gateRunner: IGateRunner;        // 接口注入
    evaluator: IEvaluator;          // 接口注入
    goalManager: IGoalManager;      // 接口注入
    config?: Partial<OuterLoopConfig>;
    events?: OuterLoopEvents;
  }) {
    // ...
  }
}
```

### Step 3: 实现默认后端

```typescript
// backends/file-state-store.ts
export class FileStateStore implements IStateStore {
  // 当前 StateFile 的逻辑搬到这里
}

// backends/sqlite-state-store.ts (未来扩展)
export class SQLiteStateStore implements IStateStore {
  // 基于 SQLite 的实现
}
```

### Step 4: 添加领域预设

```typescript
// presets/index.ts

export const legalPreset: OuterLoopConfig = {
  defaultEvaluatorModel: 'gpt-4',  // 法律需要更强的评估
  defaultExecutorModel: 'gpt-4.1',
  defaultMaxTurns: 50,             // 法律任务更复杂
  gateTimeout: 120000,             // 合规检查更慢
  // ...
};

export const medicalPreset: OuterLoopConfig = {
  defaultEvaluatorModel: 'claude-3-opus',  // 医学需要更严谨
  // ...
};

export const financePreset: OuterLoopConfig = {
  // ...
};
```

### Step 5: 打包配置

```json
// loop-modules/package.json
{
  "name": "@magic-orange/loop-core",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./presets": "./dist/presets/index.js",
    "./backends": "./dist/backends/index.js"
  }
}
```

## 垂直产品使用方式

```typescript
// magic-orange-legal/index.ts

import { OuterLoop, FileStateStore, GateRunner, AdversarialEvaluator, GoalManager } from '@magic-orange/loop-core';
import { legalPreset } from '@magic-orange/loop-core/presets';
import { createOpenClawAgent } from 'magic-orange-base';

const agent = createOpenClawAgent({
  systemPrompt: '你是一个专业法律咨询助手...',
  plugins: ['openai', 'memory-core', 'legal-search'],
});

const loop = new OuterLoop({
  innerLoop: agent.run.bind(agent),
  stateStore: new FileStateStore('.loop'),
  gateRunner: new GateRunner({ timeout: 120000 }),
  evaluator: new AdversarialEvaluator(agent.llmCall.bind(agent)),
  goalManager: new GoalManager('.loop'),
  config: legalPreset,
});

// 运行法律相关任务
await loop.run({
  id: 'case-001',
  description: '分析这个合同纠纷案例...',
  completionCriteria: '提供完整的法律分析报告',
  maxTurns: 50,
  gateCommands: ['npm run legal-compliance-check'],
});
```

## 改造工作量估算

| 步骤 | 工作量 | 优先级 |
|------|--------|--------|
| 提取接口 | 2-3 小时 | P0 |
| 改造 OuterLoop 依赖注入 | 1-2 小时 | P0 |
| 实现 FileStateStore 等默认后端 | 2-3 小时 | P0 |
| 添加领域预设 | 1 小时 | P1 |
| 打包配置 | 1 小时 | P1 |
| 编写文档 | 1-2 小时 | P2 |
| **总计** | 8-12 小时 | |
