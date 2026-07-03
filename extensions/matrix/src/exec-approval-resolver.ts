// Matrix plugin module implements exec approval resolver behavior.
import { resolveApprovalOverGateway } from "mo/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "mo/plugin-sdk/approval-runtime";
import type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
import { isApprovalNotFoundError } from "mo/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: OpenClawConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
