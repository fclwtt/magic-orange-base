/**
 * Loop Engineering — OuterLoop 编排器（核心模块）
 *
 * 这是整个 Loop Engineering 改造的核心。
 * 它在 OpenClaw 现有的 Inner Loop（runAgentLoop）外面包一层编排层，
 * 实现"目标驱动 → 执行 → 闸门验证 → 对抗评估 → 迭代"的闭环。
 *
 * 设计原则：
 * 1. 不改 Inner Loop — runAgentLoop 保持原样
 * 2. 利用现有钩子 — prepareNextTurn / shouldStopAfterTurn / getSteeringMessages
 * 3. 状态外置 — 所有状态持久化到文件系统
 * 4. 对抗验证 — 执行者和评估者分离
 *
 * 对应架构：
 *   Outer Loop（本模块）: 目标拆解 → 执行 → 闸门 → 评估 → 再计划
 *       ↓
 *   Inner Loop (runAgentLoop): 感知 → 推理 → 行动 → 观察（已有，不改）
 */

import type {
  GoalDefinition,
  LoopState,
  LoopResult,
  LoopResultStatus,
  LoopMessage,
  GateResult,
  EvaluationResult,
  OuterLoopConfig,
} from './types';
import { DEFAULT_LOOP_CONFIG } from './types';
import { StateFile } from './state-file';
import { GateRunner } from './gate-runner';
import { AdversarialEvaluator, type LLMCallFn } from './adversarial-evaluator';
import { GoalManager } from './goal-manager';

/**
 * Inner Loop 接口 — 与 OpenClaw 的 runAgentLoop 兼容
 * 实际使用时通过依赖注入传入
 */
export interface InnerLoopFn {
  (params: {
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    model?: string;
    cwd?: string;
    onDelta?: (text: string) => void;
    signal?: AbortSignal;
  }): Promise<{
    messages: Array<{ role: string; content: string }>;
    tokensUsed: number;
    stopReason: string;
  }>;
}

/** OuterLoop 事件回调 */
export interface OuterLoopEvents {
  onTurnStart?: (turn: number, state: LoopState) => void;
  onTurnEnd?: (turn: number, state: LoopState) => void;
  onGateCheck?: (result: GateResult) => void;
  onEvaluation?: (result: EvaluationResult) => void;
  onGoalCompleted?: (goal: GoalDefinition, state: LoopState) => void;
  onGoalFailed?: (goal: GoalDefinition, state: LoopState, reason: string) => void;
  onError?: (error: Error) => void;
}

export class OuterLoop {
  private readonly config: OuterLoopConfig;
  private readonly stateFile: StateFile;
  private readonly gateRunner: GateRunner;
  private readonly evaluator: AdversarialEvaluator;
  private readonly goalManager: GoalManager;
  private readonly innerLoop: InnerLoopFn;
  private readonly events: OuterLoopEvents;

  constructor(deps: {
    innerLoop: InnerLoopFn;
    llmCall: LLMCallFn;
    config?: Partial<OuterLoopConfig>;
    events?: OuterLoopEvents;
  }) {
    this.config = { ...DEFAULT_LOOP_CONFIG, ...deps.config };
    this.innerLoop = deps.innerLoop;
    this.evaluator = new AdversarialEvaluator(deps.llmCall);
    this.events = deps.events ?? {};

    this.stateFile = new StateFile(this.config.stateDir);
    this.gateRunner = new GateRunner({ timeout: this.config.gateTimeout });
    this.goalManager = new GoalManager(this.config.stateDir);
  }

