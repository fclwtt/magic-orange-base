/**
 * Loop Engineering — WorktreeManager 工作树隔离模块
 *
 * 通过 Git worktree 为多个 Agent 创建独立工作目录，
 * 防止并行修改同一文件产生冲突。
 *
 * 对应 Loop Engineering 五构件中的 "Worktrees"。
 *
 * 改造难度：★★★☆☆（中等）— 需与 Git 深度集成
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { WorktreeInfo, MergeResult } from './types';

const execFileAsync = promisify(execFile);

export class WorktreeManager {
  private readonly baseDir: string;
  private readonly repoRoot: string;

  /**
   * @param baseDir - worktree 存储目录（默认 .worktrees/）
   * @param repoRoot - Git 仓库根目录（默认 process.cwd()）
   */
  constructor(baseDir: string = '.worktrees', repoRoot?: string) {
    this.baseDir = baseDir;
    this.repoRoot = repoRoot ?? process.cwd();
  }

  /**
   * 为 Agent 创建隔离的 Git worktree
   * 每个 Agent 在独立分支上工作，互不冲突
   */
  async createIsolatedWorkdir(agentId: string, baseBranch?: string): Promise<WorktreeInfo> {
    const branchName = `agent-${agentId}`;
    const worktreePath = path.resolve(this.repoRoot, this.baseDir, agentId);

    // 检查是否已存在
    if (await this.exists(worktreePath)) {
      return {
        agentId,
        workdir: worktreePath,
        branch: branchName,
        createdAt: (await fs.stat(worktreePath)).birthtime.toISOString(),
        merged: false,
      };
    }

    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    const from = baseBranch ?? await this.getDefaultBranch();

    try {
      // 创建新分支
      await this.git('branch', branchName, from);
    } catch {
      // 分支可能已存在，忽略
    }

    // 创建 worktree
    await this.git('worktree', 'add', worktreePath, branchName);

    return {
      agentId,
      workdir: worktreePath,
      branch: branchName,
      createdAt: new Date().toISOString(),
      merged: false,
    };
  }

  /**
   * 合并 Agent 的工作成果回目标分支
   */
  async mergeWorkdir(
    agentId: string,
    targetBranch: string = 'main',
    commitMessage?: string
  ): Promise<MergeResult> {
    const branchName = `agent-${agentId}`;
    const worktreePath = path.resolve(this.repoRoot, this.baseDir, agentId);

    try {
      // 先在 worktree 中提交所有变更
      await this.gitIn(worktreePath, 'add', '-A');
      try {
        await this.gitIn(
          worktreePath,
          'commit',
          '-m',
          commitMessage ?? `Agent ${agentId} work`
        );
      } catch {
        // 没有变更需要提交，忽略
      }

      // 在仓库根目录合并
      await this.git('checkout', targetBranch);
      await this.git('merge', branchName, '--no-edit');

      return { success: true, branch: branchName };
    } catch (error: unknown) {
      const err = error as { stderr?: string; message?: string };
      // 检查是否是冲突
      if (err.stderr?.includes('CONFLICT') || err.message?.includes('CONFLICT')) {
        const conflicts = await this.getConflicts(worktreePath);
        return { success: false, branch: branchName, error: 'Merge conflicts', conflicts };
      }
      return { success: false, branch: branchName, error: err.stderr ?? err.message ?? 'Unknown error' };
    }
  }

  /**
   * 清理 Agent 的 worktree 和分支
   */
  async cleanup(agentId: string): Promise<void> {
    const worktreePath = path.resolve(this.repoRoot, this.baseDir, agentId);
    const branchName = `agent-${agentId}`;

    try {
      await this.git('worktree', 'remove', worktreePath, '--force');
    } catch {
      // worktree 可能已经不存在
    }

    try {
      await this.git('branch', '-D', branchName);
    } catch {
      // 分支可能已经不存在
    }
  }

  /**
   * 列出所有活跃的 worktree
   */
  async list(): Promise<WorktreeInfo[]> {
    try {
      const worktreesDir = path.resolve(this.repoRoot, this.baseDir);
      const entries = await fs.readdir(worktreesDir);
      const results: WorktreeInfo[] = [];

      for (const entry of entries) {
        const fullPath = path.join(worktreesDir, entry);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          results.push({
            agentId: entry,
            workdir: fullPath,
            branch: `agent-${entry}`,
            createdAt: stat.birthtime.toISOString(),
            merged: false,
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * 获取 worktree 中的变更文件列表
   */
  async getChanges(agentId: string): Promise<string[]> {
    const worktreePath = path.resolve(this.repoRoot, this.baseDir, agentId);
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--name-only', 'HEAD'], {
        cwd: worktreePath,
      });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private async getConflicts(cwd: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--diff-filter=U'], { cwd });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async getDefaultBranch(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'], {
        cwd: this.repoRoot,
      });
      return stdout.trim().replace('origin/', '');
    } catch {
      return 'main';
    }
  }

  private async git(...args: string[]): Promise<void> {
    await execFileAsync('git', args, { cwd: this.repoRoot });
  }

  private async gitIn(cwd: string, ...args: string[]): Promise<void> {
    await execFileAsync('git', args, { cwd });
  }
}
