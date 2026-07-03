/**
 * Loop Engineering — GateRunner 硬闸门模块
 *
 * 实现"硬闸门"机制：自动运行测试/构建/lint 等命令，
 * 不通过则自动拒绝，防止 Agent 产出未经验证的代码。
 *
 * 这是对抗 "Ralph Wiggum 循环"（Agent 假装完成）的关键防线。
 *
 * 改造难度：★★☆☆☆（较低）— 纯新增模块
 * 也可通过 OpenClaw 的 Hook 系统（afterToolCall）实现
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GateResult, GateCommandResult } from './types';

const execFileAsync = promisify(execFile);

export interface GateRunnerOptions {
  /** 单条命令超时（毫秒，默认 60000） */
  timeout?: number;
  /** 工作目录 */
  cwd?: string;
  /** 失败时是否继续执行后续命令（默认 false — 遇到第一个失败就停止） */
  continueOnFailure?: boolean;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 最大输出长度（超出截断，防止 Token 浪费） */
  maxOutputLength?: number;
}

export class GateRunner {
  private readonly defaultTimeout: number;
  private readonly maxOutputLength: number;
  private readonly continueOnFailure: boolean;

  constructor(options: GateRunnerOptions = {}) {
    this.defaultTimeout = options.timeout ?? 60_000;
    this.maxOutputLength = options.maxOutputLength ?? 10_000;
    this.continueOnFailure = options.continueOnFailure ?? false;
  }

  /**
   * 按顺序执行闸门命令。
   *
   * 默认行为：遇到第一个失败就停止并返回。
   * 如果 continueOnFailure=true，则执行所有命令并返回汇总结果。
   *
   * @param commands - 要执行的命令列表（如 ["npm test", "npm run lint", "npm run build"]）
   * @param cwd - 工作目录
   * @returns 闸门检查结果
   */
  async check(commands: string[], cwd?: string): Promise<GateResult> {
    if (commands.length === 0) {
      return { passed: true, command: 'none', exitCode: 0, stdout: '', stderr: '', duration: 0 };
    }

    const startTime = Date.now();
    const details: GateCommandResult[] = [];
    let allPassed = true;
    let firstFailure: GateCommandResult | undefined;

    for (const cmd of commands) {
      const result = await this.execCommand(cmd, cwd);
      details.push(result);

      if (!result.passed) {
        allPassed = false;
        if (!firstFailure) {
          firstFailure = result;
        }
        // 默认行为：遇到失败就停止（除非 continueOnFailure=true）
        if (!this.continueOnFailure) break;
      }
    }

    const totalDuration = Date.now() - startTime;

    if (allPassed) {
      return {
        passed: true,
        command: 'all',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: totalDuration,
        details,
      };
    }

    // 返回第一个失败的信息
    return {
      passed: false,
      command: firstFailure!.command,
      exitCode: firstFailure!.exitCode,
      stdout: firstFailure!.stdout,
      stderr: firstFailure!.stderr,
      duration: totalDuration,
      details,
    };
  }

  /**
   * 执行单条命令并返回结果
   */
  async checkSingle(command: string, cwd?: string): Promise<GateResult> {
    const result = await this.execCommand(command, cwd);
    return {
      passed: result.passed,
      command: result.command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration: result.duration,
    };
  }

  /**
   * 批量并行执行闸门命令（适用于互相独立的检查）
   */
  async checkParallel(commands: string[], cwd?: string): Promise<GateResult> {
    const startTime = Date.now();
    const results = await Promise.all(
      commands.map((cmd) => this.execCommand(cmd, cwd))
    );

    const allPassed = results.every((r) => r.passed);
    const firstFailure = results.find((r) => !r.passed);
    const totalDuration = Date.now() - startTime;

    if (allPassed) {
      return {
        passed: true,
        command: 'all',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: totalDuration,
        details: results,
      };
    }

    return {
      passed: false,
      command: firstFailure!.command,
      exitCode: firstFailure!.exitCode,
      stdout: firstFailure!.stdout,
      stderr: firstFailure!.stderr,
      duration: totalDuration,
      details: results,
    };
  }

  /**
   * 生成闸门失败的摘要（用于注入到下一轮的系统提示词）
   */
  static formatFailureForPrompt(result: GateResult): string {
    if (result.passed) return '';

    const lines = [
      `## 闸门检查失败`,
      ``,
      `命令: \`${result.command}\``,
      `退出码: ${result.exitCode}`,
    ];

    if (result.stderr) {
      lines.push(``, `### 错误输出`, '```', result.stderr.slice(0, 2000), '```');
    }

    if (result.stdout && result.exitCode !== 0) {
      lines.push(``, `### 标准输出`, '```', result.stdout.slice(0, 1000), '```');
    }

    if (result.details && result.details.length > 1) {
      lines.push(``, `### 详细结果`);
      for (const d of result.details) {
        const icon = d.passed ? '✅' : '❌';
        lines.push(`- ${icon} \`${d.command}\` (exit ${d.exitCode}, ${d.duration}ms)`);
      }
    }

    lines.push(``, `请修复以上问题后继续。`);
    return lines.join('\n');
  }

  private async execCommand(command: string, cwd?: string): Promise<GateCommandResult> {
    const startTime = Date.now();

    try {
      // 使用 shell 执行命令以支持管道等 shell 特性
      const { stdout, stderr } = await execFileAsync(
        process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        process.platform === 'win32'
          ? ['/c', command]
          : ['-c', command],
        {
          cwd: cwd ?? process.cwd(),
          timeout: this.defaultTimeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          env: { ...process.env },
        }
      );

      return {
        command,
        passed: true,
        exitCode: 0,
        stdout: this.truncate(stdout),
        stderr: this.truncate(stderr),
        duration: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const err = error as { code?: number; stdout?: string; stderr?: string; message?: string; killed?: boolean };
      return {
        command,
        passed: false,
        exitCode: err.code ?? 1,
        stdout: this.truncate(err.stdout ?? ''),
        stderr: this.truncate(err.killed ? 'Command timed out' : (err.stderr ?? err.message ?? 'Unknown error')),
        duration: Date.now() - startTime,
      };
    }
  }

  private truncate(text: string): string {
    if (text.length <= this.maxOutputLength) return text;
    return text.slice(0, this.maxOutputLength) + `\n... [truncated ${text.length - this.maxOutputLength} chars]`;
  }
}
