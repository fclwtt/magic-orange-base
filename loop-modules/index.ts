/**
 * Loop Engineering — 模块导出入口
 *
 * 所有新增模块的统一导出点。
 */

// 类型定义
export type {
  GoalDefinition,
  GoalStatus,
  GoalRuntimeState,
  LoopState,
  LoopMessage,
  LoopCheckpoint,
  LoopResult,
  LoopResultStatus,
  GateResult,
  GateCommandResult,
  EvaluationRequest,
  EvaluationResult,
  EvalVerdict,
  AutomationRule,
  WorktreeInfo,
  MergeResult,
  OuterLoopConfig,
} from './types';

export { DEFAULT_LOOP_CONFIG } from './types';

// 核心模块
export { OuterLoop } from './outer-loop';
export type { InnerLoopFn, OuterLoopEvents } from './outer-loop';

// 支撑模块
export { StateFile } from './state-file';
export { GateRunner } from './gate-runner';
export type { GateRunnerOptions } from './gate-runner';
export { AdversarialEvaluator } from './adversarial-evaluator';
export type { LLMCallFn } from './adversarial-evaluator';
export { GoalManager } from './goal-manager';
export { AutomationScheduler } from './automation-scheduler';
export type { AutomationTriggerFn } from './automation-scheduler';
export { WorktreeManager } from './worktree-manager';
