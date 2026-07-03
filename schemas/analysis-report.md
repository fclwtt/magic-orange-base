# OpenClaw 核心改造 Loop Engineering 分析报告

> 基于 Datawhale《Loop Engineering 实操手册》和腾讯《Loop Engineering 实践指南》两篇文章的深度分析

## 一、两篇文章核心要点

### 文章一：Datawhale — Loop Engineering 实操手册

**核心观点**：Loop 由五个构件组成

| 构件 | 职责 |
|------|------|
| **Automations** | 按节奏/事件触发，按明确条件停止 |
| **Worktrees** | Git worktree 隔离多 Agent 并行工作区 |
| **Skills** | 项目知识沉淀为文档，Agent 每轮直接读取 |
| **Connectors** | 通过 MCP 接入 GitHub/Linear/Slack 等工具链 |
| **Sub-agents** | 写代码的和验收的分开，形成对抗验证 |

最小可用 Loop = **Automation + Skill + 状态文件 + 硬闸门**

关键风险：
- Ralph Wiggum 循环：Agent 在没有硬闸门的情况下提前宣告完成
- 理解债务：Loop 快速交付代码，导致团队理解跟不上
- 认知投降：开发者放弃 Review，盲目接收结果

### 文章二：腾讯/CodeBuddy — Loop Engineering 实践指南

**核心观点**：双层循环模型 + 状态外置哲学

```
Outer Loop（编排层）：目标拆解 → 任务分配 → 结果汇总 → 再计划
    ↓
Inner Loop（执行层）：感知 → 推理 → 行动 → 观察（ReAct 模式）
```

关键实现：
- `/goal` — 条件驱动，独立小模型评估器判断是否达成
- `/loop` — 时间驱动，按间隔重复执行
- `Automations` — 跨会话定时任务
- **对抗验证** — 执行者和评估者分离

---

## 二、OpenClaw 现有 Loop 架构分析

### 2.1 核心循环代码结构

OpenClaw 的 Agent 执行是严格的三层结构：

```
CoreAgentHarness（编排层）— packages/agent-core/harness/agent-harness.ts
    ↓ 调用
  Agent（有状态包装层）— packages/agent-core/agent.ts
    ↓ 调用
  runAgentLoop（无状态纯函数循环）— packages/agent-core/agent-loop.ts
```

### 2.2 runAgentLoop 内部结构

```typescript
// 简化版核心循环
async function runAgentLoop(context, eventSink, config) {
  while (true) {                          // 外层：检查后续消息
    while (有工具调用 || 有 pending 消息) {  // 内层：执行循环
      // 1. 检查 abort 信号
      // 2. 发射 turn_start 事件
      // 3. 注入 pending steering messages
      // 4. 调用 streamAssistantResponse() → LLM 流式响应
      // 5. 提取 tool calls → 执行工具 → 收集 tool results
      // 6. 发射 turn_end 事件
      // 7. prepareNextTurn?() → 允许替换 context/model
      // 8. shouldStopAfterTurn?() → 允许外部提前终止
      // 9. getSteeringMessages?() → 注入中途引导消息
    }
    // 外层检查
    // 10. getFollowUpMessages?() → 注入后续消息
    if (没有后续消息) break;
  }
  // 发射 agent_end 事件
}
```

### 2.3 关键设计特征

- **循环本身不直接调用 LLM** — 通过注入的 `StreamFn` 函数调用
- **循环不持久化任何状态** — 所有持久化由上层 Harness 完成
- **错误不通过 throw 传播** — 编码为 `stopReason: "error" | "aborted"` 的消息
- **提供多个注入钩子** — `prepareNextTurn`、`shouldStopAfterTurn`、`getSteeringMessages`、`getFollowUpMessages`

---

## 三、Loop Engineering 要素对照 OpenClaw 现状

