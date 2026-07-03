/**
 * Loop Engineering — 共享类型定义
 *
 * 定义 Outer Loop 编排层所需的所有核心类型。
 * 这些类型与 OpenClaw 核心（agent-core）的类型系统兼容。
 */

// ============================================================
// Goal 目标定义
// ============================================================

/** 目标状态 */
export type GoalStatus = 'pending' | 'running' | 'completed' | 'failed' | 'impossible' | 'paused';

/** 目标定义 — 描述一个 Loop 要完成什么 */
export interface GoalDefinition {
  /** 唯一标识 */
  id: string;
  /** 目标描述（自然语言） */
  description: string;
  /** 可验证的完成条件（用于评估器判断） */
  completionCriteria: string;
  /** 最大迭代轮次（防止无限循环） */
  maxTurns: number;
  /** Token 预算上限（可选） */
  maxTokens?: number;
  /** 闸门检查命令（如 ["npm test", "npm run lint"]） */
  gateCommands?: string[];
  /** 评估者使用的模型（默认用小模型降低成本） */
  evaluatorModel?: string;
  /** 执行者使用的模型 */
  executorModel?: string;
  /** 目标优先级 */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** 关联的 Skill 文件路径 */
  skillPath?: string;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
}

/** 目标运行时状态 */
export interface GoalRuntimeState {
  goalId: string;
  status: GoalStatus;
  turns: number;
  tokensUsed: number;
  completedAt?: string;
  failedReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Loop State 循环状态（状态外置）
// ============================================================

/** 单次 Loop 运行的完整状态（持久化到文件） */
export interface LoopState {
  /** 关联的目标 ID */
  goalId: string;
  /** 当前轮次 */
  turns: number;
  /** 累计 Token 用量 */
  tokensUsed: number;
  /** 是否已完成 */
  completed: boolean;
  /** 上一次闸门失败信息 */
  lastGateFailure?: GateResult;
  /** 上一次评估结果 */
  lastEvaluation?: EvaluationResult;
  /** 对话消息历史 */
  messages: LoopMessage[];
  /** 产出物路径列表 */
  artifacts: string[];
  /** 循环开始时间 */
  startedAt: string;
  /** 最后更新时间 */
  lastUpdatedAt: string;
  /** 中间检查点（可选） */
  checkpoint?: LoopCheckpoint;
}

/** 循环消息 */
export interface LoopMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/** 检查点（支持断点续跑） */
export interface LoopCheckpoint {
  /** 检查点名称 */
  name: string;
  /** 完成的步骤 */
  completedSteps: string[];
  /** 剩余步骤 */
  remainingSteps: string[];
  /** 检查点数据 */
  data: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
}

// ============================================================
// Gate 闸门
// ============================================================

/** 闸门检查结果 */
export interface GateResult {
  /** 是否全部通过 */
  passed: boolean;
  /** 执行的命令 */
  command: string;
  /** 退出码 */
  exitCode: number;
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 所有命令的结果（批量检查时） */
  details?: GateCommandResult[];
}

/** 单条闸门命令结果 */
export interface GateCommandResult {
  command: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

// ============================================================
// Evaluation 对抗验证
// ============================================================

/** 评估判定 */
export type EvalVerdict = 'ok' | 'false' | 'impossible';

/** 评估请求 */
export interface EvaluationRequest {
  /** 完成标准 */
  criteria: string;
  /** Agent 的工作产出摘要 */
  workSummary: string;
  /** 闸门检查结果 */
  gateResult?: GateResult;
  /** 评估者使用的模型 */
  model: string;
  /** 当前轮次 */
  turn: number;
  /** 历史评估结果 */
  previousEvaluations?: EvaluationResult[];
}

/** 评估结果 */
export interface EvaluationResult {
  /** 判定 */
  verdict: EvalVerdict;
  /** 理由 */
  reason: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 消耗的 Token */
  tokensUsed: number;
  /** 评估时间 */
  evaluatedAt: string;
  /** 改进建议 */
  suggestions?: string[];
}

// ============================================================
// Automation 自动化调度
// ============================================================

/** 自动化规则 */
export interface AutomationRule {
  /** 唯一标识 */
  id: string;
  /** 规则名称 */
  name: string;
  /** 调度规则（cron 表达式或间隔字符串如 "2m", "30m", "1h"） */
  schedule: string;
  /** 目标模板（每次触发时基于此创建新目标） */
  goalTemplate: Omit<GoalDefinition, 'id'>;
  /** 是否启用 */
  enabled: boolean;
  /** 上次运行时间 */
  lastRun?: string;
  /** 下次运行时间 */
  nextRun?: string;
  /** 最大连续运行次数（防止无限运行） */
  maxRuns?: number;
  /** 已运行次数 */
  runCount: number;
  /** 创建时间 */
  createdAt: string;
}

// ============================================================
// Worktree 工作树
// ============================================================

/** Worktree 信息 */
export interface WorktreeInfo {
  /** Agent ID */
  agentId: string;
  /** 工作目录路径 */
  workdir: string;
  /** 分支名称 */
  branch: string;
  /** 创建时间 */
  createdAt: string;
  /** 是否已合并 */
  merged: boolean;
}

/** 合并结果 */
export interface MergeResult {
  success: boolean;
  branch: string;
  error?: string;
  conflicts?: string[];
}

// ============================================================
// Loop Result 循环结果
// ============================================================

/** Loop 运行结果状态 */
export type LoopResultStatus =
  | 'completed'
  | 'max_turns_reached'
  | 'budget_exhausted'
  | 'impossible'
  | 'aborted'
  | 'error'
  | 'already_done';

/** Loop 运行结果 */
export interface LoopResult {
  status: LoopResultStatus;
  state: LoopState;
  reason?: string;
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 评估历史 */
  evaluations: EvaluationResult[];
  /** 闸门失败历史 */
  gateFailures: GateResult[];
}

// ============================================================
// Outer Loop 配置
// ============================================================

/** Outer Loop 全局配置 */
export interface OuterLoopConfig {
  /** 状态文件存储目录（默认 .loop/） */
  stateDir: string;
  /** Worktree 存储目录（默认 .worktrees/） */
  worktreeDir: string;
  /** 自动化规则存储路径（默认 .loop/automations.json） */
  automationsPath: string;
  /** 目标存储路径（默认 .loop/goals.json） */
  goalsPath: string;
  /** 默认评估者模型 */
  defaultEvaluatorModel: string;
  /** 默认执行者模型 */
  defaultExecutorModel: string;
  /** 默认最大轮次 */
  defaultMaxTurns: number;
  /** 默认 Token 预算 */
  defaultMaxTokens?: number;
  /** 闸门超时（毫秒，默认 60000） */
  gateTimeout: number;
  /** 是否启用 Worktree 隔离 */
  enableWorktree: boolean;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** 默认配置 */
export const DEFAULT_LOOP_CONFIG: OuterLoopConfig = {
  stateDir: '.loop',
  worktreeDir: '.worktrees',
  automationsPath: '.loop/automations.json',
  goalsPath: '.loop/goals.json',
  defaultEvaluatorModel: 'gemini-2.5-flash',
  defaultExecutorModel: 'gpt-4.1',
  defaultMaxTurns: 30,
  gateTimeout: 60000,
  enableWorktree: false,
  logLevel: 'info',
};
