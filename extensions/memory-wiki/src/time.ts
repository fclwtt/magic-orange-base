// Memory Wiki plugin module implements time behavior.
import { timestampMsToIsoString } from "mo/plugin-sdk/number-runtime";

export function resolveMemoryWikiTimestamp(nowMs?: number): string {
  return (
    timestampMsToIsoString(nowMs) ?? timestampMsToIsoString(Date.now()) ?? new Date().toISOString()
  );
}