| Loop Engineering 要素 | 文章定义 | OpenClaw 现状 | 差距 |
|---------------------|---------|-------------|------|
| **Outer Loop（编排层）** | 目标拆解→任务分配→结果汇总→再计划 | ❌ 完全没有 | 🔴 需从零构建 |
| **Inner Loop（执行层）** | 感知→推理→行动→观察 | ✅ `runAgentLoop()` 已实现 | 🟢 已有 |
| **Goal 驱动** | 设定可验证的完成条件，自动循环至达成 | ❌ 无 | 🔴 需新增 |
| **状态外置** | 每轮从持久化状态开始，不依赖模型记忆 | ⚠️ Session 持久化有，但状态文件机制无 | 🟡 需扩展 |
| **硬闸门（Gate）** | 测试/构建/lint 不通过自动拒绝 | ❌ 无自动闸门 | 🔴 需新增 |
| **对抗验证** | 执行者和评估者分离 | ⚠️ 有子 Agent 委派，但无独立评估者 | 🟡 需扩展 |
| **Automations** | 跨会话定时/事件触发 | ❌ 无 | 🔴 需新增 |
| **Worktrees** | Git worktree 隔离并行 Agent | ❌ 无 | 🔴 需新增 |
| **Skills 持久化** | 项目知识沉淀为文档，自动加载 | ✅ 有 skills/ 目录（53 个） | 🟢 已有 |
| **Connectors** | MCP 接入外部工具链 | ✅ MCP 支持 | 🟢 已有 |
| **Sub-agents** | 写代码和验收分离 | ⚠️ 有子 Agent，但无角色分工 | 🟡 需扩展 |
| **状态文件** | 记录进度，支持断点续跑 | ❌ 无 | 🔴 需新增 |

**结论：OpenClaw 有一个很强的 Inner Loop，但完全没有 Outer Loop。Loop Engineering 的核心价值恰恰在 Outer Loop。**

---

## 四、改造方案：给 OpenClaw 加 Outer Loop

### 4.1 改造架构总览

```
新增的 Outer Loop（编排层）
┌─────────────────────────────────────────────────────┐
│                                                      │
│  ┌─ GoalManager ──── 目标设定 + 完成条件评估         │
│  ├─ StateFile ────── 进度持久化 + 断点续跑           │
│  ├─ GateRunner ───── 硬闸门（test/lint/build）       │
│  ├─ AdversarialEval─ 对抗验证（独立评估者）           │
│  ├─ AutomationTick── 定时/事件触发                   │
│  └─ WorktreeMgr ──── Git worktree 隔离管理           │
│                                                      │
│         ↓ 每轮迭代调用                                │
│                                                      │
│  ┌─ 现有的 Inner Loop（runAgentLoop）─────────┐      │
│  │  感知 → 推理 → 行动 → 观察（已有，不改）   │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 4.2 改造 1：新增 Outer Loop 编排器

```typescript
// 新增文件：packages/agent-core/outer-loop.ts

interface GoalDefinition {
  id: string;
  description: string;
  completionCriteria: string;     // 可验证的完成条件
  maxTurns: number;               // 最大轮次（防止无限循环）
  maxTokens?: number;             // Token 预算上限
  gateCommands?: string[];        // 闸门检查命令（如 "npm test"）
  evaluatorModel?: string;        // 评估者使用的模型（默认用小模型）
}

interface LoopState {
  goalId: string;
  turns: number;
  tokensUsed: number;
  completed: boolean;
  lastGateFailure?: GateResult;
  lastEvaluation?: EvaluationResult;
  messages: Message[];
  artifacts: string[];            // 产出物路径
  startedAt: string;
  lastUpdatedAt: string;
}

class OuterLoop {
  private innerLoop: AgentLoop;
  private goalManager: GoalManager;
  private stateFile: StateFile;
  private gateRunner: GateRunner;
  private adversarialEval: AdversarialEvaluator;
  private worktreeMgr: WorktreeManager;