  /**
   * 运行一个目标直到完成或达到限制
   *
   * 这是 Loop Engineering 的核心入口。
   * 执行流程：
   *   1. 加载/初始化状态（状态外置）
   *   2. 循环：
   *     a. 检查预算（轮次/Token）
   *     b. 构建系统提示词（注入目标 + 状态 + 反馈）
   *     c. 调用 Inner Loop 执行一轮
   *     d. 运行硬闸门检查
   *     e. 对抗验证评估
   *     f. 持久化状态
   *   3. 返回结果
   */
  async run(goal: GoalDefinition, signal?: AbortSignal): Promise<LoopResult> {
    const startTime = Date.now();
    const evaluations: EvaluationResult[] = [];
    const gateFailures: GateResult[] = [];

    // 1. 加载或初始化状态
    let state = await this.stateFile.load(goal.id);

    if (state.completed) {
      return {
        status: 'already_done',
        state,
        totalDuration: 0,
        evaluations,
        gateFailures,
      };
    }

    // 标记目标为运行中
    await this.goalManager.updateStatus(goal.id, 'running');

    try {
      while (!state.completed) {
        // 检查 abort 信号
        if (signal?.aborted) {
          return this.buildResult('aborted', state, startTime, evaluations, gateFailures, 'Aborted by user');
        }

        // 2. 检查预算
        if (state.turns >= goal.maxTurns) {
          return this.buildResult('max_turns_reached', state, startTime, evaluations, gateFailures);
        }
        if (goal.maxTokens && state.tokensUsed >= goal.maxTokens) {
          return this.buildResult('budget_exhausted', state, startTime, evaluations, gateFailures);
        }

        // 3. 事件：轮次开始
        this.events.onTurnStart?.(state.turns + 1, state);

        // 4. 构建系统提示词
        const systemPrompt = await this.buildSystemPrompt(goal, state);

        // 5. 调用 Inner Loop 执行一轮
        const result = await this.innerLoop({
          systemPrompt,
          messages: state.messages.map((m) => ({ role: m.role, content: m.content })),
          model: goal.executorModel ?? this.config.defaultExecutorModel,
          signal,
        });

        // 6. 更新状态
        state.turns++;
        state.tokensUsed += result.tokensUsed;
        state.messages = result.messages.map((m) => ({
          role: m.role as LoopMessage['role'],
          content: m.content,
          timestamp: new Date().toISOString(),
        }));
        state.lastUpdatedAt = new Date().toISOString();

        // 7. 硬闸门验证
        if (goal.gateCommands?.length) {
          const gateResult = await this.gateRunner.check(goal.gateCommands);
          this.events.onGateCheck?.(gateResult);

          if (!gateResult.passed) {
            state.lastGateFailure = gateResult;
            gateFailures.push(gateResult);
            // 闸门失败 → 不评估，直接进入下一轮让 Agent 修复
            await this.stateFile.save(state);
            this.events.onTurnEnd?.(state.turns, state);
            continue;
          }
          // 闸门通过，清除失败标记
          state.lastGateFailure = undefined;
        }

        // 8. 对抗验证 — 独立评估者判断目标是否达成
        const workSummary = this.extractWorkSummary(result.messages);
        const evaluation = await this.evaluator.evaluateWithHistory(
          {
            criteria: goal.completionCriteria,
            workSummary,
            gateResult: state.lastGateFailure,
            model: goal.evaluatorModel ?? this.config.defaultEvaluatorModel,
            turn: state.turns,
            previousEvaluations: evaluations,
          },
          evaluations
        );

        evaluations.push(evaluation);
        state.lastEvaluation = evaluation;
        this.events.onEvaluation?.(evaluation);

        if (evaluation.verdict === 'ok') {
          state.completed = true;
          await this.stateFile.save(state);
          await this.goalManager.updateStatus(goal.id, 'completed', {
            turns: state.turns,
            tokensUsed: state.tokensUsed,
          });
          this.events.onGoalCompleted?.(goal, state);
          return this.buildResult('completed', state, startTime, evaluations, gateFailures);
        }

        if (evaluation.verdict === 'impossible') {
          await this.stateFile.save(state);
          await this.goalManager.updateStatus(goal.id, 'impossible', {
            turns: state.turns,
            tokensUsed: state.tokensUsed,
            failedReason: evaluation.reason,
          });
          this.events.onGoalFailed?.(goal, state, evaluation.reason);
          return this.buildResult('impossible', state, startTime, evaluations, gateFailures, evaluation.reason);
        }

        // verdict === 'false' → 继续循环
        await this.stateFile.save(state);
        this.events.onTurnEnd?.(state.turns, state);
      }

      return this.buildResult('completed', state, startTime, evaluations, gateFailures);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.onError?.(err);
      await this.goalManager.updateStatus(goal.id, 'failed', {
        turns: state.turns,
        tokensUsed: state.tokensUsed,
        failedReason: err.message,
      });
      return this.buildResult('error', state, startTime, evaluations, gateFailures, err.message);
    }
  }

