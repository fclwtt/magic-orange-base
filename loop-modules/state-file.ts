/**
 * Loop Engineering — StateFile 状态文件模块
 *
 * 实现"状态外置"哲学：每次循环迭代从持久化的文件系统状态开始，
 * 不依赖模型的上下文窗口，彻底解决遗忘和信息漂移问题。
 *
 * 改造难度：★☆☆☆☆（简单）— 纯新增模块，不改任何现有代码
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LoopState, LoopCheckpoint } from './types';

export class StateFile {
  private readonly baseDir: string;

  constructor(baseDir: string = '.loop') {
    this.baseDir = baseDir;
  }

  /**
   * 加载目标的状态。如果不存在则返回初始状态。
   * 支持断点续跑 — 如果上次中断，从这里继续。
   */
  async load(goalId: string): Promise<LoopState> {
    const filePath = this.getPath(goalId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as LoopState;
    } catch {
      return this.createInitial(goalId);
    }
  }

  /**
   * 持久化状态到文件系统
   */
  async save(state: LoopState): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const filePath = this.getPath(state.goalId);
    // 先写临时文件再原子重命名，防止写入中断导致数据损坏
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
  }

  /**
   * 检查目标的状态文件是否存在
   */
  async exists(goalId: string): Promise<boolean> {
    try {
      await fs.access(this.getPath(goalId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 列出所有目标的状态
   */
  async listAll(): Promise<LoopState[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      const states: LoopState[] = [];
      for (const file of files.sort()) {
        if (file.startsWith('state-') && file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.baseDir, file), 'utf-8');
            states.push(JSON.parse(content) as LoopState);
          } catch {
            // 跳过损坏的状态文件
          }
        }
      }
      return states;
    } catch {
      return [];
    }
  }

  /**
   * 删除目标的状态文件
   */
  async remove(goalId: string): Promise<void> {
    try {
      await fs.unlink(this.getPath(goalId));
    } catch {
      // 文件不存在，忽略
    }
  }

  /**
   * 创建检查点（用于长任务的断点续跑）
   */
  async createCheckpoint(
    goalId: string,
    checkpoint: Omit<LoopCheckpoint, 'createdAt'>
  ): Promise<void> {
    const state = await this.load(goalId);
    state.checkpoint = {
      ...checkpoint,
      createdAt: new Date().toISOString(),
    };
    state.lastUpdatedAt = new Date().toISOString();
    await this.save(state);
  }

  /**
   * 恢复检查点
   */
  async getCheckpoint(goalId: string): Promise<LoopCheckpoint | undefined> {
    const state = await this.load(goalId);
    return state.checkpoint;
  }

  /**
   * 导出状态为人类可读的摘要（用于调试和日志）
   */
  async exportSummary(goalId: string): Promise<string> {
    const state = await this.load(goalId);
    const lines = [
      `# Loop State: ${state.goalId}`,
      ``,
      `- Status: ${state.completed ? '✅ Completed' : '🔄 Running'}`,
      `- Turns: ${state.turns}`,
      `- Tokens Used: ${state.tokensUsed}`,
      `- Started: ${state.startedAt}`,
      `- Last Updated: ${state.lastUpdatedAt}`,
      `- Artifacts: ${state.artifacts.length}`,
      `- Messages: ${state.messages.length}`,
    ];

    if (state.lastGateFailure) {
      lines.push(``, `## Last Gate Failure`, `- Command: ${state.lastGateFailure.command}`, `- Error: ${state.lastGateFailure.stderr.slice(0, 200)}`);
    }

    if (state.lastEvaluation) {
      lines.push(``, `## Last Evaluation`, `- Verdict: ${state.lastEvaluation.verdict}`, `- Confidence: ${state.lastEvaluation.confidence}`, `- Reason: ${state.lastEvaluation.reason.slice(0, 200)}`);
    }

    if (state.checkpoint) {
      lines.push(
        ``,
        `## Checkpoint: ${state.checkpoint.name}`,
        `- Completed Steps: ${state.checkpoint.completedSteps.length}`,
        `- Remaining Steps: ${state.checkpoint.remainingSteps.length}`
      );
    }

    return lines.join('\n');
  }

  private getPath(goalId: string): string {
    return path.join(this.baseDir, `state-${goalId}.json`);
  }

  private createInitial(goalId: string): LoopState {
    const now = new Date().toISOString();
    return {
      goalId,
      turns: 0,
      tokensUsed: 0,
      completed: false,
      messages: [],
      artifacts: [],
      startedAt: now,
      lastUpdatedAt: now,
    };
  }
}