  async run(goal: GoalDefinition): Promise<LoopResult> {
    // 1. 加载或初始化状态（状态外置）
    const state = await this.stateFile.load(goal.id);
    if (state.completed) return { status: 'already_done', state };

    // 2. 创建隔离工作区（如果有 Worktree）
    const workdir = await this.worktreeMgr.createIsolatedWorkdir(goal.id);

    while (!state.completed) {
      // 3. 检查预算
      if (state.turns >= goal.maxTurns) {
        return { status: 'max_turns_reached', state };
      }
      if (goal.maxTokens && state.tokensUsed >= goal.maxTokens) {
        return { status: 'budget_exhausted', state };
      }

      // 4. 构建系统提示词（注入目标 + 状态 + 闸门反馈）
      const systemPrompt = this.buildSystemPrompt(goal, state);

      // 5. 调 Inner Loop 执行一轮
      const result = await this.innerLoop.run({
        systemPrompt,
        messages: state.messages,
        cwd: workdir,
        // 利用现有钩子注入控制
        prepareNextTurn: (context) => this.prepareNext(context, state),
        shouldStopAfterTurn: () => this.shouldStop(state),
      });

      // 6. 更新状态
      state.turns++;
      state.tokensUsed += result.tokensUsed;
      state.messages = result.messages;
      state.lastUpdatedAt = new Date().toISOString();

      // 7. 硬闸门验证
      if (goal.gateCommands?.length) {
        const gateResult = await this.gateRunner.check(goal.gateCommands, workdir);
        if (!gateResult.passed) {
          state.lastGateFailure = gateResult;
          // 把闸门失败信息注入下一轮的 steering messages
          continue;
        }
      }

      // 8. 对抗验证 — 独立评估者判断目标是否达成
      const evaluation = await this.adversarialEval.evaluate({
        criteria: goal.completionCriteria,
        work: result,
        gateResult: state.lastGateFailure,
        model: goal.evaluatorModel ?? 'gemini-2.5-flash',
      });

      state.lastEvaluation = evaluation;

      if (evaluation.verdict === 'ok') {
        state.completed = true;
      } else if (evaluation.verdict === 'impossible') {
        return { status: 'impossible', state, reason: evaluation.reason };
      }

      // 9. 持久化状态
      await this.stateFile.save(state);
    }

    return { status: 'completed', state };
  }

  private buildSystemPrompt(goal: GoalDefinition, state: LoopState): string {
    let prompt = `你的目标：${goal.description}\n\n`;
    prompt += `完成标准：${goal.completionCriteria}\n\n`;
    prompt += `当前进度：第 ${state.turns + 1} 轮，已使用 ${state.tokensUsed} tokens\n`;

    if (state.lastGateFailure) {
      prompt += `\n上一轮闸门失败原因：\n${state.lastGateFailure.output}\n`;
      prompt += `请修复以上问题。\n`;
    }

    if (state.lastEvaluation?.verdict === 'false') {
      prompt += `\n评估者反馈：${state.lastEvaluation.reason}\n`;
      prompt += `请根据反馈继续改进。\n`;
    }

    return prompt;
  }
}
```

**改造难度：★★★☆☆（中等）**
- 不需要改 `runAgentLoop()`，是在它外面包一层
- 通过现有的 `prepareNextTurn?()` 和 `shouldStopAfterTurn?()` 钩子注入控制
- 核心工作量在 GoalManager、GateRunner、AdversarialEval 三个新模块

### 4.3 改造 2：GoalManager 目标管理器

```typescript
// 新增文件：packages/agent-core/goal-manager.ts

interface Goal {
  id: string;
  description: string;
  completionCriteria: string;
  maxTurns: number;
  maxTokens?: number;
  gateCommands?: string[];
  evaluatorModel?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'impossible';
  createdAt: string;
  updatedAt: string;
}

class GoalManager {
  private goalsPath: string;  // .loop/goals.json

