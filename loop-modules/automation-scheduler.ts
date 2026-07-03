/**
 * Loop Engineering — AutomationScheduler 自动化调度模块
 *
 * 实现跨会话的定时/事件触发任务。
 * 对应 Loop Engineering 五构件中的 "Automations"。
 *
 * 改造难度：★★☆☆☆（较低）— 纯新增模块
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { AutomationRule, GoalDefinition } from './types';

export type AutomationTriggerFn = (goal: GoalDefinition) => Promise<void>;

export class AutomationScheduler {
  private readonly rulesPath: string;
  private readonly timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private triggerFn: AutomationTriggerFn | null = null;

  constructor(rulesPath: string = '.loop/automations.json') {
    this.rulesPath = rulesPath;
  }

  /**
   * 设置触发函数 — 由 OuterLoop 注入
   * 当自动化触发时，调用此函数创建并执行目标
   */
  setTriggerFn(fn: AutomationTriggerFn): void {
    this.triggerFn = fn;
  }

  /**
   * 创建新的自动化规则
   */
  async create(input: {
    name: string;
    schedule: string;
    goalTemplate: Omit<GoalDefinition, 'id'>;
    maxRuns?: number;
  }): Promise<AutomationRule> {
    const rule: AutomationRule = {
      id: crypto.randomUUID().slice(0, 8),
      name: input.name,
      schedule: input.schedule,
      goalTemplate: input.goalTemplate,
      enabled: true,
      runCount: 0,
      maxRuns: input.maxRuns,
      createdAt: new Date().toISOString(),
    };

    await this.saveRule(rule);
    this.startTimer(rule);
    return rule;
  }

  /**
   * 取消自动化
   */
  async cancel(ruleId: string): Promise<void> {
    this.stopTimer(ruleId);
    const rules = await this.loadRules();
    const filtered = rules.filter((r) => r.id !== ruleId);
    await this.saveAllRules(filtered);
  }

  /**
   * 暂停/恢复自动化
   */
  async toggle(ruleId: string, enabled: boolean): Promise<void> {
    const rules = await this.loadRules();
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Automation not found: ${ruleId}`);

    rule.enabled = enabled;
    await this.saveAllRules(rules);

    if (enabled) {
      this.startTimer(rule);
    } else {
      this.stopTimer(ruleId);
    }
  }

  /**
   * 列出所有自动化规则
   */
  async list(): Promise<AutomationRule[]> {
    return this.loadRules();
  }

  /**
   * 获取单个规则
   */
  async get(ruleId: string): Promise<AutomationRule | undefined> {
    const rules = await this.loadRules();
    return rules.find((r) => r.id === ruleId);
  }

  /**
   * 手动触发一次（用于测试）
   */
  async triggerNow(ruleId: string): Promise<void> {
    const rule = await this.get(ruleId);
    if (!rule) throw new Error(`Automation not found: ${ruleId}`);
    await this.executeGoal(rule);
  }

  /**
   * 启动所有已启用的自动化
   * 在应用启动时调用
   */
  async startAll(): Promise<void> {
    const rules = await this.loadRules();
    for (const rule of rules) {
      if (rule.enabled) {
        this.startTimer(rule);
      }
    }
  }

  /**
   * 停止所有自动化
   * 在应用关闭时调用
   */
  stopAll(): void {
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  /**
   * 解析调度间隔字符串为毫秒数
   * 支持格式: "30s", "2m", "1h", "1d"
   */
  static parseInterval(schedule: string): number {
    const match = schedule.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      throw new Error(`Invalid schedule format: ${schedule}. Use format like "2m", "30s", "1h", "1d"`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
  }

  private startTimer(rule: AutomationRule): void {
    this.stopTimer(rule.id);

    const intervalMs = AutomationScheduler.parseInterval(rule.schedule);
    const timer = setInterval(async () => {
      await this.executeGoal(rule);
    }, intervalMs);

    this.timers.set(rule.id, timer);
  }

  private stopTimer(ruleId: string): void {
    const timer = this.timers.get(ruleId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(ruleId);
    }
  }

  private async executeGoal(rule: AutomationRule): Promise<void> {
    // 检查最大运行次数
    if (rule.maxRuns !== undefined && rule.runCount >= rule.maxRuns) {
      rule.enabled = false;
      await this.saveAllRules(await this.loadRules());
      this.stopTimer(rule.id);
      return;
    }

    if (!this.triggerFn) {
      console.warn(`[Automation] No trigger function set, skipping: ${rule.name}`);
      return;
    }

    const goal: GoalDefinition = {
      ...rule.goalTemplate,
      id: crypto.randomUUID().slice(0, 8),
    };

    try {
      await this.triggerFn(goal);
      rule.runCount++;
      rule.lastRun = new Date().toISOString();
    } catch (error) {
      console.error(`[Automation] Failed to execute: ${rule.name}`, error);
    }

    // 更新规则状态
    const rules = await this.loadRules();
    const idx = rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      rules[idx] = rule;
      await this.saveAllRules(rules);
    }
  }

  private async loadRules(): Promise<AutomationRule[]> {
    try {
      const content = await fs.readFile(this.rulesPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async saveRule(rule: AutomationRule): Promise<void> {
    const rules = await this.loadRules();
    rules.push(rule);
    await this.saveAllRules(rules);
  }

  private async saveAllRules(rules: AutomationRule[]): Promise<void> {
    const dir = path.dirname(this.rulesPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.rulesPath, JSON.stringify(rules, null, 2), 'utf-8');
  }
}
