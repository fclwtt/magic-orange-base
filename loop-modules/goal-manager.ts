/**
 * Loop Engineering — GoalManager 目标管理器
 *
 * 管理目标的生命周期：创建 → 运行 → 完成/失败。
 * 目标持久化到文件系统（状态外置哲学）。
 *
 * 改造难度：★★★☆☆（中等）
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { GoalDefinition, GoalRuntimeState, GoalStatus } from './types';

export class GoalManager {
  private readonly goalsDir: string;

  constructor(goalsDir: string = '.loop') {
    this.goalsDir = goalsDir;
  }

  /**
   * 创建新目标
   */
  async create(input: Omit<GoalDefinition, 'id'>): Promise<GoalDefinition> {
    const goal: GoalDefinition = {
      ...input,
      id: this.generateId(),
    };

    await this.save(goal);

    const state: GoalRuntimeState = {
      goalId: goal.id,
      status: 'pending',
      turns: 0,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.saveRuntimeState(state);

    return goal;
  }

  /**
   * 从快捷参数创建目标（类似 /goal 命令）
   */
  async createFromPrompt(
    criteria: string,
    options: {
      maxTurns?: number;
      gateCommands?: string[];
      evaluatorModel?: string;
      executorModel?: string;
      skillPath?: string;
    } = {}
  ): Promise<GoalDefinition> {
    return this.create({
      description: criteria,
      completionCriteria: criteria,
      maxTurns: options.maxTurns ?? 30,
      gateCommands: options.gateCommands,
      evaluatorModel: options.evaluatorModel,
      executorModel: options.executorModel,
      skillPath: options.skillPath,
    });
  }

  /**
   * 获取目标定义
   */
  async get(goalId: string): Promise<GoalDefinition | undefined> {
    try {
      const content = await fs.readFile(this.getGoalPath(goalId), 'utf-8');
      return JSON.parse(content) as GoalDefinition;
    } catch {
      return undefined;
    }
  }

  /**
   * 获取目标运行时状态
   */
  async getRuntimeState(goalId: string): Promise<GoalRuntimeState | undefined> {
    try {
      const content = await fs.readFile(this.getStatePath(goalId), 'utf-8');
      return JSON.parse(content) as GoalRuntimeState;
    } catch {
      return undefined;
    }
  }

  /**
   * 更新目标状态
   */
  async updateStatus(
    goalId: string,
    status: GoalStatus,
    extra?: Partial<GoalRuntimeState>
  ): Promise<void> {
    const state = await this.getRuntimeState(goalId);
    if (!state) throw new Error(`Goal runtime state not found: ${goalId}`);

    state.status = status;
    state.updatedAt = new Date().toISOString();

    if (extra) {
      if (extra.turns !== undefined) state.turns = extra.turns;
      if (extra.tokensUsed !== undefined) state.tokensUsed = extra.tokensUsed;
      if (extra.completedAt !== undefined) state.completedAt = extra.completedAt;
      if (extra.failedReason !== undefined) state.failedReason = extra.failedReason;
    }

    if (status === 'completed' || status === 'failed' || status === 'impossible') {
      state.completedAt = new Date().toISOString();
    }

    await this.saveRuntimeState(state);
  }

  /**
   * 列出所有目标
   */
  async list(filter?: { status?: GoalStatus }): Promise<Array<GoalDefinition & { runtime: GoalRuntimeState }>> {
    try {
      await fs.mkdir(this.goalsDir, { recursive: true });
      const files = await fs.readdir(this.goalsDir);
      const results: Array<GoalDefinition & { runtime: GoalRuntimeState }> = [];

      for (const file of files.sort()) {
        if (file.startsWith('goal-') && file.endsWith('.json')) {
          try {
            const goalContent = await fs.readFile(path.join(this.goalsDir, file), 'utf-8');
            const goal = JSON.parse(goalContent) as GoalDefinition;
            const runtime = await this.getRuntimeState(goal.id);
            if (!runtime) continue;

            if (filter?.status && runtime.status !== filter.status) continue;
            results.push({ ...goal, runtime });
          } catch {
            // 跳过损坏文件
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * 列出活跃目标（pending + running）
   */
  async listActive(): Promise<Array<GoalDefinition & { runtime: GoalRuntimeState }>> {
    const all = await this.list();
    return all.filter((g) => g.runtime.status === 'pending' || g.runtime.status === 'running');
  }

  /**
   * 删除目标及其状态
   */
  async remove(goalId: string): Promise<void> {
    try { await fs.unlink(this.getGoalPath(goalId)); } catch { /* ignore */ }
    try { await fs.unlink(this.getStatePath(goalId)); } catch { /* ignore */ }
  }

  /**
   * 生成目标摘要（用于系统提示词注入）
   */
  async generateSummary(goalId: string): Promise<string> {
    const goal = await this.get(goalId);
    const state = await this.getRuntimeState(goalId);
    if (!goal || !state) return '';

    const lines = [
      `## 当前目标`,
      `${goal.description}`,
      ``,
      `## 完成标准`,
      `${goal.completionCriteria}`,
      ``,
      `## 进度`,
      `- 轮次: ${state.turns} / ${goal.maxTurns}`,
      `- Token: ${state.tokensUsed}${goal.maxTokens ? ` / ${goal.maxTokens}` : ''}`,
      `- 状态: ${state.status}`,
    ];

    if (goal.gateCommands?.length) {
      lines.push(``, `## 闸门命令`, goal.gateCommands.map((c) => `- \`${c}\``).join('\n'));
    }

    return lines.join('\n');
  }

  private async save(goal: GoalDefinition): Promise<void> {
    await fs.mkdir(this.goalsDir, { recursive: true });
    await fs.writeFile(this.getGoalPath(goal.id), JSON.stringify(goal, null, 2), 'utf-8');
  }

  private async saveRuntimeState(state: GoalRuntimeState): Promise<void> {
    await fs.mkdir(this.goalsDir, { recursive: true });
    await fs.writeFile(this.getStatePath(state.goalId), JSON.stringify(state, null, 2), 'utf-8');
  }

  private getGoalPath(goalId: string): string {
    return path.join(this.goalsDir, `goal-${goalId}.json`);
  }

  private getStatePath(goalId: string): string {
    return path.join(this.goalsDir, `runtime-${goalId}.json`);
  }

  private generateId(): string {
    return crypto.randomUUID().slice(0, 8);
  }
}
