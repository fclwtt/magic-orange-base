/**
 * Loop Engineering — AdversarialEvaluator 对抗验证模块
 *
 * 实现"对抗验证"机制：执行者和评估者使用不同模型/指令，
 * 避免单一 Agent 自我检查的确认偏误。
 *
 * 核心思想：
 * - 执行者（如 GPT-4.1）负责完成任务
 * - 评估者（如 Gemini Flash）独立判断是否达标
 * - 两者分离，形成"写代码"与"审代码"的对抗
 *
 * 改造难度：★★☆☆☆（较低）— 利用 OpenClaw 的子 Agent 机制
 *
 * 对应文章概念：
 * - "Sub-agents: 写代码和验收分离"
 * - "对抗验证 (Adversarial Verification)"
 */

import type { EvaluationRequest, EvaluationResult, EvalVerdict } from './types';

/**
 * LLM 调用接口 — 与 OpenClaw 的 llm-runtime 兼容
 * 实际使用时通过依赖注入传入
 */
export interface LLMCallFn {
  (params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    responseFormat?: { type: string };
    temperature?: number;
  }): Promise<{
    content: string;
    tokensUsed: number;
  }>;
}

export class AdversarialEvaluator {
  private readonly llmCall: LLMCallFn;

  constructor(llmCall: LLMCallFn) {
    this.llmCall = llmCall;
  }

  /**
   * 执行对抗验证评估
   *
   * @param request - 评估请求
   * @returns 评估结果
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
    const prompt = this.buildEvalPrompt(request);

    const response = await this.llmCall({
      model: request.model,
      messages: [
        {
          role: 'system',
          content: EVALUATOR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.1, // 低温度确保评估一致性
    });

    return this.parseEvalResponse(response.content, response.tokensUsed);
  }

  /**
   * 批量评估（用于多轮比较）
   */
  async evaluateWithHistory(
    request: EvaluationRequest,
    history: EvaluationResult[]
  ): Promise<EvaluationResult> {
    // 在请求中包含历史评估，让评估者了解进展趋势
    const enhancedRequest: EvaluationRequest = {
      ...request,
      previousEvaluations: history,
    };

    return this.evaluate(enhancedRequest);
  }

  /**
   * 快速检查（仅判断通过/失败，不做详细分析）
   * 用于成本敏感场景
   */
  async quickCheck(criteria: string, workSummary: string, model: string): Promise<boolean> {
    const response = await this.llmCall({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一个快速检查器。只回答 YES 或 NO。',
        },
        {
          role: 'user',
          content: `标准：${criteria}\n\n产出：${workSummary}\n\n是否满足标准？只回答 YES 或 NO。`,
        },
      ],
      temperature: 0,
    });

    return response.content.trim().toUpperCase().includes('YES');
  }

  private buildEvalPrompt(request: EvaluationRequest): string {
    const sections = [
      `## 任务完成标准`,
      request.criteria,
      ``,
      `## Agent 的工作产出（第 ${request.turn} 轮）`,
      request.workSummary,
    ];

    if (request.gateResult) {
      sections.push(
        ``,
        `## 闸门检查结果`,
        request.gateResult.passed
          ? `✅ 所有闸门检查通过`
          : `❌ 闸门失败: ${request.gateResult.command}\n${request.gateResult.stderr.slice(0, 1000)}`
      );
    }

    if (request.previousEvaluations?.length) {
      const historyLines = request.previousEvaluations.map(
        (e, i) => `- 第 ${i + 1} 轮: ${e.verdict} (置信度 ${e.confidence}) — ${e.reason.slice(0, 100)}`
      );
      sections.push(``, `## 历史评估`, ...historyLines);
    }

    sections.push(
      ``,
      `## 请评估`,
      `请判断任务是否已完成。返回严格的 JSON 格式。`
    );

    return sections.join('\n');
  }

  private parseEvalResponse(content: string, tokensUsed: number): EvaluationResult {
    try {
      const parsed = JSON.parse(content);
      const verdict: EvalVerdict = this.normalizeVerdict(parsed.verdict);

      return {
        verdict,
        reason: parsed.reason ?? parsed.explanation ?? 'No reason provided',
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
        tokensUsed,
        evaluatedAt: new Date().toISOString(),
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : undefined,
      };
    } catch {
      // JSON 解析失败 — 尝试从文本中提取判定
      const verdict = this.extractVerdictFromText(content);
      return {
        verdict,
        reason: `评估响应解析失败，原始内容: ${content.slice(0, 500)}`,
        confidence: 0.3,
        tokensUsed,
        evaluatedAt: new Date().toISOString(),
      };
    }
  }

  private normalizeVerdict(raw: unknown): EvalVerdict {
    if (typeof raw !== 'string') return 'false';
    const lower = raw.toLowerCase().trim();
    if (lower === 'ok' || lower === 'true' || lower === 'pass' || lower === 'yes') return 'ok';
    if (lower === 'impossible') return 'impossible';
    return 'false';
  }

  private extractVerdictFromText(text: string): EvalVerdict {
    const lower = text.toLowerCase();
    if (lower.includes('"verdict": "ok"') || lower.includes('"verdict":"ok"')) return 'ok';
    if (lower.includes('impossible')) return 'impossible';
    return 'false';
  }
}

/** 评估者系统提示词 */
const EVALUATOR_SYSTEM_PROMPT = `你是一个严格的代码审查员和任务评估者。你的角色是独立评估 Agent 的工作产出是否满足既定标准。

## 评估原则
1. **严格性**：不要因为"差不多了"就给 ok。必须完全满足标准才能给 ok。
2. **客观性**：基于事实和证据判断，不凭感觉。
3. **建设性**：如果给 false，必须说明具体差什么、怎么改进。
4. **一致性**：同样的产出应该得到同样的评价。

## 判定标准
- "ok" = 完全满足完成标准，所有闸门通过，代码质量可接受
- "false" = 尚未完成。必须说明还差什么，给出具体改进建议
- "impossible" = 根据当前条件不可能完成。必须说明原因（如缺少依赖、需求矛盾等）

## 输出格式
返回严格的 JSON：
{
  "verdict": "ok" | "false" | "impossible",
  "reason": "具体理由，200字以内",
  "confidence": 0.0-1.0,
  "suggestions": ["改进建议1", "改进建议2"]
}`;