  /**
   * 恢复中断的 Loop（断点续跑）
   */
  async resume(goalId: string, signal?: AbortSignal): Promise<LoopResult> {
    const goal = await this.goalManager.get(goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);
    return this.run(goal, signal);
  }

  /**
   * 获取当前运行中的 Loop 状态
   */
  async getStatus(goalId: string): Promise<LoopState | undefined> {
    return this.stateFile.load(goalId);
  }

  /**
   * 获取所有活跃 Loop 的状态摘要
   */
  async getAllStatus(): Promise<string> {
    const states = await this.stateFile.listAll();
    if (states.length === 0) return 'No active loops.';

    return states
      .map((s) => {
        const icon = s.completed ? '✅' : '🔄';
        return `${icon} ${s.goalId}: turn ${s.turns}, tokens ${s.tokensUsed}${s.completed ? ' (done)' : ''}`;
      })
      .join('\n');
  }

  /**
   * 构建系统提示词 — 这是 Loop Engineering 的关键
   *
   * 每轮的系统提示词都包含：
   * 1. 目标描述和完成标准
   * 2. 当前进度
   * 3. 上一轮闸门失败反馈（如果有）
   * 4. 上一轮评估者反馈（如果有）
   * 5. Skill 文件内容（如果有）
   */
  private async buildSystemPrompt(goal: GoalDefinition, state: LoopState): Promise<string> {
    const sections: string[] = [];

    // 目标
    sections.push(`# 目标\n${goal.description}`);
    sections.push(`# 完成标准\n${goal.completionCriteria}`);

    // 进度
    sections.push(`# 当前进度`);
    sections.push(`- 轮次: ${state.turns + 1} / ${goal.maxTurns}`);
    sections.push(`- Token 已用: ${state.tokensUsed}${goal.maxTokens ? ` / ${goal.maxTokens}` : ''}`);

    // 闸门失败反馈
    if (state.lastGateFailure) {
      sections.push(GateRunner.formatFailureForPrompt(state.lastGateFailure));
    }

    // 评估者反馈
    if (state.lastEvaluation && state.lastEvaluation.verdict === 'false') {
      sections.push(`# 评估者反馈`);
      sections.push(state.lastEvaluation.reason);
      if (state.lastEvaluation.suggestions?.length) {
        sections.push(`## 改进建议`);
        state.lastEvaluation.suggestions.forEach((s) => sections.push(`- ${s}`));
      }
      sections.push(`请根据以上反馈继续改进。`);
    }

    // Skill 文件内容
    if (goal.skillPath) {
      try {
        const { readFile } = await import('node:fs/promises');
        const skillContent = await readFile(goal.skillPath, 'utf-8');
        sections.push(`# 项目知识（Skill）\n${skillContent}`);
      } catch {
        // Skill 文件不存在，忽略
      }
    }

    // 检查点
    if (state.checkpoint) {
      sections.push(`# 检查点: ${state.checkpoint.name}`);
      sections.push(`已完成步骤: ${state.checkpoint.completedSteps.join(', ') || '无'}`);
      sections.push(`剩余步骤: ${state.checkpoint.remainingSteps.join(', ') || '无'}`);
    }

    // 预算提醒
    const remainingTurns = goal.maxTurns - state.turns;
    if (remainingTurns <= 5) {
      sections.push(`# 注意\n仅剩 ${remainingTurns} 轮！请优先完成核心任务。`);
    }

    return sections.join('\n\n');
  }

  private extractWorkSummary(messages: Array<{ role: string; content: string }>): string {
    // 提取最后几条 assistant 消息作为工作摘要
    const assistantMsgs = messages.filter((m) => m.role === 'assistant');
    const last = assistantMsgs.slice(-3);
    return last.map((m) => m.content).join('\n---\n').slice(0, 4000);
  }

  private buildResult(
    status: LoopResultStatus,
    state: LoopState,
    startTime: number,
    evaluations: EvaluationResult[],
    gateFailures: GateResult[],
    reason?: string
  ): LoopResult {
    return {
      status,
      state,
      reason,
      totalDuration: Date.now() - startTime,
      evaluations,
      gateFailures,
    };
  }
}