  async create(goal: Omit<Goal, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
    const newGoal: Goal = {
      ...goal,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.save(newGoal);
    return newGoal;
  }

  async updateStatus(id: string, status: Goal['status']): Promise<void> {
    const goal = await this.get(id);
    goal.status = status;
    goal.updatedAt = new Date().toISOString();
    await this.save(goal);
  }

  async list(): Promise<Goal[]> {
    // 从文件读取所有目标
  }

  async get(id: string): Promise<Goal> {
    // 从文件读取单个目标
  }

  private async save(goal: Goal): Promise<void> {
    // 持久化到文件系统
  }
}
```

### 4.4 改造 3：GateRunner 硬闸门

```typescript
// 新增文件：packages/agent-core/gate-runner.ts

interface GateResult {
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

class GateRunner {
  /**
   * 按顺序执行闸门命令，全部通过才返回 passed: true
   * 任一命令失败则立即返回失败结果
   */
  async check(commands: string[], cwd: string): Promise<GateResult> {
    for (const cmd of commands) {
      const result = await this.exec(cmd, cwd);
      if (result.exitCode !== 0) {
        return { ...result, passed: false };
      }
    }
    return { passed: true, command: 'all', exitCode: 0, stdout: '', stderr: '', duration: 0 };
  }

  private async exec(command: string, cwd: string): Promise<GateResult> {
    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(command, { cwd, timeout: 60000 });
      return {
        passed: true,
        command,
        exitCode: 0,
        stdout,
        stderr,
        duration: Date.now() - start,
      };
    } catch (error: any) {
      return {
        passed: false,
        command,
        exitCode: error.code ?? 1,
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? error.message,
        duration: Date.now() - start,
      };
    }
  }
}
```

**改造难度：★★☆☆☆（较低）**
- 纯新增模块
- 也可以作为插件通过 Hook 实现

### 4.5 改造 4：AdversarialEvaluator 对抗验证器

```typescript
// 新增文件：packages/agent-core/adversarial-evaluator.ts

interface EvaluationRequest {
  criteria: string;
  work: AgentLoopResult;
  gateResult?: GateResult;
  model: string;
}

interface EvaluationResult {
  verdict: 'ok' | 'false' | 'impossible';
  reason: string;
  confidence: number;  // 0-1
  tokensUsed: number;
}

class AdversarialEvaluator {
  private llmRuntime: LLMRuntime;

  async evaluate(req: EvaluationRequest): Promise<EvaluationResult> {
    const prompt = this.buildEvalPrompt(req);

    // 用独立的小模型做评估（与执行者不同）
    const response = await this.llmRuntime.generate({
      model: req.model,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
    });

    return this.parseEvalResponse(response);
  }

  private buildEvalPrompt(req: EvaluationRequest): string {
    return `你是一个严格的代码审查员和任务评估者。

## 任务完成标准
${req.criteria}

## Agent 的工作产出
${this.summarizeWork(req.work)}

## 闸门检查结果
${req.gateResult ? (req.gateResult.passed ? '全部通过' : `失败: ${req.gateResult.stderr}`) : '未设置闸门'}

## 请评估
请判断任务是否已完成。返回 JSON：
{
  "verdict": "ok" | "false" | "impossible",
  "reason": "具体理由",
  "confidence": 0.0-1.0
}

注意：
- "ok" = 完全满足完成标准
- "false" = 尚未完成，说明还差什么
- "impossible" = 根据当前条件不可能完成，说明原因
- 要严格，不要因为"差不多了"就给 ok`;
  }
}
```

**改造难度：★★☆☆☆（较低）**
- 利用现有的子 Agent 机制和 LLM Runtime
- 核心是评估 prompt 的设计

### 4.6 改造 5：StateFile 状态文件

```typescript
// 新增文件：packages/agent-core/state-file.ts

class StateFile {
  private baseDir: string;  // .loop/

  constructor(baseDir: string = '.loop') {
    this.baseDir = baseDir;
  }

  async load(goalId: string): Promise<LoopState> {
    const path = this.getPath(goalId);
    try {
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return this.createInitial(goalId);
    }
  }

  async save(state: LoopState): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const path = this.getPath(state.goalId);
    await fs.writeFile(path, JSON.stringify(state, null, 2));
  }

  async exists(goalId: string): Promise<boolean> {
    return fs.access(this.getPath(goalId)).then(() => true).catch(() => false);
  }

  async listAll(): Promise<LoopState[]> {
    const files = await fs.readdir(this.baseDir);
    const states: LoopState[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(this.baseDir, file), 'utf-8');
        states.push(JSON.parse(content));
      }
    }
    return states;
  }

  private getPath(goalId: string): string {
    return path.join(this.baseDir, `state-${goalId}.json`);
  }

  private createInitial(goalId: string): LoopState {
    return {
      goalId,
      turns: 0,
      tokensUsed: 0,
      completed: false,
      messages: [],
      artifacts: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}
```

**改造难度：★☆☆☆☆（简单）**
- 纯新增模块，不改任何现有代码

### 4.7 改造 6：AutomationScheduler 定时调度

```typescript
// 新增文件：packages/agent-core/automation-scheduler.ts

interface AutomationRule {
  id: string;
  name: string;
  schedule: string;        // cron 表达式或 rrule
  goalTemplate: Omit<GoalDefinition, 'id'>;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

class AutomationScheduler {
  private rulesPath: string;  // .loop/automations.json
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async schedule(rule: AutomationRule): Promise<void> {
    await this.saveRule(rule);
    this.startTimer(rule);
  }

  async cancel(id: string): Promise<void> {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    await this.removeRule(id);
  }

  async list(): Promise<AutomationRule[]> {
    return this.loadRules();
  }

  private startTimer(rule: AutomationRule): void {
    const interval = this.parseSchedule(rule.schedule);
    const timer = setInterval(async () => {
      await this.executeGoal(rule.goalTemplate);
    }, interval);
    this.timers.set(rule.id, timer);
  }

  private parseSchedule(schedule: string): number {
    // 简单的间隔解析（实际可用 node-cron 或 rrule 库）
    // "2m" → 120000, "30m" → 1800000, "1h" → 3600000
    const match = schedule.match(/^(\d+)(m|h|s)$/);
    if (!match) throw new Error(`Invalid schedule: ${schedule}`);
    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000 };
    return value * multipliers[unit];
  }

  private async executeGoal(template: Omit<GoalDefinition, 'id'>): Promise<void> {
    const goal: GoalDefinition = { ...template, id: crypto.randomUUID() };
    const outerLoop = new OuterLoop(/* deps */);
    await outerLoop.run(goal);
  }
}
```

**改造难度：★★☆☆☆（较低）**
- 纯新增模块

### 4.8 改造 7：WorktreeManager 工作树隔离

```typescript
// 新增文件：packages/agent-core/worktree-manager.ts

class WorktreeManager {
  private baseDir: string;  // .worktrees/

  constructor(baseDir: string = '.worktrees') {
    this.baseDir = baseDir;
  }

  /**
   * 为 Agent 创建隔离的 Git worktree
   * 每个 Agent 在独立分支上工作，互不冲突
   */
  async createIsolatedWorkdir(agentId: string): Promise<string> {
    const branchName = `agent-${agentId}`;
    const worktreePath = path.join(this.baseDir, agentId);

    // 检查是否已存在
    if (await fs.access(worktreePath).then(() => true).catch(() => false)) {
      return worktreePath;
    }

    await fs.mkdir(this.baseDir, { recursive: true });

    // 创建新分支和 worktree
    await execAsync(`git branch ${branchName} 2>/dev/null || true`);
    await execAsync(`git worktree add ${worktreePath} ${branchName}`);

    return worktreePath;
  }

  /**
   * 合并 Agent 的工作成果回主分支
   */
  async mergeWorkdir(agentId: string, targetBranch: string = 'main'): Promise<MergeResult> {
    const branchName = `agent-${agentId}`;
    try {
      await execAsync(`git merge ${branchName} --into ${targetBranch} --no-edit`);
      return { success: true, branch: branchName };
    } catch (error: any) {
      return { success: false, branch: branchName, error: error.stderr };
    }
  }

  /**
   * 清理 Agent 的 worktree
   */
  async cleanup(agentId: string): Promise<void> {
    const worktreePath = path.join(this.baseDir, agentId);
    await execAsync(`git worktree remove ${worktreePath} --force 2>/dev/null || true`);
    await execAsync(`git branch -D agent-${agentId} 2>/dev/null || true`);
  }
}
```

**改造难度：★★★☆☆（中等）**
- 需要与 Git 深度集成
- 需要修改 Agent 的 cwd 管理
- 需要处理合并冲突

---

## 五、改造难度总评

### 核心优势：大部分改造不需要动核心

```
OpenClaw 的架构恰好支持"由外向内"的扩展：

  ┌─ 需要新增的（不动核心）──────────────────┐
  │  Outer Loop 编排器    → 新模块           │
  │  GoalManager          → 新模块           │
  │  StateFile            → 新模块           │
  │  GateRunner           → 新模块/插件      │
  │  AdversarialEval      → 新模块（用子Agent）│
  │  AutomationScheduler  → 新模块           │
  │  WorktreeManager      → 新模块           │
  └──────────────────────────────────────────┘

  ┌─ 已有的（直接用）────────────────────────┐
  │  Inner Loop (runAgentLoop)  → 不改       │
  │  Hook 系统                  → 直接利用    │
  │  子 Agent 委派              → 直接利用    │
  │  Skills 系统                → 直接利用    │
  │  MCP 连接器                 → 直接利用    │
  └──────────────────────────────────────────┘

  ┌─ 可能需要小改的 ────────────────────────┐
  │  Harness 的 prepareNextTurn → 注入状态  │
  │  Harness 的 shouldStopAfterTurn → 注入目标检查 │
  └──────────────────────────────────────────┘
```

### 难度评分

| 改造项 | 难度 | 工作量 | 风险 |
|--------|------|--------|------|
| Outer Loop 编排器 | ★★★☆☆ | 1-2 周 | 低 — 新模块，不改核心 |
| GoalManager + 评估器 | ★★★☆☆ | 1 周 | 低 — 利用子 Agent |
| GateRunner 闸门 | ★★☆☆☆ | 3-5 天 | 极低 — 纯新增 |
| 对抗验证 | ★★☆☆☆ | 3-5 天 | 极低 — 利用子 Agent |
| 状态文件 | ★☆☆☆☆ | 2-3 天 | 无 — 纯新增 |
| Automations | ★★☆☆☆ | 1 周 | 低 — 纯新增 |
| Worktree 隔离 | ★★★☆☆ | 1-2 周 | 中 — 需改 cwd 管理 |
| **总计** | | **5-7 周** | |

---

## 六、真正的难点（不在代码，在设计）

| 难点 | 说明 |
|------|------|
| **Goal 评估器的准确性** | 评估器判断"目标是否达成"的准确度直接决定 Loop 的有效性。太松 = Ralph Wiggum 效应（假装完成），太严 = 永远无法通过 |
| **Token 成本控制** | Outer Loop 每轮都要调评估者，成本是 Inner Loop 的 2-3 倍。必须设定 Token 预算上限 |
| **闸门设计** | 什么样的检查算"硬闸门"？不同项目差异巨大，需要用户自己配置 |
| **状态文件 schema** | 什么该持久化、什么不该？设计不好会导致状态膨胀或信息丢失 |
| **14 步实操路线** | 文章一的 14 步路线需要完整实现：先手动跑通 → 沉淀 Skill → 包装 Loop → 调度 |

---

## 七、最终结论

### 能不能改？

**能，而且改造路径很清晰。** OpenClaw 的微内核 + Hook 架构天然适合"由外向内"扩展。不需要动 `runAgentLoop()` 一行代码，只需在外面包一层 Outer Loop 编排器，再利用现有的 Hook、子 Agent、Skills、MCP 来填充五个构件。

### 难度大不大？

**中等偏下。** 核心原因：

1. **Inner Loop 已经很强** — `runAgentLoop()` 提供了 `prepareNextTurn`、`shouldStopAfterTurn`、`getSteeringMessages` 等钩子，天然就是为 Outer Loop 预留的注入点
2. **Hook 系统足够丰富** — 闸门、对抗验证都可以通过 Hook 插件实现
3. **子 Agent 已有** — 对抗验证直接用子 Agent 做独立评估者

### 一句话

> **OpenClaw 改 Loop Engineering 的核心工作量是"在外面包一层编排器 + 写 7 个新模块"，不需要动核心骨架，5-7 周可完成。真正的挑战不是代码实现，而是 Goal 评估器的设计和 Token 成本控制。**
