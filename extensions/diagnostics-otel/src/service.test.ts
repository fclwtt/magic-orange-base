// Diagnostics Otel tests cover service plugin behavior.
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const telemetryState = vi.hoisted(() => {
  type TestSpanContext = {
    traceId: string;
    spanId: string;
    traceFlags: number;
  };
  const counters = new Map<string, { add: ReturnType<typeof vi.fn> }>();
  const histograms = new Map<string, { record: ReturnType<typeof vi.fn> }>();
  const spans: Array<{
    name: string;
    addEvent: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    setAttributes: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    spanContext: ReturnType<typeof vi.fn<() => TestSpanContext>>;
  }> = [];
  const tracer = {
    startSpan: vi.fn((name: string, _opts?: unknown, _ctx?: unknown) => {
      const spanNumber = spans.length + 1;
      const spanId = spanNumber.toString(16).padStart(16, "0");
      const span = {
        addEvent: vi.fn(),
        end: vi.fn(),
        setAttributes: vi.fn(),
        setStatus: vi.fn(),
        spanContext: vi.fn<() => TestSpanContext>(() => ({
          traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
          spanId,
          traceFlags: 1,
        })),
      };
      spans.push({ name, ...span });
      return span;
    }),
    setSpanContext: vi.fn((_ctx: unknown, spanContext: unknown) => ({ spanContext })),
  };
  const meter = {
    createCounter: vi.fn((name: string) => {
      const counter = { add: vi.fn() };
      counters.set(name, counter);
      return counter;
    }),
    createHistogram: vi.fn((name: string) => {
      const histogram = { record: vi.fn() };
      histograms.set(name, histogram);
      return histogram;
    }),
  };
  return { counters, histograms, spans, tracer, meter };
});

const sdkStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const sdkShutdown = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const logEmit = vi.hoisted(() => vi.fn());
const logShutdown = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const traceExporterCtor = vi.hoisted(() => vi.fn());
const metricExporterCtor = vi.hoisted(() => vi.fn());
const logExporterCtor = vi.hoisted(() => vi.fn());
const spanProcessorCtor = vi.hoisted(() => vi.fn());
const unhandledRejectionHandlerState = vi.hoisted(() => {
  let handlers: Array<(reason: unknown) => boolean> = [];
  return {
    getHandlers: () => handlers,
    register: vi.fn((handler: (reason: unknown) => boolean) => {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter((candidate) => candidate !== handler);
      };
    }),
    reset: () => {
      handlers = [];
    },
  };
});

vi.mock("@opentelemetry/api", () => ({
  context: {
    active: () => ({}),
  },
  metrics: {
    getMeter: () => telemetryState.meter,
  },
  trace: {
    getTracer: () => telemetryState.tracer,
    setSpanContext: telemetryState.tracer.setSpanContext,
  },
  TraceFlags: {
    NONE: 0,
    SAMPLED: 1,
  },
  SpanStatusCode: {
    ERROR: 2,
  },
  SpanKind: {
    CLIENT: 2,
  },
}));

vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    start = sdkStart;
    shutdown = sdkShutdown;
  },
}));

vi.mock("@opentelemetry/exporter-metrics-otlp-proto", () => ({
  OTLPMetricExporter: function OTLPMetricExporter(options?: unknown) {
    metricExporterCtor(options);
  },
}));

vi.mock("@opentelemetry/exporter-trace-otlp-proto", () => ({
  OTLPTraceExporter: function OTLPTraceExporter(options?: unknown) {
    traceExporterCtor(options);
  },
}));

vi.mock("@opentelemetry/exporter-logs-otlp-proto", () => ({
  OTLPLogExporter: function OTLPLogExporter(options?: unknown) {
    logExporterCtor(options);
  },
}));

vi.mock("mo/plugin-sdk/runtime-env", () => ({
  registerUnhandledRejectionHandler: unhandledRejectionHandlerState.register,
}));

vi.mock("@opentelemetry/sdk-logs", () => ({
  BatchLogRecordProcessor: function BatchLogRecordProcessor() {},
  LoggerProvider: class {
    getLogger = vi.fn(() => ({
      emit: logEmit,
    }));
    shutdown = logShutdown;
  },
}));

vi.mock("@opentelemetry/sdk-metrics", () => ({
  PeriodicExportingMetricReader: function PeriodicExportingMetricReader() {},
}));

vi.mock("@opentelemetry/sdk-trace-base", () => ({
  BatchSpanProcessor: function BatchSpanProcessor(exporter?: unknown, options?: unknown) {
    spanProcessorCtor(exporter, options);
  },
  ParentBasedSampler: function ParentBasedSampler() {},
  TraceIdRatioBasedSampler: function TraceIdRatioBasedSampler() {},
}));

vi.mock("@opentelemetry/resources", () => ({
  resourceFromAttributes: vi.fn((attrs: Record<string, unknown>) => attrs),
  Resource: function Resource(_value?: unknown) {
    // Constructor shape required by the mocked OpenTelemetry API.
  },
}));

vi.mock("@opentelemetry/semantic-conventions", () => ({
  ATTR_SERVICE_NAME: "service.name",
}));

import {
  createDiagnosticTraceContext,
  emitTrustedDiagnosticEvent,
  emitTrustedDiagnosticEventWithPrivateData,
  onInternalDiagnosticEvent,
  resetDiagnosticEventsForTest,
  waitForDiagnosticEventsDrained,
  type DiagnosticEventPrivateData,
} from "mo/plugin-sdk/diagnostic-runtime";
import {
  emitDiagnosticEventWithTrustedTraceContext,
  emitInternalDiagnosticEventForTest,
  emitTrustedSecurityEvent,
  logMessageDispatchStarted,
  logMessageProcessed,
  onTrustedInternalDiagnosticEvent,
  runWithDiagnosticTraceContext,
} from "mo/plugin-sdk/plugin-test-runtime";
import type { OpenClawPluginServiceContext } from "../api.js";
import { emitDiagnosticEvent } from "../api.js";
import { createDiagnosticsOtelService } from "./service.js";

const OTEL_TEST_STATE_DIR = "/tmp/mo-diagnostics-otel-test";
const OTEL_TEST_ENDPOINT = "http://otel-collector:4318";
const OTEL_TEST_PROTOCOL = "http/protobuf";
const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN_ID = "00f067aa0ba902b7";
const CHILD_SPAN_ID = "1111111111111111";
const GRANDCHILD_SPAN_ID = "2222222222222222";
const TOOL_SPAN_ID = "3333333333333333";
const MODEL_CALL_SPAN_ID = "4444444444444444";
const MODEL_USAGE_SPAN_ID = "5555555555555555";

function numberedSpanId(index: number) {
  return (index + 0x1000).toString(16).padStart(16, "0");
}
const PROTO_KEY = "__proto__";
const MAX_TEST_OTEL_CONTENT_ATTRIBUTE_CHARS = 128 * 1024;
const OTEL_TRUNCATED_SUFFIX_MAX_CHARS = 20;
const ORIGINAL_MO_OTEL_PRELOADED = process.env.MO_OTEL_PRELOADED;
const ORIGINAL_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
const ORIGINAL_OTEL_EXPORTER_OTLP_METRICS_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
const ORIGINAL_OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
const ORIGINAL_OTEL_SEMCONV_STABILITY_OPT_IN = process.env.OTEL_SEMCONV_STABILITY_OPT_IN;

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

type OtelContextFlags = {
  traces?: boolean;
  metrics?: boolean;
  logs?: boolean;
  protocol?: NonNullable<
    NonNullable<OpenClawPluginServiceContext["config"]["diagnostics"]>["otel"]
  >["protocol"];
  logsExporter?: NonNullable<
    NonNullable<OpenClawPluginServiceContext["config"]["diagnostics"]>["otel"]
  >["logsExporter"];
  captureContent?: NonNullable<
    NonNullable<OpenClawPluginServiceContext["config"]["diagnostics"]>["otel"]
  >["captureContent"];
};
function createOtelContext(
  endpoint: string,
  {
    traces = false,
    metrics = false,
    logs = false,
    protocol = OTEL_TEST_PROTOCOL,
    logsExporter,
    captureContent,
  }: OtelContextFlags = {},
): OpenClawPluginServiceContext {
  return {
    config: {
      diagnostics: {
        enabled: true,
        otel: {
          enabled: true,
          endpoint,
          protocol,
          traces,
          metrics,
          logs,
          ...(logsExporter !== undefined ? { logsExporter } : {}),
          ...(captureContent !== undefined ? { captureContent } : {}),
        },
      },
    },
    logger: createLogger(),
    stateDir: OTEL_TEST_STATE_DIR,
    internalDiagnostics: {
      emit: emitTrustedDiagnosticEventWithPrivateData,
      onEvent: onTrustedInternalDiagnosticEvent,
    },
  };
}

function createTraceOnlyContext(endpoint: string): OpenClawPluginServiceContext {
  return createOtelContext(endpoint, { traces: true });
}

function startedSpanCall(name: string) {
  const calls = telemetryState.tracer.startSpan.mock.calls as unknown as Array<
    [
      string,
      { attributes?: Record<string, unknown>; kind?: unknown; startTime?: unknown }?,
      unknown?,
    ]
  >;
  return calls.find(([spanName]) => spanName === name);
}

function startedSpanOptions(name: string) {
  return startedSpanCall(name)?.[1];
}

function startedSpanParentContexts(name: string) {
  return telemetryState.tracer.startSpan.mock.calls
    .filter((call) => call[0] === name)
    .map(
      (call) =>
        (call[2] as { spanContext?: { traceId?: string; spanId?: string } } | undefined)
          ?.spanContext,
    );
}

function startedSpanParentContextsByName(name: string) {
  return telemetryState.tracer.startSpan.mock.calls
    .filter((call) => call[0] === name)
    .map((call) => ({
      attributes: (call[1] as { attributes?: Record<string, unknown> } | undefined)?.attributes,
      parentContext: (
        call[2] as { spanContext?: { traceId?: string; spanId?: string } } | undefined
      )?.spanContext,
    }));
}

function mockCall(mock: { mock: { calls: unknown[][] } }, callIndex = 0): unknown[] {
  const call = mock.mock.calls.at(callIndex);
  if (!call) {
    throw new Error(`Expected mock call at index ${callIndex}`);
  }
  return call;
}

function mockCallArg(mock: { mock: { calls: unknown[][] } }, argIndex: number, callIndex = 0) {
  return mockCall(mock, callIndex)[argIndex];
}

function firstExporterOptions(mock: { mock: { calls: unknown[][] } }): { url?: string } {
  return mockCallArg(mock, 0) as { url?: string };
}

function firstSpanProcessorOptions(): { scheduledDelayMillis?: number } {
  return mockCallArg(spanProcessorCtor, 1) as { scheduledDelayMillis?: number };
}

function firstSetSpanContext(): Record<string, unknown> {
  return mockCallArg(telemetryState.tracer.setSpanContext, 1) as Record<string, unknown>;
}

function spanByName(name: string): (typeof telemetryState.spans)[number] {
  const span = telemetryState.spans.find((candidate) => candidate.name === name);
  if (!span) {
    throw new Error(`Expected span ${name}`);
  }
  return span;
}

function firstSpanAttributes(name: string): Record<string, unknown> {
  return mockCallArg(spanByName(name).setAttributes, 0) as Record<string, unknown>;
}

function stringAttribute(attrs: Record<string, unknown> | undefined, key: string): string {
  const value = attrs?.[key];
  expect(value).toEqual(expect.any(String));
  return value as string;
}

function firstSpanEndTime(name: string): unknown {
  return mockCallArg(spanByName(name).end, 0);
}

function firstCounterAddCall(name: string): [unknown, Record<string, unknown>?] {
  const counter = telemetryState.counters.get(name);
  if (!counter) {
    throw new Error(`Expected counter ${name}`);
  }
  return mockCall(counter.add) as [unknown, Record<string, unknown>?];
}

function lastHistogramRecord(name: string) {
  return telemetryState.histograms.get(name)?.record.mock.calls.at(-1) as
    | [unknown, Record<string, unknown>?]
    | undefined;
}

function histogramCreateOptions(name: string) {
  const calls = telemetryState.meter.createHistogram.mock.calls as unknown as Array<
    [string, unknown?]
  >;
  const call = calls.find(([histogramName]) => histogramName === name);
  return call?.[1] as
    | { unit?: unknown; advice?: { explicitBucketBoundaries?: unknown[] } }
    | undefined;
}

type StdoutDiagnosticLogLine = {
  ts?: string;
  signal?: string;
  "service.name"?: string;
  severityText?: string;
  severityNumber?: number;
  body?: unknown;
  attributes?: Record<string, unknown>;
  trace_id?: string;
  span_id?: string;
  trace_flags?: string;
};

function captureStdoutWrites() {
  const writes: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stdout.write);
  return { writes, spy };
}

function parseSingleStdoutDiagnosticLogLine(writes: string[]): StdoutDiagnosticLogLine {
  expect(writes).toHaveLength(1);
  expect(writes[0]?.endsWith("\n")).toBe(true);
  const line = writes[0]?.slice(0, -1) ?? "";
  expect(line).not.toContain("\n");
  return JSON.parse(line) as StdoutDiagnosticLogLine;
}

async function emitAndCaptureLog(
  event: Omit<Extract<Parameters<typeof emitDiagnosticEvent>[0], { type: "log.record" }>, "type">,
  options: {
    captureContent?: OtelContextFlags["captureContent"];
    trusted?: boolean;
    trustedTraceContext?: boolean;
  } = {},
) {
  const service = createDiagnosticsOtelService();
  const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
    logs: true,
    ...(options.captureContent !== undefined ? { captureContent: options.captureContent } : {}),
  });
  await service.start(ctx);
  const emit = options.trusted
    ? emitTrustedDiagnosticEvent
    : options.trustedTraceContext
      ? emitDiagnosticEventWithTrustedTraceContext
      : emitDiagnosticEvent;
  emit({
    type: "log.record",
    ...event,
  });
  await flushDiagnosticEvents();
  expect(logEmit).toHaveBeenCalled();
  const emitCall = mockCallArg(logEmit, 0) as {
    attributes?: Record<string, unknown>;
    body?: string;
    context?: unknown;
  };
  await service.stop?.(ctx);
  return emitCall;
}

function flushDiagnosticEvents() {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function emitTrustedModelCallCompletedWithContent(
  event: Omit<
    Extract<Parameters<typeof emitDiagnosticEvent>[0], { type: "model.call.completed" }>,
    "type"
  >,
  modelContent: NonNullable<DiagnosticEventPrivateData["modelContent"]>,
) {
  emitTrustedDiagnosticEventWithPrivateData(
    {
      type: "model.call.completed",
      ...event,
    },
    { modelContent },
  );
}

function emitTrustedToolExecutionCompletedWithContent(
  event: Omit<
    Extract<Parameters<typeof emitDiagnosticEvent>[0], { type: "tool.execution.completed" }>,
    "type"
  >,
  toolContent: NonNullable<DiagnosticEventPrivateData["toolContent"]>,
) {
  emitTrustedDiagnosticEventWithPrivateData(
    {
      type: "tool.execution.completed",
      ...event,
    },
    { toolContent },
  );
}

afterAll(() => {
  vi.doUnmock("@opentelemetry/api");
  vi.doUnmock("@opentelemetry/sdk-node");
  vi.doUnmock("@opentelemetry/exporter-metrics-otlp-proto");
  vi.doUnmock("@opentelemetry/exporter-trace-otlp-proto");
  vi.doUnmock("@opentelemetry/exporter-logs-otlp-proto");
  vi.doUnmock("@opentelemetry/sdk-logs");
  vi.doUnmock("@opentelemetry/sdk-metrics");
  vi.doUnmock("@opentelemetry/sdk-trace-base");
  vi.doUnmock("@opentelemetry/resources");
  vi.doUnmock("@opentelemetry/semantic-conventions");
  vi.resetModules();
});

describe("diagnostics-otel service", () => {
  beforeEach(() => {
    resetDiagnosticEventsForTest();
    delete process.env.MO_OTEL_PRELOADED;
    delete process.env.OTEL_SEMCONV_STABILITY_OPT_IN;
    telemetryState.counters.clear();
    telemetryState.histograms.clear();
    telemetryState.spans.length = 0;
    telemetryState.tracer.startSpan.mockClear();
    telemetryState.tracer.setSpanContext.mockClear();
    telemetryState.meter.createCounter.mockClear();
    telemetryState.meter.createHistogram.mockClear();
    sdkStart.mockClear();
    sdkShutdown.mockClear();
    logEmit.mockReset();
    logShutdown.mockClear();
    traceExporterCtor.mockClear();
    metricExporterCtor.mockClear();
    logExporterCtor.mockClear();
    spanProcessorCtor.mockClear();
    unhandledRejectionHandlerState.reset();
    unhandledRejectionHandlerState.register.mockClear();
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  });

  afterEach(() => {
    resetDiagnosticEventsForTest();
    if (ORIGINAL_MO_OTEL_PRELOADED === undefined) {
      delete process.env.MO_OTEL_PRELOADED;
    } else {
      process.env.MO_OTEL_PRELOADED = ORIGINAL_MO_OTEL_PRELOADED;
    }
    if (ORIGINAL_OTEL_SEMCONV_STABILITY_OPT_IN === undefined) {
      delete process.env.OTEL_SEMCONV_STABILITY_OPT_IN;
    } else {
      process.env.OTEL_SEMCONV_STABILITY_OPT_IN = ORIGINAL_OTEL_SEMCONV_STABILITY_OPT_IN;
    }
    if (ORIGINAL_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT === undefined) {
      delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    } else {
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = ORIGINAL_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    }
    if (ORIGINAL_OTEL_EXPORTER_OTLP_METRICS_ENDPOINT === undefined) {
      delete process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    } else {
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT =
        ORIGINAL_OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    }
    if (ORIGINAL_OTEL_EXPORTER_OTLP_LOGS_ENDPOINT === undefined) {
      delete process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
    } else {
      process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = ORIGINAL_OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
    }
  });

  test("drops camelCase and snake_case diagnostic id log attributes before export", async () => {
    const emitCall = await emitAndCaptureLog({
      level: "INFO",
      message: "diagnostic id attributes",
      attributes: {
        callId: "call-camel",
        call_id: "call-snake",
        chatId: "chat-camel",
        chat_id: "chat-snake",
        messageId: "message-camel",
        message_id: "message-snake",
        parentSpanId: "parent-camel",
        parent_span_id: "parent-snake",
        runId: "run-camel",
        run_id: "run-snake",
        sessionId: "session-camel",
        session_id: "session-snake",
        sessionKey: "session-key-camel",
        session_key: "session-key-snake",
        spanId: "span-camel",
        span_id: "span-snake",
        toolCallId: "tool-camel",
        tool_call_id: "tool-snake",
        traceId: "trace-camel",
        trace_id: "trace-snake",
        provider: "openai",
      },
    });

    expect(emitCall.attributes?.["mo.provider"]).toBe("openai");
    for (const key of [
      "mo.callId",
      "mo.call_id",
      "mo.chatId",
      "mo.chat_id",
      "mo.messageId",
      "mo.message_id",
      "mo.parentSpanId",
      "mo.parent_span_id",
      "mo.runId",
      "mo.run_id",
      "mo.sessionId",
      "mo.session_id",
      "mo.sessionKey",
      "mo.session_key",
      "mo.spanId",
      "mo.span_id",
      "mo.toolCallId",
      "mo.tool_call_id",
      "mo.traceId",
      "mo.trace_id",
    ]) {
      expect(Object.hasOwn(emitCall.attributes ?? {}, key)).toBe(false);
    }
  });

  test("records message-flow metrics and spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true, logs: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "webhook.received",
      channel: "telegram",
      updateType: "telegram-post",
    });
    emitDiagnosticEvent({
      type: "webhook.processed",
      channel: "telegram",
      updateType: "telegram-post",
      chatId: "chat-should-not-export",
      durationMs: 120,
    });
    emitDiagnosticEvent({
      type: "message.queued",
      channel: "telegram",
      source: "telegram",
      queueDepth: 2,
    });
    emitDiagnosticEvent({
      type: "message.received",
      channel: "telegram",
      source: "webhook",
    });
    emitDiagnosticEvent({
      type: "message.dispatch.started",
      channel: "telegram",
      source: "webhook",
    });
    emitDiagnosticEvent({
      type: "message.dispatch.completed",
      channel: "telegram",
      source: "webhook",
      durationMs: 25,
      outcome: "completed",
    });
    emitDiagnosticEvent({
      type: "message.received",
      channel: "telegram/custom",
      source: "webhook with secret sk-test",
    });
    emitDiagnosticEvent({
      type: "message.dispatch.started",
      channel: "telegram/custom",
      source: "webhook with secret sk-test",
    });
    emitDiagnosticEvent({
      type: "message.dispatch.completed",
      channel: "telegram/custom",
      source: "webhook with secret sk-test",
      durationMs: 30,
      outcome: "completed",
      reason: "progress draft / message tool 123",
    });
    emitDiagnosticEvent({
      type: "message.processed",
      channel: "telegram",
      chatId: "chat-should-not-export",
      messageId: "message-should-not-export",
      outcome: "completed",
      reason: "progress draft / message tool 123",
      durationMs: 55,
    });
    emitDiagnosticEvent({
      type: "queue.lane.dequeue",
      lane: "main",
      queueSize: 3,
      waitMs: 10,
    });
    emitDiagnosticEvent({
      type: "session.stuck",
      state: "processing",
      ageMs: 125_000,
      classification: "stale_session_state",
    });
    emitDiagnosticEvent({
      type: "run.attempt",
      runId: "run-1",
      attempt: 2,
    });

    expect(telemetryState.counters.get("mo.webhook.received")?.add).toHaveBeenCalledWith(1, {
      "mo.channel": "telegram",
      "mo.webhook": "telegram-post",
    });
    expect(
      telemetryState.histograms.get("mo.webhook.duration_ms")?.record,
    ).toHaveBeenCalledWith(120, {
      "mo.channel": "telegram",
      "mo.webhook": "telegram-post",
    });
    expect(telemetryState.counters.get("mo.message.queued")?.add).toHaveBeenCalledWith(1, {
      "mo.channel": "telegram",
      "mo.source": "telegram",
    });
    expect(telemetryState.histograms.get("mo.queue.depth")?.record).toHaveBeenCalledTimes(2);
    expect(telemetryState.histograms.get("mo.queue.depth")?.record).toHaveBeenCalledWith(2, {
      "mo.channel": "telegram",
      "mo.source": "telegram",
    });
    expect(telemetryState.histograms.get("mo.queue.depth")?.record).toHaveBeenCalledWith(3, {
      "mo.lane": "main",
    });
    expect(telemetryState.counters.get("mo.message.processed")?.add).toHaveBeenCalledWith(1, {
      "mo.channel": "telegram",
      "mo.outcome": "completed",
    });
    expect(telemetryState.counters.get("mo.message.received")?.add).toHaveBeenCalledWith(1, {
      "mo.channel": "telegram",
      "mo.source": "webhook",
    });
    expect(telemetryState.counters.get("mo.message.received")?.add).toHaveBeenCalledWith(1, {
      "mo.channel": "unknown",
      "mo.source": "unknown",
    });
    expect(
      telemetryState.counters.get("mo.message.dispatch.started")?.add,
    ).toHaveBeenCalledWith(1, {
      "mo.channel": "telegram",
      "mo.source": "webhook",
    });
    expect(
      telemetryState.counters.get("mo.message.dispatch.started")?.add,
    ).toHaveBeenCalledWith(1, {
      "mo.channel": "unknown",
      "mo.source": "unknown",
    });
    expect(
      telemetryState.counters.get("mo.message.dispatch.completed")?.add,
    ).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        "mo.channel": "telegram",
        "mo.outcome": "completed",
        "mo.source": "webhook",
      }),
    );
    expect(
      telemetryState.counters.get("mo.message.dispatch.completed")?.add,
    ).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        "mo.channel": "unknown",
        "mo.reason": "none",
        "mo.source": "unknown",
      }),
    );
    expect(
      telemetryState.histograms.get("mo.message.dispatch.duration_ms")?.record,
    ).toHaveBeenCalledWith(
      25,
      expect.objectContaining({
        "mo.channel": "telegram",
        "mo.outcome": "completed",
        "mo.source": "webhook",
      }),
    );
    expect(
      telemetryState.histograms.get("mo.message.dispatch.duration_ms")?.record,
    ).toHaveBeenCalledWith(
      30,
      expect.objectContaining({
        "mo.channel": "unknown",
        "mo.reason": "none",
        "mo.source": "unknown",
      }),
    );
    expect(
      telemetryState.histograms.get("mo.message.duration_ms")?.record,
    ).toHaveBeenCalledWith(55, {
      "mo.channel": "telegram",
      "mo.outcome": "completed",
    });
    expect(telemetryState.histograms.get("mo.queue.wait_ms")?.record).toHaveBeenCalledWith(
      10,
      {
        "mo.lane": "main",
      },
    );
    expect(telemetryState.counters.get("mo.session.stuck")?.add).toHaveBeenCalledTimes(1);
    expect(telemetryState.counters.get("mo.session.stuck")?.add).toHaveBeenCalledWith(1, {
      "mo.state": "processing",
    });
    expect(
      telemetryState.histograms.get("mo.session.stuck_age_ms")?.record,
    ).toHaveBeenCalledWith(125_000, {
      "mo.state": "processing",
    });
    expect(telemetryState.counters.get("mo.run.attempt")?.add).toHaveBeenCalledWith(1, {
      "mo.attempt": 2,
    });

    emitDiagnosticEvent({
      type: "session.turn.created",
      runId: "run-1",
      agentId: "agent.default",
      channel: "telegram",
      trigger: "user",
    });
    expect(telemetryState.counters.get("mo.session.turn.created")?.add).toHaveBeenCalledWith(
      1,
      {
        "mo.agent": "agent.default",
        "mo.channel": "telegram",
        "mo.trigger": "user",
      },
    );

    const spanNames = telemetryState.tracer.startSpan.mock.calls.map((call) => call[0]);
    expect(spanNames).toContain("mo.webhook.processed");
    expect(spanNames).toContain("mo.message.processed");
    expect(spanNames).toContain("mo.session.stuck");
    const webhookSpanOptions = startedSpanOptions("mo.webhook.processed");
    expect(webhookSpanOptions?.attributes).not.toHaveProperty("mo.chatId");
    expect(webhookSpanOptions?.startTime).toBeTypeOf("number");
    const messageSpanOptions = startedSpanOptions("mo.message.processed");
    expect(messageSpanOptions?.attributes?.["mo.channel"]).toBe("telegram");
    expect(messageSpanOptions?.attributes?.["mo.outcome"]).toBe("completed");
    expect(messageSpanOptions?.attributes?.["mo.reason"]).toBe("unknown");
    expect(messageSpanOptions?.attributes).not.toHaveProperty("mo.chatId");
    expect(messageSpanOptions?.attributes).not.toHaveProperty("mo.messageId");
    expect(messageSpanOptions?.startTime).toBeTypeOf("number");

    emitDiagnosticEvent({
      type: "log.record",
      level: "INFO",
      message: "hello",
      attributes: { subsystem: "diagnostic" },
    });
    await flushDiagnosticEvents();
    expect(logEmit).toHaveBeenCalled();

    await service.stop?.(ctx);
  });

  test("restarts without retaining prior listeners or log transports", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true, logs: true });
    await service.start(ctx);
    await service.start(ctx);

    expect(logShutdown).toHaveBeenCalledTimes(1);
    expect(sdkShutdown).toHaveBeenCalledTimes(1);

    telemetryState.tracer.startSpan.mockClear();
    emitDiagnosticEvent({
      type: "message.processed",
      channel: "telegram",
      outcome: "completed",
      durationMs: 10,
    });
    expect(telemetryState.tracer.startSpan).toHaveBeenCalledTimes(1);

    await service.stop?.(ctx);
    expect(logShutdown).toHaveBeenCalledTimes(2);
    expect(sdkShutdown).toHaveBeenCalledTimes(2);

    telemetryState.tracer.startSpan.mockClear();
    emitDiagnosticEvent({
      type: "message.processed",
      channel: "telegram",
      outcome: "completed",
      durationMs: 10,
    });
    expect(telemetryState.tracer.startSpan).not.toHaveBeenCalled();
  });

  test("registers and removes an OTLP exporter unhandled rejection handler", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true, logs: true });

    await service.start(ctx);

    expect(unhandledRejectionHandlerState.register).toHaveBeenCalledTimes(1);
    const handler = unhandledRejectionHandlerState.getHandlers()[0];
    expect(handler).toBeTypeOf("function");

    const errorInstance = Object.assign(new Error("collector gone"), {
      name: "OTLPExporterError",
      code: 410,
    });
    expect(handler?.(errorInstance)).toBe(true);
    expect(handler?.({ name: "OTLPExporterError", code: 410, data: "user_stop" })).toBe(true);
    expect(handler?.([{ name: "OTLPExporterError", code: 410, data: "user_stop" }])).toBe(true);
    expect(
      handler?.(
        new AggregateError(
          [{ name: "OTLPExporterError", code: 410, data: "user_stop" }],
          "export failed",
        ),
      ),
    ).toBe(true);
    expect(handler?.(new Error("other exporter error"))).toBe(false);
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      "diagnostics-otel: suppressed OTLP exporter unhandled rejection (code=410)",
    );

    await service.stop?.(ctx);
    expect(unhandledRejectionHandlerState.getHandlers()).toHaveLength(0);
  });

  test("does not retain an OTLP exporter handler when startup setup fails", async () => {
    const startupError = new Error("trace exporter setup failed");
    traceExporterCtor.mockImplementationOnce(() => {
      throw startupError;
    });
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true });

    await expect(service.start(ctx)).rejects.toBe(startupError);

    expect(unhandledRejectionHandlerState.register).not.toHaveBeenCalled();
    expect(unhandledRejectionHandlerState.getHandlers()).toHaveLength(0);
  });

  test("uses a preloaded OpenTelemetry SDK without dropping diagnostic listeners", async () => {
    process.env.MO_OTEL_PRELOADED = "1";
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true, logs: true });
    await service.start(ctx);

    expect(sdkStart).not.toHaveBeenCalled();
    expect(traceExporterCtor).not.toHaveBeenCalled();
    expect(ctx.logger.info).toHaveBeenCalledWith(
      "diagnostics-otel: using preloaded OpenTelemetry SDK",
    );

    emitDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
    });
    emitDiagnosticEvent({
      type: "log.record",
      level: "INFO",
      message: "preloaded log",
    });
    await flushDiagnosticEvents();

    const runDurationRecordCall = lastHistogramRecord("mo.run.duration_ms");
    expect(runDurationRecordCall?.[0]).toBe(100);
    const runDurationAttributes = runDurationRecordCall?.[1];
    expect(runDurationAttributes?.["mo.provider"]).toBe("openai");
    expect(runDurationAttributes?.["mo.model"]).toBe("gpt-5.4");
    const runSpanOptions = startedSpanOptions("mo.run");
    expect(runSpanOptions?.attributes?.["mo.outcome"]).toBe("completed");
    expect(logEmit).toHaveBeenCalled();

    await service.stop?.(ctx);
    expect(sdkShutdown).not.toHaveBeenCalled();
    expect(logShutdown).toHaveBeenCalledTimes(1);
  });

  test("emits and records bounded telemetry exporter health events", async () => {
    const events: Array<Parameters<Parameters<typeof onInternalDiagnosticEvent>[0]>[0]> = [];
    const unsubscribe = onInternalDiagnosticEvent((event) => {
      if (event.type === "telemetry.exporter") {
        events.push(event);
      }
    });
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true, logs: true });

    await service.start(ctx);

    const exporterEvents = events.filter((event) => event.type === "telemetry.exporter");
    for (const signal of ["traces", "metrics", "logs"]) {
      const event = exporterEvents.find((entry) => entry.signal === signal);
      expect(event?.type).toBe("telemetry.exporter");
      expect(event?.exporter).toBe("diagnostics-otel");
      expect(event?.status).toBe("started");
      expect(event?.reason).toBe("configured");
    }
    expect(
      telemetryState.counters.get("mo.telemetry.exporter.events")?.add,
    ).toHaveBeenCalledWith(1, {
      "mo.exporter": "diagnostics-otel",
      "mo.signal": "logs",
      "mo.status": "started",
      "mo.reason": "configured",
    });

    unsubscribe();
    await service.stop?.(ctx);
  });

  test("exports trusted security events as bounded OTLP logs", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { logs: true });
    const trace = createDiagnosticTraceContext({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      traceFlags: "01",
    });

    await service.start(ctx);
    emitTrustedSecurityEvent({
      eventId: "security-event-1",
      category: "tool",
      action: "tool.execution.blocked",
      outcome: "denied",
      severity: "medium",
      reason: "tools.deny",
      actor: {
        kind: "agent",
        idHash: "agent-hash-1",
        role: "operator",
        scopes: ["operator.read", "operator.approvals"],
      },
      target: {
        kind: "plugin",
        name: "@acme/security-event-plugin",
        owner: "plugin-installer",
      },
      policy: {
        id: "tools.exec",
        decision: "deny",
        reason: "allowlist.miss",
      },
      control: {
        id: "exec-approval",
        family: "approval",
      },
      attributes: {
        params_kind: "object",
        secretish: "token sk-test-secret",
        [PROTO_KEY]: "blocked",
      },
      trace,
    });
    await flushDiagnosticEvents();

    const emitCall = mockCallArg(logEmit, 0) as {
      attributes?: Record<string, unknown>;
      body?: string;
      context?: unknown;
      severityNumber?: number;
      severityText?: string;
    };
    expect(emitCall.body).toBe("mo.security.event");
    expect(emitCall.severityText).toBe("WARN");
    expect(emitCall.severityNumber).toBe(13);
    expect(emitCall.attributes).toMatchObject({
      "mo.security.event_id": "security-event-1",
      "mo.security.category": "tool",
      "mo.security.action": "tool.execution.blocked",
      "mo.security.outcome": "denied",
      "mo.security.severity": "medium",
      "mo.security.reason": "tools.deny",
      "mo.security.actor.kind": "agent",
      "mo.security.actor.id_hash": "agent-hash-1",
      "mo.security.actor.role": "operator",
      "mo.security.actor.scopes": "operator.read,operator.approvals",
      "mo.security.target.kind": "plugin",
      "mo.security.target.name": "@acme/security-event-plugin",
      "mo.security.target.owner": "plugin-installer",
      "mo.security.policy.id": "tools.exec",
      "mo.security.policy.decision": "deny",
      "mo.security.policy.reason": "allowlist.miss",
      "mo.security.control.id": "exec-approval",
      "mo.security.control.family": "approval",
      "mo.security.attribute.params_kind": "object",
      "mo.security.attribute.secretish": "unknown",
    });
    expect(emitCall.context).toEqual({
      spanContext: {
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        traceFlags: 1,
        isRemote: true,
      },
    });
    expect(Object.hasOwn(emitCall.attributes ?? {}, "mo.security.attribute.__proto__")).toBe(
      false,
    );
    expect(JSON.stringify(emitCall)).not.toContain("sk-test-secret");

    await service.stop?.(ctx);
  });

  test("does not export security events when OTLP logs are disabled", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { logs: false, metrics: true });

    await service.start(ctx);
    emitTrustedSecurityEvent({
      eventId: "security-event-logs-disabled",
      category: "auth",
      action: "gateway.auth.failed",
      outcome: "failure",
      severity: "high",
    });
    await flushDiagnosticEvents();

    expect(logEmit).not.toHaveBeenCalled();

    await service.stop?.(ctx);
  });

  test("starts stdout-only logs when OTLP protocol is unsupported", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: false,
      metrics: false,
      logs: true,
      protocol: "grpc",
      logsExporter: "stdout",
    });
    const capture = captureStdoutWrites();
    try {
      await service.start(ctx);
      emitDiagnosticEvent({
        type: "log.record",
        level: "INFO",
        message: "stdout only log",
      });
      await flushDiagnosticEvents();

      const line = parseSingleStdoutDiagnosticLogLine(capture.writes);
      expect(line.body).toBe("log");
      expect(logExporterCtor).not.toHaveBeenCalled();
      expect(traceExporterCtor).not.toHaveBeenCalled();
      expect(metricExporterCtor).not.toHaveBeenCalled();
      expect(ctx.logger.warn).not.toHaveBeenCalledWith(
        "diagnostics-otel: unsupported protocol grpc",
      );
    } finally {
      capture.spy.mockRestore();
      await service.stop?.(ctx);
    }
  });

  test("exports trusted security events as stdout JSONL logs", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext("", { logs: true, logsExporter: "stdout" });
    const trace = createDiagnosticTraceContext({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      traceFlags: "01",
    });
    const stdout = captureStdoutWrites();

    try {
      await service.start(ctx);
      emitTrustedSecurityEvent({
        eventId: "security-event-stdout",
        category: "tool",
        action: "tool.execution.blocked",
        outcome: "denied",
        severity: "medium",
        reason: "tools.deny",
        attributes: {
          secretish: "token sk-test-secret",
          [PROTO_KEY]: "blocked",
        },
        trace,
      });
      await flushDiagnosticEvents();

      expect(logExporterCtor).not.toHaveBeenCalled();
      expect(logEmit).not.toHaveBeenCalled();
      const record = parseSingleStdoutDiagnosticLogLine(stdout.writes);
      expect(record.body).toBe("mo.security.event");
      expect(record.severityText).toBe("WARN");
      expect(record.severityNumber).toBe(13);
      expect(record.attributes).toMatchObject({
        "mo.security.event_id": "security-event-stdout",
        "mo.security.category": "tool",
        "mo.security.action": "tool.execution.blocked",
        "mo.security.outcome": "denied",
        "mo.security.severity": "medium",
        "mo.security.reason": "tools.deny",
        "mo.security.attribute.secretish": "unknown",
      });
      expect(Object.hasOwn(record.attributes ?? {}, "mo.security.attribute.__proto__")).toBe(
        false,
      );
      expect(record.trace_id).toBe(TRACE_ID);
      expect(record.span_id).toBe(SPAN_ID);
      expect(record.trace_flags).toBe("01");
      expect(JSON.stringify(record)).not.toContain("sk-test-secret");
    } finally {
      stdout.spy.mockRestore();
      await service.stop?.(ctx);
    }
  });

  test("records liveness warning diagnostics", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });

    await service.start(ctx);
    emitDiagnosticEvent({
      type: "diagnostic.liveness.warning",
      reasons: ["event_loop_delay", "cpu"],
      intervalMs: 30_000,
      eventLoopDelayP99Ms: 250,
      eventLoopDelayMaxMs: 900,
      eventLoopUtilization: 0.95,
      cpuUserMs: 1200,
      cpuSystemMs: 300,
      cpuTotalMs: 1500,
      cpuCoreRatio: 1.4,
      active: 2,
      waiting: 1,
      queued: 4,
    });
    await flushDiagnosticEvents();

    expect(telemetryState.counters.get("mo.liveness.warning")?.add).toHaveBeenCalledWith(1, {
      "mo.liveness.reason": "event_loop_delay:cpu",
    });
    expect(
      telemetryState.histograms.get("mo.liveness.event_loop_delay_p99_ms")?.record,
    ).toHaveBeenCalledWith(250, {
      "mo.liveness.reason": "event_loop_delay:cpu",
    });
    expect(
      telemetryState.histograms.get("mo.liveness.cpu_core_ratio")?.record,
    ).toHaveBeenCalledWith(1.4, {
      "mo.liveness.reason": "event_loop_delay:cpu",
    });
    const livenessSpanOptions = startedSpanOptions("mo.liveness.warning");
    expect(livenessSpanOptions?.attributes?.["mo.liveness.reason"]).toBe(
      "event_loop_delay:cpu",
    );
    expect(livenessSpanOptions?.attributes?.["mo.liveness.active"]).toBe(2);
    expect(livenessSpanOptions?.attributes?.["mo.liveness.queued"]).toBe(4);
    const span = telemetryState.spans.find((item) => item.name === "mo.liveness.warning");
    expect(span?.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "event_loop_delay:cpu",
    });

    await service.stop?.(ctx);
  });

  test("records oversized payload metrics without raw identifiers", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true, traces: false });

    await service.start(ctx);
    emitTrustedDiagnosticEvent({
      type: "payload.large",
      surface: "gateway.frame",
      action: "rejected",
      bytes: 2048,
      limitBytes: 1024,
      channel: "web",
      pluginId: "agent:qa:otel-trace-smoke",
      reason: "body-too-large",
    });
    await flushDiagnosticEvents();

    expect(telemetryState.counters.get("mo.payload.large")?.add).toHaveBeenCalledWith(1, {
      "mo.payload.action": "rejected",
      "mo.payload.surface": "gateway.frame",
      "mo.channel": "web",
      "mo.plugin": "none",
      "mo.reason": "body-too-large",
    });
    expect(
      telemetryState.histograms.get("mo.payload.large_bytes")?.record,
    ).toHaveBeenCalledWith(2048, {
      "mo.payload.action": "rejected",
      "mo.payload.surface": "gateway.frame",
      "mo.channel": "web",
      "mo.plugin": "none",
      "mo.reason": "body-too-large",
    });

    await service.stop?.(ctx);
  });

  test("reports log exporter emit failures without exporting raw error text", async () => {
    const events: Array<Parameters<Parameters<typeof onInternalDiagnosticEvent>[0]>[0]> = [];
    const unsubscribe = onInternalDiagnosticEvent((event) => {
      if (event.type === "telemetry.exporter") {
        events.push(event);
      }
    });
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { logs: true });
    logEmit.mockImplementationOnce(() => {
      throw new TypeError("token sk-test-secret should not leave as telemetry");
    });

    await service.start(ctx);
    emitDiagnosticEvent({
      type: "log.record",
      level: "INFO",
      message: "export me",
    });
    await flushDiagnosticEvents();

    const exporterEvents = events.filter((event) => event.type === "telemetry.exporter");
    const failureEvent = exporterEvents.find((event) => event.status === "failure");
    expect(failureEvent?.type).toBe("telemetry.exporter");
    expect(failureEvent?.exporter).toBe("diagnostics-otel");
    expect(failureEvent?.signal).toBe("logs");
    expect(failureEvent?.status).toBe("failure");
    expect(failureEvent?.reason).toBe("emit_failed");
    expect(failureEvent?.errorCategory).toBe("TypeError");
    expect(
      telemetryState.counters.get("mo.telemetry.exporter.events")?.add,
    ).toHaveBeenCalledWith(1, {
      "mo.exporter": "diagnostics-otel",
      "mo.signal": "logs",
      "mo.status": "failure",
      "mo.reason": "emit_failed",
      "mo.errorCategory": "TypeError",
    });

    unsubscribe();
    await service.stop?.(ctx);
  });

  test("ignores untrusted telemetry exporter events for OTEL metrics", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });

    await service.start(ctx);
    telemetryState.counters.get("mo.telemetry.exporter.events")?.add.mockClear();
    emitDiagnosticEvent({
      type: "telemetry.exporter",
      exporter: "spoofed-plugin-exporter",
      signal: "metrics",
      status: "failure",
      reason: "emit_failed",
    });

    expect(
      telemetryState.counters.get("mo.telemetry.exporter.events")?.add,
    ).not.toHaveBeenCalled();

    await service.stop?.(ctx);
  });

  test("records hook-blocked run metrics with safe blocker originator", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "blocked",
      blockedBy: "policy-plugin",
      durationMs: 100,
    });
    await flushDiagnosticEvents();

    const runDurationRecordCall = lastHistogramRecord("mo.run.duration_ms");
    expect(runDurationRecordCall?.[0]).toBe(100);
    expect(runDurationRecordCall?.[1]?.["mo.outcome"]).toBe("blocked");
    expect(runDurationRecordCall?.[1]?.["mo.blocked_by"]).toBe("policy-plugin");
    expect(JSON.stringify(telemetryState)).not.toContain("matched secret prompt");

    await service.stop?.(ctx);
  });

  test("honors disabled traces when an OpenTelemetry SDK is preloaded", async () => {
    process.env.MO_OTEL_PRELOADED = "1";
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: false, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
    });
    await flushDiagnosticEvents();

    expect(sdkStart).not.toHaveBeenCalled();
    const runDurationRecordCall = lastHistogramRecord("mo.run.duration_ms");
    expect(runDurationRecordCall?.[0]).toBe(100);
    expect(runDurationRecordCall?.[1]?.["mo.provider"]).toBe("openai");
    expect(telemetryState.tracer.startSpan).not.toHaveBeenCalled();

    await service.stop?.(ctx);
    expect(sdkShutdown).not.toHaveBeenCalled();
  });

  test("treats omitted diagnostics enabled flag as enabled", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      captureContent: true,
    });
    delete (ctx.config.diagnostics as { enabled?: boolean }).enabled;
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      { inputMessages: ["user prompt"] },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const attrs = (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;
    expect(attrs?.["mo.content.input_messages"]).toBe("user prompt");

    await service.stop?.(ctx);
  });

  test("tears down active handles when restarted with diagnostics disabled", async () => {
    const service = createDiagnosticsOtelService();
    const enabledCtx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      metrics: true,
      logs: true,
    });
    await service.start(enabledCtx);
    await service.start({
      ...enabledCtx,
      config: { diagnostics: { enabled: false } },
    });

    expect(logShutdown).toHaveBeenCalledTimes(1);
    expect(sdkShutdown).toHaveBeenCalledTimes(1);

    telemetryState.tracer.startSpan.mockClear();
    emitDiagnosticEvent({
      type: "message.processed",
      channel: "telegram",
      outcome: "completed",
      durationMs: 10,
    });
    expect(telemetryState.tracer.startSpan).not.toHaveBeenCalled();
  });

  test("appends signal path when endpoint contains non-signal /v1 segment", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createTraceOnlyContext("https://www.comet.com/opik/api/v1/private/otel");
    await service.start(ctx);

    const options = firstExporterOptions(traceExporterCtor);
    expect(options.url).toBe("https://www.comet.com/opik/api/v1/private/otel/v1/traces");
    await service.stop?.(ctx);
  });

  test("keeps already signal-qualified endpoint unchanged", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createTraceOnlyContext("https://collector.example.com/v1/traces");
    await service.start(ctx);

    const options = firstExporterOptions(traceExporterCtor);
    expect(options.url).toBe("https://collector.example.com/v1/traces");
    await service.stop?.(ctx);
  });

  test("keeps signal-qualified endpoint unchanged when it has query params", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createTraceOnlyContext("https://collector.example.com/v1/traces?timeout=30s");
    await service.start(ctx);

    const options = firstExporterOptions(traceExporterCtor);
    expect(options.url).toBe("https://collector.example.com/v1/traces?timeout=30s");
    await service.stop?.(ctx);
  });

  test("inserts signal path before shared endpoint query params", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createTraceOnlyContext("https://collector.example.com/otlp?timeout=30s");
    await service.start(ctx);

    const options = firstExporterOptions(traceExporterCtor);
    expect(options.url).toBe("https://collector.example.com/otlp/v1/traces?timeout=30s");
    await service.stop?.(ctx);
  });

  test("inserts signal path before shared endpoint fragments", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createTraceOnlyContext("https://collector.example.com/otlp#tenant-a");
    await service.start(ctx);

    const options = firstExporterOptions(traceExporterCtor);
    expect(options.url).toBe("https://collector.example.com/otlp/v1/traces#tenant-a");
    await service.stop?.(ctx);
  });

  test("keeps signal-qualified endpoint unchanged when signal path casing differs", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createTraceOnlyContext("https://collector.example.com/v1/Traces");
    await service.start(ctx);

    const options = firstExporterOptions(traceExporterCtor);
    expect(options.url).toBe("https://collector.example.com/v1/Traces");
    await service.stop?.(ctx);
  });

  test("applies flush interval to trace batching", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createTraceOnlyContext(OTEL_TEST_ENDPOINT);
    ctx.config.diagnostics!.otel!.flushIntervalMs = 250;

    await service.start(ctx);

    expect(spanProcessorCtor).toHaveBeenCalledTimes(1);
    expect(firstSpanProcessorOptions().scheduledDelayMillis).toBe(1000);
    await service.stop?.(ctx);
  });

  test("uses signal-specific OTLP endpoints ahead of the shared endpoint", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      metrics: true,
      logs: true,
    });
    ctx.config.diagnostics!.otel!.tracesEndpoint = "https://trace.example.com/otlp";
    ctx.config.diagnostics!.otel!.metricsEndpoint = "https://metric.example.com/v1/metrics";
    ctx.config.diagnostics!.otel!.logsEndpoint = "https://log.example.com/otlp";

    await service.start(ctx);

    const traceOptions = firstExporterOptions(traceExporterCtor);
    const metricOptions = firstExporterOptions(metricExporterCtor);
    const logOptions = firstExporterOptions(logExporterCtor);
    expect(traceOptions.url).toBe("https://trace.example.com/otlp/v1/traces");
    expect(metricOptions.url).toBe("https://metric.example.com/v1/metrics");
    expect(logOptions.url).toBe("https://log.example.com/otlp/v1/logs");
    await service.stop?.(ctx);
  });

  test("uses signal-specific OTLP env endpoints when config is unset", async () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "https://trace-env.example.com/v1/traces";
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = "https://metric-env.example.com/otlp";
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = "https://log-env.example.com/otlp";

    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      metrics: true,
      logs: true,
    });
    await service.start(ctx);

    const traceOptions = firstExporterOptions(traceExporterCtor);
    const metricOptions = firstExporterOptions(metricExporterCtor);
    const logOptions = firstExporterOptions(logExporterCtor);
    expect(traceOptions.url).toBe("https://trace-env.example.com/v1/traces");
    expect(metricOptions.url).toBe("https://metric-env.example.com/otlp/v1/metrics");
    expect(logOptions.url).toBe("https://log-env.example.com/otlp/v1/logs");
    await service.stop?.(ctx);
  });

  test("exports diagnostic logs as stdout JSONL without constructing the OTLP log exporter", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext("", {
      logs: true,
      logsExporter: "stdout",
      captureContent: true,
    });
    ctx.config.diagnostics!.otel!.serviceName = "rovoclaw-mo";
    const stdout = captureStdoutWrites();

    try {
      await service.start(ctx);

      expect(logExporterCtor).not.toHaveBeenCalled();
      emitDiagnosticEventWithTrustedTraceContext({
        type: "log.record",
        level: "WARN",
        message: "Using API key sk-1234567890abcdef1234567890abcdef",
        attributes: {
          token: "ghp_abcdefghijklmnopqrstuvwxyz123456", // pragma: allowlist secret
          subsystem: "diagnostic",
        },
        trace: {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          traceFlags: "01",
        },
      });
      await flushDiagnosticEvents();

      expect(logEmit).not.toHaveBeenCalled();
      const record = parseSingleStdoutDiagnosticLogLine(stdout.writes);
      expect(record.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.signal).toBe("mo.diagnostic.log");
      expect(record["service.name"]).toBe("rovoclaw-mo");
      expect(record.severityText).toBe("WARN");
      expect(record.severityNumber).toBe(13);
      expect(String(record.body)).not.toContain("sk-1234567890abcdef1234567890abcdef");
      expect(String(record.body)).toContain("sk-123");
      expect(record.attributes).toMatchObject({
        "mo.log.level": "WARN",
        "mo.subsystem": "diagnostic",
      });
      const tokenAttr = record.attributes?.["mo.token"];
      expect(tokenAttr).not.toBe("ghp_abcdefghijklmnopqrstuvwxyz123456"); // pragma: allowlist secret
      expect(record.trace_id).toBe(TRACE_ID);
      expect(record.span_id).toBe(SPAN_ID);
      expect(JSON.stringify(record)).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456"); // pragma: allowlist secret
    } finally {
      stdout.spy.mockRestore();
      await service.stop?.(ctx);
    }
  });

  test("keeps explicit OTLP log export off stdout", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      logs: true,
      logsExporter: "otlp",
    });
    const stdout = captureStdoutWrites();

    try {
      await service.start(ctx);
      emitDiagnosticEvent({
        type: "log.record",
        level: "INFO",
        message: "otlp only",
      });
      await flushDiagnosticEvents();

      expect(logExporterCtor).toHaveBeenCalledTimes(1);
      expect(logEmit).toHaveBeenCalledTimes(1);
      expect(stdout.writes).toEqual([]);
    } finally {
      stdout.spy.mockRestore();
      await service.stop?.(ctx);
    }
  });

  test("exports diagnostic logs to OTLP and stdout when logsExporter is both", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      logs: true,
      logsExporter: "both",
    });
    const stdout = captureStdoutWrites();

    try {
      await service.start(ctx);
      emitDiagnosticEvent({
        type: "log.record",
        level: "ERROR",
        message: "both sinks",
        attributes: {
          subsystem: "diagnostic",
        },
      });
      await flushDiagnosticEvents();

      expect(logExporterCtor).toHaveBeenCalledTimes(1);
      const emitCall = mockCallArg(logEmit, 0) as {
        attributes?: Record<string, unknown>;
        body?: string;
        severityText?: string;
      };
      const record = parseSingleStdoutDiagnosticLogLine(stdout.writes);
      expect(emitCall.body).toBe("log");
      expect(record.body).toBe(emitCall.body);
      expect(record.severityText).toBe(emitCall.severityText);
      expect(record.attributes).toEqual(emitCall.attributes);
    } finally {
      stdout.spy.mockRestore();
      await service.stop?.(ctx);
    }
  });

  test("omits log message bodies from OTLP logs unless broad content capture is enabled", async () => {
    const emitCall = await emitAndCaptureLog({
      level: "INFO",
      message: "model replied OTEL-QA-OK",
    });

    expect(emitCall?.body).toBe("log");
  });

  test("keeps granular content capture from enabling OTLP log bodies", async () => {
    const emitCall = await emitAndCaptureLog(
      {
        level: "INFO",
        message: "model replied OTEL-QA-OK",
      },
      { captureContent: { enabled: true, inputMessages: true } },
    );

    expect(emitCall?.body).toBe("log");
  });

  test("redacts sensitive data from log messages before export when broad content capture is enabled", async () => {
    const emitCall = await emitAndCaptureLog(
      {
        level: "INFO",
        message: "Using API key sk-1234567890abcdef1234567890abcdef",
      },
      { captureContent: true },
    );

    expect(emitCall?.body).not.toContain("sk-1234567890abcdef1234567890abcdef");
    expect(emitCall?.body).toContain("sk-123");
    expect(emitCall?.body).toContain("…");
  });

  test("redacts sensitive data from log attributes before export", async () => {
    const emitCall = await emitAndCaptureLog({
      level: "DEBUG",
      message: "auth configured",
      attributes: {
        token: "ghp_abcdefghijklmnopqrstuvwxyz123456", // pragma: allowlist secret
      },
    });

    const tokenAttr = emitCall?.attributes?.["mo.token"];
    expect(tokenAttr).not.toBe("ghp_abcdefghijklmnopqrstuvwxyz123456"); // pragma: allowlist secret
    if (typeof tokenAttr === "string") {
      expect(tokenAttr).toContain("…");
    }
  });

  test("does not attach untrusted diagnostic trace context to exported logs", async () => {
    const emitCall = await emitAndCaptureLog({
      level: "INFO",
      message: "traceable log",
      attributes: {
        subsystem: "diagnostic",
      },
      trace: {
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        traceFlags: "01",
      },
    });

    expect(Object.hasOwn(emitCall?.attributes ?? {}, "mo.traceId")).toBe(false);
    expect(Object.hasOwn(emitCall?.attributes ?? {}, "mo.spanId")).toBe(false);
    expect(Object.hasOwn(emitCall?.attributes ?? {}, "mo.traceFlags")).toBe(false);
    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    expect(emitCall?.context).toBeUndefined();
  });

  test("attaches trace-only trusted context to exported logs", async () => {
    const emitCall = await emitAndCaptureLog(
      {
        level: "INFO",
        message: "traceable log",
        trace: {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          traceFlags: "01",
        },
      },
      { trustedTraceContext: true },
    );

    expect(emitCall?.body).toBe("log");
    expect(telemetryState.tracer.setSpanContext).toHaveBeenCalledTimes(1);
    const emitContext = emitCall?.context as { spanContext?: Record<string, unknown> } | undefined;
    const emitSpanContext = emitContext?.spanContext;
    expect(emitSpanContext?.traceId).toBe(TRACE_ID);
    expect(emitSpanContext?.spanId).toBe(SPAN_ID);
  });

  test("attaches trusted diagnostic trace context to exported logs", async () => {
    const emitCall = await emitAndCaptureLog(
      {
        level: "INFO",
        message: "traceable log",
        trace: {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          traceFlags: "01",
        },
      },
      { trusted: true },
    );

    expect(telemetryState.tracer.setSpanContext).toHaveBeenCalledTimes(1);
    const trustedSpanContext = firstSetSpanContext();
    expect(trustedSpanContext.traceId).toBe(TRACE_ID);
    expect(trustedSpanContext.spanId).toBe(SPAN_ID);
    expect(trustedSpanContext.traceFlags).toBe(1);
    expect(trustedSpanContext.isRemote).toBe(true);
    const emitContext = emitCall?.context as { spanContext?: Record<string, unknown> } | undefined;
    const emitSpanContext = emitContext?.spanContext;
    expect(emitSpanContext?.traceId).toBe(TRACE_ID);
    expect(emitSpanContext?.spanId).toBe(SPAN_ID);
  });

  test("bounds plugin-emitted log attributes and omits source paths", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { logs: true });
    await service.start(ctx);

    const attributes = Object.create(null) as Record<string, string>;
    attributes.good = "y".repeat(6000);
    attributes["bad key"] = "drop-me";
    attributes[PROTO_KEY] = "pollute";
    attributes["constructor"] = "pollute";
    attributes["prototype"] = "pollute";
    attributes["sk-1234567890abcdef1234567890abcdef"] = "secret-key"; // pragma: allowlist secret

    emitDiagnosticEvent({
      type: "log.record",
      level: "INFO",
      message: "x".repeat(6000),
      attributes,
      code: {
        filepath: "/Users/alice/mo/src/private.ts",
        line: 42,
        functionName: "handler",
        location: "/Users/alice/mo/src/private.ts:42",
      },
    } as Parameters<typeof emitDiagnosticEvent>[0]);
    await flushDiagnosticEvents();

    const emitCall = mockCallArg(logEmit, 0) as {
      attributes: Record<string, unknown>;
      body: string;
    };
    expect(emitCall.body.length).toBeLessThanOrEqual(4200);
    expect(String(emitCall.attributes["mo.good"])).toMatch(/^y+/);
    expect(emitCall.attributes["code.lineno"]).toBe(42);
    expect(emitCall.attributes["code.function"]).toBe("handler");
    expect(String(emitCall.attributes["mo.good"]).length).toBeLessThanOrEqual(4200);
    expect(Object.hasOwn(emitCall.attributes, `mo.${PROTO_KEY}`)).toBe(false);
    expect(Object.hasOwn(emitCall.attributes, "mo.constructor")).toBe(false);
    expect(Object.hasOwn(emitCall.attributes, "mo.prototype")).toBe(false);
    expect(
      Object.hasOwn(
        emitCall.attributes,
        "mo.sk-1234567890abcdef1234567890abcdef", // pragma: allowlist secret
      ),
    ).toBe(false);
    expect(Object.hasOwn(emitCall.attributes, "mo.bad key")).toBe(false);
    expect(Object.hasOwn(emitCall.attributes, "code.filepath")).toBe(false);
    expect(Object.hasOwn(emitCall.attributes, "mo.code.location")).toBe(false);
    await service.stop?.(ctx);
  });

  test("rate-limits repeated log export failure reports", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { logs: true });
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    logEmit.mockImplementation(() => {
      throw new Error("export failed");
    });
    try {
      await service.start(ctx);

      emitDiagnosticEvent({
        type: "log.record",
        level: "ERROR",
        message: "first failing log",
      });
      emitDiagnosticEvent({
        type: "log.record",
        level: "ERROR",
        message: "second failing log",
      });
      await flushDiagnosticEvents();

      expect(ctx.logger.error).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(62_000);
      emitDiagnosticEvent({
        type: "log.record",
        level: "ERROR",
        message: "third failing log",
      });
      await flushDiagnosticEvents();

      expect(ctx.logger.error).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
      await service.stop?.(ctx);
    }
  });

  test("does not parent diagnostic event spans from plugin-emittable trace context", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.usage",
      trace: {
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        traceFlags: "01",
      },
      provider: "openai",
      model: "gpt-5.4",
      usage: { total: 4 },
      durationMs: 12,
    });

    const modelUsageCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.usage",
    );
    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    expect(modelUsageCall?.[2]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("exports GenAI client token usage histogram for input and output only", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.usage",
      sessionKey: "session-key",
      channel: "webchat",
      agentId: "ops",
      provider: "openai",
      model: "gpt-5.4",
      usage: {
        input: 12,
        output: 7,
        cacheRead: 3,
        cacheWrite: 2,
        promptTokens: 17,
        total: 24,
      },
    });
    await flushDiagnosticEvents();

    const tokenUsageOptions = histogramCreateOptions("gen_ai.client.token.usage");
    expect(tokenUsageOptions?.unit).toBe("{token}");
    const tokenUsageBoundaries = tokenUsageOptions?.advice?.explicitBucketBoundaries;
    for (const boundary of [1, 4, 16, 1024, 67108864]) {
      expect(tokenUsageBoundaries).toContain(boundary);
    }
    const genAiTokenUsage = telemetryState.histograms.get("gen_ai.client.token.usage");
    const tokens = telemetryState.counters.get("mo.tokens");
    expect(tokens?.add).toHaveBeenCalledWith(12, {
      "mo.channel": "webchat",
      "mo.agent": "ops",
      "mo.provider": "openai",
      "mo.model": "gpt-5.4",
      "mo.token": "input",
    });
    expect(genAiTokenUsage?.record).toHaveBeenCalledTimes(2);
    expect(genAiTokenUsage?.record).toHaveBeenCalledWith(12, {
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "openai",
      "gen_ai.request.model": "gpt-5.4",
      "gen_ai.token.type": "input",
    });
    expect(genAiTokenUsage?.record).toHaveBeenCalledWith(7, {
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "openai",
      "gen_ai.request.model": "gpt-5.4",
      "gen_ai.token.type": "output",
    });
    expect(JSON.stringify(genAiTokenUsage?.record.mock.calls)).not.toContain("session-key");
    await service.stop?.(ctx);
  });

  test("bounds agent identifiers on model usage metric attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.usage",
      agentId: "Bearer sk-test-secret-value",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 2 },
    });
    await flushDiagnosticEvents();

    expect(telemetryState.counters.get("mo.tokens")?.add).toHaveBeenCalledWith(2, {
      "mo.channel": "unknown",
      "mo.agent": "unknown",
      "mo.provider": "openai",
      "mo.model": "gpt-5.4",
      "mo.token": "input",
    });
    expect(
      JSON.stringify(telemetryState.counters.get("mo.tokens")?.add.mock.calls),
    ).not.toContain("sk-test-secret-value");
    await service.stop?.(ctx);
  });

  test("drops session-shaped agent identifiers from model usage metric attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.usage",
      agentId: "Agent:qa:otel-trace-smoke",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 2 },
    });
    await flushDiagnosticEvents();

    expect(telemetryState.counters.get("mo.tokens")?.add).toHaveBeenCalledWith(2, {
      "mo.channel": "unknown",
      "mo.agent": "unknown",
      "mo.provider": "openai",
      "mo.model": "gpt-5.4",
      "mo.token": "input",
    });
    expect(
      JSON.stringify(telemetryState.counters.get("mo.tokens")?.add.mock.calls),
    ).not.toContain("Agent:qa:otel-trace-smoke");
    await service.stop?.(ctx);
  });

  test("drops session-shaped queue lane metric attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "queue.lane.enqueue",
      lane: "session:Agent:qa:otel-trace-smoke",
      queueSize: 2,
    });
    await flushDiagnosticEvents();

    expect(telemetryState.counters.get("mo.queue.lane.enqueue")?.add).toHaveBeenCalledWith(
      1,
      {
        "mo.lane": "session",
      },
    );
    expect(
      JSON.stringify(telemetryState.counters.get("mo.queue.lane.enqueue")?.add.mock.calls),
    ).not.toContain("Agent:qa:otel-trace-smoke");
    await service.stop?.(ctx);
  });

  test("keeps only the bounded prefix from scoped queue lane metric attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "queue.lane.enqueue",
      lane: "dreaming-narrative:session-main",
      queueSize: 2,
    });
    await flushDiagnosticEvents();

    expect(telemetryState.counters.get("mo.queue.lane.enqueue")?.add).toHaveBeenCalledWith(
      1,
      {
        "mo.lane": "dreaming-narrative",
      },
    );
    expect(
      JSON.stringify(telemetryState.counters.get("mo.queue.lane.enqueue")?.add.mock.calls),
    ).not.toContain("session-main");
    await service.stop?.(ctx);
  });

  test("keeps GenAI token usage metric model attribute present when model is unavailable", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.usage",
      provider: "openai",
      usage: { input: 2 },
    });
    await flushDiagnosticEvents();

    expect(telemetryState.histograms.get("gen_ai.client.token.usage")?.record).toHaveBeenCalledWith(
      2,
      {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "unknown",
        "gen_ai.token.type": "input",
      },
    );
    await service.stop?.(ctx);
  });

  test("exports GenAI usage attributes on model usage spans without diagnostic identifiers", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.usage",
      sessionKey: "session-key",
      sessionId: "session-id",
      provider: "anthropic",
      model: "anthropic/claude-sonnet-4.6",
      usage: {
        input: 100,
        output: 40,
        cacheRead: 30,
        cacheWrite: 20,
        promptTokens: 150,
        total: 190,
      },
      durationMs: 25,
    });
    await flushDiagnosticEvents();

    const modelUsageOptions = startedSpanOptions("mo.model.usage");
    expect(modelUsageOptions?.attributes?.["gen_ai.operation.name"]).toBe("chat");
    expect(modelUsageOptions?.attributes?.["gen_ai.system"]).toBe("anthropic");
    expect(modelUsageOptions?.attributes?.["gen_ai.request.model"]).toBe(
      "anthropic/claude-sonnet-4.6",
    );
    expect(modelUsageOptions?.attributes?.["gen_ai.usage.input_tokens"]).toBe(150);
    expect(modelUsageOptions?.attributes?.["gen_ai.usage.output_tokens"]).toBe(40);
    expect(modelUsageOptions?.attributes?.["gen_ai.usage.cache_read.input_tokens"]).toBe(30);
    expect(modelUsageOptions?.attributes?.["gen_ai.usage.cache_creation.input_tokens"]).toBe(20);
    expect(Object.hasOwn(modelUsageOptions?.attributes ?? {}, "mo.sessionKey")).toBe(false);
    expect(Object.hasOwn(modelUsageOptions?.attributes ?? {}, "mo.sessionId")).toBe(false);
    expect(Object.hasOwn(modelUsageOptions?.attributes ?? {}, "gen_ai.provider.name")).toBe(false);
    expect(Object.hasOwn(modelUsageOptions?.attributes ?? {}, "gen_ai.input.messages")).toBe(false);
    expect(Object.hasOwn(modelUsageOptions?.attributes ?? {}, "gen_ai.output.messages")).toBe(
      false,
    );
    expect(modelUsageOptions?.startTime).toBeTypeOf("number");
    expect(JSON.stringify(modelUsageOptions)).not.toContain("session-key");
    await service.stop?.(ctx);
  });

  test("exports GenAI client operation duration histogram without diagnostic identifiers", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      sessionKey: "session-key",
      provider: "anthropic",
      model: "anthropic/claude-sonnet-4.6",
      api: "openai-completions",
      durationMs: 250,
    });
    emitDiagnosticEvent({
      type: "model.call.error",
      runId: "run-1",
      callId: "call-2",
      sessionKey: "session-key",
      provider: "google",
      model: "gemini-2.5-flash",
      api: "google-generative-ai",
      durationMs: 1250,
      errorCategory: "TimeoutError",
    });
    await flushDiagnosticEvents();

    const operationDurationOptions = histogramCreateOptions("gen_ai.client.operation.duration");
    expect(operationDurationOptions?.unit).toBe("s");
    const operationDurationBoundaries = operationDurationOptions?.advice?.explicitBucketBoundaries;
    for (const boundary of [0.01, 0.32, 2.56, 81.92]) {
      expect(operationDurationBoundaries).toContain(boundary);
    }
    const genAiOperationDuration = telemetryState.histograms.get(
      "gen_ai.client.operation.duration",
    );
    expect(genAiOperationDuration?.record).toHaveBeenCalledTimes(2);
    expect(genAiOperationDuration?.record).toHaveBeenCalledWith(0.25, {
      "gen_ai.operation.name": "text_completion",
      "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "unknown",
    });
    expect(genAiOperationDuration?.record).toHaveBeenCalledWith(1.25, {
      "gen_ai.operation.name": "generate_content",
      "gen_ai.provider.name": "google",
      "gen_ai.request.model": "gemini-2.5-flash",
      "error.type": "TimeoutError",
    });
    expect(JSON.stringify(genAiOperationDuration?.record.mock.calls)).not.toContain("session-key");
    expect(JSON.stringify(genAiOperationDuration?.record.mock.calls)).not.toContain("run-1");
    await service.stop?.(ctx);
  });

  test("exports skill usage counter and span without raw identifiers", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "skill.used",
      agentId: "main",
      runId: "run-should-not-export",
      sessionKey: "session-should-not-export",
      skillName: "tiny-llm-brainstorm",
      skillSource: "workspace",
      activation: "read",
      toolName: "read",
      trace: {
        traceId: TRACE_ID,
        spanId: TOOL_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    const expectedAttrs = {
      "mo.agent": "main",
      "mo.skill.activation": "read",
      "mo.skill.name": "tiny-llm-brainstorm",
      "mo.skill.source": "workspace",
      "mo.toolName": "read",
    };
    expect(telemetryState.counters.get("mo.skill.used")?.add).toHaveBeenCalledWith(
      1,
      expectedAttrs,
    );
    const skillSpanCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.skill.used",
    );
    expect(skillSpanCall?.[1]).toMatchObject({ attributes: expectedAttrs });
    expect(JSON.stringify(skillSpanCall)).not.toContain("run-should-not-export");
    expect(JSON.stringify(skillSpanCall)).not.toContain("session-should-not-export");
    await service.stop?.(ctx);
  });

  test("exports run, model call, and tool execution lifecycle spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      sessionKey: "session-key",
      provider: "openai",
      model: "gpt-5.4",
      channel: "webchat",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      api: "completions",
      transport: "http",
      durationMs: 80,
      requestPayloadBytes: 1234,
      responseStreamBytes: 567,
      timeToFirstByteMs: 45,
      promptStats: {
        inputMessagesCount: 2,
        inputMessagesChars: 3456,
        systemPromptChars: 789,
        toolDefinitionsCount: 4,
        toolDefinitionsChars: 2345,
        totalChars: 6590,
      },
      usage: {
        input: 100,
        output: 20,
        cacheRead: 30,
        cacheWrite: 5,
        reasoningTokens: 8,
        promptTokens: 135,
        total: 155,
      },
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitDiagnosticEvent({
      type: "harness.run.completed",
      runId: "run-1",
      sessionKey: "session-key",
      sessionId: "session-1",
      provider: "codex",
      model: "gpt-5.4",
      channel: "qa",
      harnessId: "codex",
      pluginId: "codex-plugin",
      outcome: "completed",
      durationMs: 90,
      resultClassification: "reasoning-only",
      yieldDetected: true,
      itemLifecycle: { startedCount: 3, completedCount: 2, activeCount: 1 },
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitDiagnosticEvent({
      type: "tool.execution.error",
      runId: "run-1",
      toolName: "read",
      toolCallId: "tool-1",
      paramsSummary: { kind: "object" },
      durationMs: 20,
      errorCategory: "TypeError",
      errorCode: "429",
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    const spanNames = telemetryState.tracer.startSpan.mock.calls.map((call) => call[0]);
    expect(spanNames).toContain("mo.run");
    expect(spanNames).toContain("mo.model.call");
    expect(spanNames).toContain("mo.harness.run");
    expect(spanNames).toContain("mo.tool.execution");

    const runOptions = startedSpanOptions("mo.run");
    expect(runOptions?.attributes?.["mo.outcome"]).toBe("completed");
    expect(runOptions?.attributes?.["mo.provider"]).toBe("openai");
    expect(runOptions?.attributes?.["mo.model"]).toBe("gpt-5.4");
    expect(runOptions?.attributes?.["mo.channel"]).toBe("webchat");
    expect(Object.hasOwn(runOptions?.attributes ?? {}, "gen_ai.system")).toBe(false);
    expect(Object.hasOwn(runOptions?.attributes ?? {}, "gen_ai.request.model")).toBe(false);
    expect(Object.hasOwn(runOptions?.attributes ?? {}, "mo.runId")).toBe(false);
    expect(Object.hasOwn(runOptions?.attributes ?? {}, "mo.sessionKey")).toBe(false);
    expect(Object.hasOwn(runOptions?.attributes ?? {}, "mo.traceId")).toBe(false);
    expect(runOptions?.startTime).toBeTypeOf("number");

    const modelCall = startedSpanCall("mo.model.call");
    const modelOptions = modelCall?.[1];
    expect(modelOptions?.attributes?.["gen_ai.system"]).toBe("openai");
    expect(modelOptions?.attributes?.["gen_ai.request.model"]).toBe("gpt-5.4");
    expect(modelOptions?.attributes?.["gen_ai.operation.name"]).toBe("text_completion");
    expect(Object.hasOwn(modelOptions?.attributes ?? {}, "gen_ai.provider.name")).toBe(false);
    expect(Object.hasOwn(modelOptions?.attributes ?? {}, "mo.callId")).toBe(false);
    expect(Object.hasOwn(modelOptions?.attributes ?? {}, "mo.runId")).toBe(false);
    expect(Object.hasOwn(modelOptions?.attributes ?? {}, "mo.sessionKey")).toBe(false);
    expect(modelOptions?.startTime).toBeTypeOf("number");
    expect(Object.hasOwn(modelOptions ?? {}, "kind")).toBe(false);
    expect(modelCall?.[2]).toBeUndefined();

    const harnessCall = startedSpanCall("mo.harness.run");
    const harnessOptions = harnessCall?.[1];
    expect(harnessOptions?.attributes?.["mo.harness.id"]).toBe("codex");
    expect(harnessOptions?.attributes?.["mo.harness.plugin"]).toBe("codex-plugin");
    expect(harnessOptions?.attributes?.["mo.outcome"]).toBe("completed");
    expect(harnessOptions?.attributes?.["mo.provider"]).toBe("codex");
    expect(harnessOptions?.attributes?.["mo.model"]).toBe("gpt-5.4");
    expect(harnessOptions?.attributes?.["mo.channel"]).toBe("qa");
    expect(harnessOptions?.attributes?.["mo.harness.result_classification"]).toBe(
      "reasoning-only",
    );
    expect(harnessOptions?.attributes?.["mo.harness.yield_detected"]).toBe(true);
    expect(harnessOptions?.attributes?.["mo.harness.items.started"]).toBe(3);
    expect(harnessOptions?.attributes?.["mo.harness.items.completed"]).toBe(2);
    expect(harnessOptions?.attributes?.["mo.harness.items.active"]).toBe(1);
    expect(Object.hasOwn(harnessOptions?.attributes ?? {}, "mo.runId")).toBe(false);
    expect(Object.hasOwn(harnessOptions?.attributes ?? {}, "mo.sessionId")).toBe(false);
    expect(Object.hasOwn(harnessOptions?.attributes ?? {}, "mo.sessionKey")).toBe(false);
    expect(Object.hasOwn(harnessOptions?.attributes ?? {}, "mo.traceId")).toBe(false);
    expect(harnessOptions?.startTime).toBeTypeOf("number");
    expect(harnessCall?.[2]).toBeUndefined();

    const toolCall = startedSpanCall("mo.tool.execution");
    const toolOptions = toolCall?.[1];
    expect(toolOptions?.attributes?.["mo.toolName"]).toBe("read");
    expect(toolOptions?.attributes?.["mo.tool.source"]).toBe("core");
    expect(toolOptions?.attributes?.["mo.errorCategory"]).toBe("TypeError");
    expect(toolOptions?.attributes?.["mo.errorCode"]).toBe("429");
    expect(toolOptions?.attributes?.["mo.tool.params.kind"]).toBe("object");
    expect(toolOptions?.attributes?.["gen_ai.tool.name"]).toBe("read");
    expect(Object.hasOwn(toolOptions?.attributes ?? {}, "mo.toolCallId")).toBe(false);
    expect(Object.hasOwn(toolOptions?.attributes ?? {}, "mo.runId")).toBe(false);
    expect(Object.hasOwn(toolOptions?.attributes ?? {}, "mo.sessionKey")).toBe(false);
    expect(toolOptions?.startTime).toBeTypeOf("number");
    expect(toolCall?.[2]).toBeUndefined();

    const modelCallDuration = lastHistogramRecord("mo.model_call.duration_ms");
    expect(modelCallDuration?.[0]).toBe(80);
    expect(modelCallDuration?.[1]?.["mo.provider"]).toBe("openai");
    expect(modelCallDuration?.[1]?.["mo.model"]).toBe("gpt-5.4");
    const requestBytes = lastHistogramRecord("mo.model_call.request_bytes");
    expect(requestBytes?.[0]).toBe(1234);
    expect(requestBytes?.[1]?.["mo.provider"]).toBe("openai");
    expect(requestBytes?.[1]?.["mo.model"]).toBe("gpt-5.4");
    const responseBytes = lastHistogramRecord("mo.model_call.response_bytes");
    expect(responseBytes?.[0]).toBe(567);
    expect(responseBytes?.[1]?.["mo.provider"]).toBe("openai");
    expect(responseBytes?.[1]?.["mo.model"]).toBe("gpt-5.4");
    const timeToFirstByte = lastHistogramRecord("mo.model_call.time_to_first_byte_ms");
    expect(timeToFirstByte?.[0]).toBe(45);
    expect(timeToFirstByte?.[1]?.["mo.provider"]).toBe("openai");
    expect(timeToFirstByte?.[1]?.["mo.model"]).toBe("gpt-5.4");
    const modelSpanAttributes = firstSpanAttributes("mo.model.call");
    expect(modelSpanAttributes["mo.model_call.request_bytes"]).toBe(1234);
    expect(modelSpanAttributes["mo.model_call.response_bytes"]).toBe(567);
    expect(modelSpanAttributes["mo.model_call.time_to_first_byte_ms"]).toBe(45);
    expect(modelSpanAttributes["mo.model_call.prompt.input_messages_count"]).toBe(2);
    expect(modelSpanAttributes["mo.model_call.prompt.input_messages_chars"]).toBe(3456);
    expect(modelSpanAttributes["mo.model_call.prompt.system_prompt_chars"]).toBe(789);
    expect(modelSpanAttributes["mo.model_call.prompt.tool_definitions_count"]).toBe(4);
    expect(modelSpanAttributes["mo.model_call.prompt.tool_definitions_chars"]).toBe(2345);
    expect(modelSpanAttributes["mo.model_call.prompt.total_chars"]).toBe(6590);
    expect(modelSpanAttributes["mo.model_call.usage.input_tokens"]).toBe(100);
    expect(modelSpanAttributes["mo.model_call.usage.output_tokens"]).toBe(20);
    expect(modelSpanAttributes["mo.model_call.usage.cache_read_input_tokens"]).toBe(30);
    expect(modelSpanAttributes["mo.model_call.usage.cache_creation_input_tokens"]).toBe(5);
    expect(modelSpanAttributes["mo.model_call.usage.reasoning_output_tokens"]).toBe(8);
    expect(modelSpanAttributes["mo.model_call.usage.prompt_tokens"]).toBe(135);
    expect(modelSpanAttributes["mo.model_call.usage.total_tokens"]).toBe(155);
    expect(modelSpanAttributes["gen_ai.usage.input_tokens"]).toBe(135);
    expect(modelSpanAttributes["gen_ai.usage.output_tokens"]).toBe(20);
    const runDuration = lastHistogramRecord("mo.run.duration_ms");
    expect(runDuration?.[0]).toBe(100);
    expect(Object.hasOwn(runDuration?.[1] ?? {}, "mo.runId")).toBe(false);
    const harnessDuration = lastHistogramRecord("mo.harness.duration_ms");
    expect(harnessDuration?.[0]).toBe(90);
    expect(harnessDuration?.[1]?.["mo.harness.id"]).toBe("codex");
    expect(harnessDuration?.[1]?.["mo.harness.plugin"]).toBe("codex-plugin");
    expect(harnessDuration?.[1]?.["mo.outcome"]).toBe("completed");
    expect(Object.hasOwn(harnessDuration?.[1] ?? {}, "mo.runId")).toBe(false);
    expect(Object.hasOwn(harnessDuration?.[1] ?? {}, "mo.sessionKey")).toBe(false);
    const toolDuration = lastHistogramRecord("mo.tool.execution.duration_ms");
    expect(toolDuration?.[0]).toBe(20);
    expect(toolDuration?.[1]?.["mo.tool.source"]).toBe("core");
    expect(Object.hasOwn(toolDuration?.[1] ?? {}, "mo.errorCode")).toBe(false);
    expect(Object.hasOwn(toolDuration?.[1] ?? {}, "mo.runId")).toBe(false);

    const toolSpan = spanByName("mo.tool.execution");
    expect(toolSpan?.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "TypeError",
    });
    expect(firstSpanEndTime("mo.tool.execution")).toBeTypeOf("number");
    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    await service.stop?.(ctx);
  });

  test("exports model failover spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "model.failover",
      sessionId: "session-1",
      lane: "main",
      fromProvider: "anthropic",
      fromModel: "claude-opus-4-6",
      toProvider: "openai",
      toModel: "gpt-5.4",
      reason: "overloaded",
      suspended: true,
      cascadeDepth: 1,
    });
    await flushDiagnosticEvents();

    const failoverOptions = startedSpanOptions("mo.model.failover");
    expect(failoverOptions?.attributes?.["mo.provider"]).toBe("anthropic");
    expect(failoverOptions?.attributes?.["mo.model"]).toBe("claude-opus-4-6");
    expect(failoverOptions?.attributes?.["mo.failover.to_provider"]).toBe("openai");
    expect(failoverOptions?.attributes?.["mo.failover.to_model"]).toBe("gpt-5.4");
    expect(failoverOptions?.attributes?.["mo.failover.reason"]).toBe("overloaded");
    expect(failoverOptions?.attributes?.["mo.failover.suspended"]).toBe(true);
    expect(failoverOptions?.attributes?.["mo.failover.cascade_depth"]).toBe(1);
    expect(failoverOptions?.attributes?.["mo.lane"]).toBe("main");
    expect(Object.hasOwn(failoverOptions?.attributes ?? {}, "mo.sessionId")).toBe(false);
    expect(Object.hasOwn(failoverOptions?.attributes ?? {}, "mo.sessionKey")).toBe(false);
    expect(failoverOptions?.startTime).toBeTypeOf("number");
    expect(firstSpanEndTime("mo.model.failover")).toBeTypeOf("number");
    expect(firstCounterAddCall("mo.model.failover")).toStrictEqual([
      1,
      {
        "mo.failover.reason": "overloaded",
        "mo.failover.suspended": "true",
        "mo.lane": "main",
        "mo.model": "claude-opus-4-6",
        "mo.provider": "anthropic",
        "mo.failover.to_model": "gpt-5.4",
        "mo.failover.to_provider": "openai",
      },
    ]);
    await service.stop?.(ctx);
  });

  test("records blocked tool metrics even when traces are disabled", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true, traces: false });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "tool.execution.blocked",
      runId: "run-should-not-export",
      toolName: "browser",
      toolSource: "mcp",
      toolOwner: "browser-tools",
      deniedReason: "tools.deny",
      reason: "matched browser",
      paramsSummary: { kind: "object" },
    });
    await flushDiagnosticEvents();

    expect(firstCounterAddCall("mo.tool.execution.blocked")).toStrictEqual([
      1,
      {
        "mo.toolName": "browser",
        "mo.tool.source": "mcp",
        "gen_ai.tool.name": "browser",
        "mo.tool.owner": "browser-tools",
        "mo.tool.params.kind": "object",
        "mo.deniedReason": "tools.deny",
      },
    ]);
    expect(telemetryState.tracer.startSpan).not.toHaveBeenCalledWith(
      "mo.tool.execution",
      expect.anything(),
      expect.anything(),
    );

    await service.stop?.(ctx);
  });

  test("drops session-shaped queue lanes from model failover spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.failover",
      lane: "session:Agent:qa:otel-trace-smoke",
      reason: "overloaded",
      fromProvider: "anthropic",
      fromModel: "claude-opus-4-6",
    });
    await flushDiagnosticEvents();

    const failoverOptions = startedSpanOptions("mo.model.failover");
    expect(failoverOptions?.attributes?.["mo.lane"]).toBe("session");
    expect(JSON.stringify(failoverOptions?.attributes)).not.toContain("Agent:qa:otel-trace-smoke");
    await service.stop?.(ctx);
  });

  test("maps model call APIs to GenAI operation names and error type", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      api: "openai-completions",
      durationMs: 80,
    });
    emitDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-2",
      provider: "google",
      model: "gemini-2.5-flash",
      api: "google-generative-ai",
      durationMs: 90,
    });
    emitDiagnosticEvent({
      type: "model.call.error",
      runId: "run-1",
      callId: "call-3",
      provider: "openai",
      model: "gpt-5.4",
      api: "openai-responses",
      durationMs: 40,
      errorCategory: "TimeoutError",
    });
    await flushDiagnosticEvents();

    const modelCallAttrs = telemetryState.tracer.startSpan.mock.calls
      .filter((call) => call[0] === "mo.model.call")
      .map((call) => (call[1] as { attributes?: Record<string, unknown> }).attributes);
    expect(modelCallAttrs).toHaveLength(3);
    expect(modelCallAttrs[0]?.["gen_ai.system"]).toBe("openai");
    expect(modelCallAttrs[0]?.["gen_ai.request.model"]).toBe("gpt-5.4");
    expect(modelCallAttrs[0]?.["gen_ai.operation.name"]).toBe("text_completion");
    expect(modelCallAttrs[1]?.["gen_ai.system"]).toBe("google");
    expect(modelCallAttrs[1]?.["gen_ai.request.model"]).toBe("gemini-2.5-flash");
    expect(modelCallAttrs[1]?.["gen_ai.operation.name"]).toBe("generate_content");
    expect(modelCallAttrs[2]?.["gen_ai.system"]).toBe("openai");
    expect(modelCallAttrs[2]?.["gen_ai.request.model"]).toBe("gpt-5.4");
    expect(modelCallAttrs[2]?.["gen_ai.operation.name"]).toBe("chat");
    expect(modelCallAttrs[2]?.["error.type"]).toBe("TimeoutError");
    await service.stop?.(ctx);
  });

  test("uses latest GenAI inference span shape only when semconv opt-in is set", async () => {
    process.env.OTEL_SEMCONV_STABILITY_OPT_IN = "http,gen_ai_latest_experimental";

    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      api: "openai-completions",
      durationMs: 80,
    });
    emitDiagnosticEvent({
      type: "model.usage",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 3, output: 2 },
      durationMs: 10,
    });
    await flushDiagnosticEvents();

    expect(startedSpanOptions("mo.model.call")).toBeUndefined();
    const modelCallOptions = startedSpanOptions("text_completion gpt-5.4");
    expect(modelCallOptions?.attributes?.["gen_ai.provider.name"]).toBe("openai");
    expect(modelCallOptions?.attributes?.["gen_ai.request.model"]).toBe("gpt-5.4");
    expect(modelCallOptions?.attributes?.["gen_ai.operation.name"]).toBe("text_completion");
    expect(Object.hasOwn(modelCallOptions?.attributes ?? {}, "gen_ai.system")).toBe(false);
    expect(modelCallOptions?.startTime).toBeTypeOf("number");
    expect(modelCallOptions?.kind).toBe(2);
    const modelUsageOptions = startedSpanOptions("mo.model.usage");
    expect(modelUsageOptions?.attributes?.["gen_ai.provider.name"]).toBe("openai");
    expect(modelUsageOptions?.attributes?.["gen_ai.request.model"]).toBe("gpt-5.4");
    expect(modelUsageOptions?.attributes?.["gen_ai.operation.name"]).toBe("chat");
    expect(Object.hasOwn(modelUsageOptions?.attributes ?? {}, "gen_ai.system")).toBe(false);
    expect(modelUsageOptions?.startTime).toBeTypeOf("number");
    await service.stop?.(ctx);
  });

  test("records upstream request id hashes as model call span events only", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.call.error",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      api: "openai-responses",
      durationMs: 40,
      errorCategory: "ProviderError",
      failureKind: "terminated",
      upstreamRequestIdHash: "sha256:123456abcdef",
    });
    await flushDiagnosticEvents();

    const modelCallOptions = startedSpanOptions("mo.model.call");
    expect(modelCallOptions?.attributes?.["mo.failureKind"]).toBe("terminated");
    expect(
      Object.hasOwn(modelCallOptions?.attributes ?? {}, "mo.upstreamRequestIdHash"),
    ).toBe(false);
    expect(modelCallOptions?.startTime).toBeTypeOf("number");
    const span = telemetryState.spans.find((candidate) => candidate.name === "mo.model.call");
    expect(span?.addEvent).toHaveBeenCalledWith("mo.provider.request", {
      "mo.upstreamRequestIdHash": "sha256:123456abcdef",
    });
    const modelCallDuration = lastHistogramRecord("mo.model_call.duration_ms");
    expect(modelCallDuration?.[0]).toBe(40);
    expect(modelCallDuration?.[1]?.["mo.failureKind"]).toBe("terminated");
    expect(Object.hasOwn(modelCallDuration?.[1] ?? {}, "mo.upstreamRequestIdHash")).toBe(
      false,
    );
    await service.stop?.(ctx);
  });

  test("exports trusted context assembly spans without prompt content", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "context.assembled",
      runId: "run-1",
      sessionKey: "session-key",
      sessionId: "session-id",
      provider: "openai",
      model: "gpt-5.4",
      channel: "webchat",
      trigger: "message",
      messageCount: 12,
      historyTextChars: 1234,
      historyImageBlocks: 2,
      maxMessageTextChars: 456,
      systemPromptChars: 789,
      promptChars: 42,
      promptImages: 1,
      contextTokenBudget: 128_000,
      reserveTokens: 4096,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    const contextCall = startedSpanCall("mo.context.assembled");
    const contextOptions = contextCall?.[1];
    const runSpan = telemetryState.spans.find((span) => span.name === "mo.run");
    const runSpanId = runSpan?.spanContext.mock.results[0]?.value?.spanId;
    expect(contextOptions?.attributes?.["mo.provider"]).toBe("openai");
    expect(contextOptions?.attributes?.["mo.model"]).toBe("gpt-5.4");
    expect(contextOptions?.attributes?.["mo.channel"]).toBe("webchat");
    expect(contextOptions?.attributes?.["mo.trigger"]).toBe("message");
    expect(contextOptions?.attributes?.["mo.context.message_count"]).toBe(12);
    expect(contextOptions?.attributes?.["mo.context.history_text_chars"]).toBe(1234);
    expect(contextOptions?.attributes?.["mo.context.history_image_blocks"]).toBe(2);
    expect(contextOptions?.attributes?.["mo.context.max_message_text_chars"]).toBe(456);
    expect(contextOptions?.attributes?.["mo.context.system_prompt_chars"]).toBe(789);
    expect(contextOptions?.attributes?.["mo.context.prompt_chars"]).toBe(42);
    expect(contextOptions?.attributes?.["mo.context.prompt_images"]).toBe(1);
    expect(contextOptions?.attributes?.["mo.context.token_budget"]).toBe(128_000);
    expect(contextOptions?.attributes?.["mo.context.reserve_tokens"]).toBe(4096);
    expect(contextOptions?.attributes).toBeTypeOf("object");
    expect(contextOptions?.startTime).toBeTypeOf("number");
    expect(JSON.stringify(contextCall)).not.toContain("session-key");
    expect(JSON.stringify(contextCall)).not.toContain("prompt text");
    const linkedSpanContext = firstSetSpanContext();
    expect(linkedSpanContext.traceId).toBe(TRACE_ID);
    expect(linkedSpanContext.spanId).toBe(runSpanId);
    expect(
      (contextCall?.[2] as { spanContext?: { spanId?: string } } | undefined)?.spanContext?.spanId,
    ).toBe(runSpanId);
    await service.stop?.(ctx);
  });

  test("exports tool loop diagnostics without loop messages or session identifiers", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "tool.loop",
      sessionKey: "session-key",
      sessionId: "session-id",
      toolName: "process",
      level: "critical",
      action: "block",
      detector: "known_poll_no_progress",
      count: 20,
      message: "CRITICAL: repeated secret-bearing tool output",
      pairedToolName: "read",
    });
    await flushDiagnosticEvents();

    expect(telemetryState.counters.get("mo.tool.loop")?.add).toHaveBeenCalledWith(1, {
      "mo.toolName": "process",
      "mo.loop.level": "critical",
      "mo.loop.action": "block",
      "mo.loop.detector": "known_poll_no_progress",
      "mo.loop.count": 20,
      "mo.loop.paired_tool": "read",
    });
    const loopSpanCall = startedSpanCall("mo.tool.loop");
    const loopOptions = loopSpanCall?.[1];
    expect(loopOptions?.attributes?.["mo.toolName"]).toBe("process");
    expect(loopOptions?.attributes?.["mo.loop.level"]).toBe("critical");
    expect(loopOptions?.attributes?.["mo.loop.action"]).toBe("block");
    expect(loopOptions?.attributes?.["mo.loop.detector"]).toBe("known_poll_no_progress");
    expect(loopOptions?.attributes?.["mo.loop.count"]).toBe(20);
    expect(loopOptions?.attributes?.["mo.loop.paired_tool"]).toBe("read");
    const loopSpan = telemetryState.spans.find((span) => span.name === "mo.tool.loop");
    expect(loopSpan?.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "known_poll_no_progress:block",
    });
    expect(JSON.stringify(loopSpanCall)).not.toContain("session-key");
    expect(JSON.stringify(loopSpanCall)).not.toContain("secret-bearing");
    await service.stop?.(ctx);
  });

  test("exports diagnostic memory samples and pressure without session identifiers", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "diagnostic.memory.sample",
      uptimeMs: 1234,
      memory: {
        rssBytes: 100,
        heapUsedBytes: 40,
        heapTotalBytes: 80,
        externalBytes: 10,
        arrayBuffersBytes: 5,
      },
    });
    emitDiagnosticEvent({
      type: "diagnostic.memory.pressure",
      level: "critical",
      reason: "rss_growth",
      thresholdBytes: 512,
      rssGrowthBytes: 256,
      windowMs: 60_000,
      memory: {
        rssBytes: 200,
        heapUsedBytes: 50,
        heapTotalBytes: 90,
        externalBytes: 20,
        arrayBuffersBytes: 6,
      },
    });
    await flushDiagnosticEvents();

    expect(telemetryState.histograms.get("mo.memory.rss_bytes")?.record).toHaveBeenCalledWith(
      100,
      {},
    );
    expect(telemetryState.histograms.get("mo.memory.rss_bytes")?.record).toHaveBeenCalledWith(
      200,
      {
        "mo.memory.level": "critical",
        "mo.memory.reason": "rss_growth",
      },
    );
    expect(telemetryState.counters.get("mo.memory.pressure")?.add).toHaveBeenCalledWith(1, {
      "mo.memory.level": "critical",
      "mo.memory.reason": "rss_growth",
    });
    const pressureCall = startedSpanCall("mo.memory.pressure");
    const pressureOptions = pressureCall?.[1];
    expect(pressureOptions?.attributes?.["mo.memory.level"]).toBe("critical");
    expect(pressureOptions?.attributes?.["mo.memory.reason"]).toBe("rss_growth");
    expect(pressureOptions?.attributes?.["mo.memory.rss_bytes"]).toBe(200);
    expect(pressureOptions?.attributes?.["mo.memory.heap_used_bytes"]).toBe(50);
    expect(pressureOptions?.attributes?.["mo.memory.heap_total_bytes"]).toBe(90);
    expect(pressureOptions?.attributes?.["mo.memory.external_bytes"]).toBe(20);
    expect(pressureOptions?.attributes?.["mo.memory.array_buffers_bytes"]).toBe(6);
    expect(pressureOptions?.attributes?.["mo.memory.threshold_bytes"]).toBe(512);
    expect(pressureOptions?.attributes?.["mo.memory.rss_growth_bytes"]).toBe(256);
    expect(pressureOptions?.attributes?.["mo.memory.window_ms"]).toBe(60_000);
    const pressureSpan = telemetryState.spans.find(
      (span) => span.name === "mo.memory.pressure",
    );
    expect(pressureSpan?.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "rss_growth",
    });
    expect(JSON.stringify(pressureCall)).not.toContain("session");
    await service.stop?.(ctx);
  });

  test("records async diagnostic queue drop summaries", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "diagnostic.async_queue.dropped",
      droppedEvents: 4,
      droppedTrustedEvents: 1,
      droppedUntrustedEvents: 2,
      droppedPriorityEvents: 1,
      queueLength: 0,
      maxQueueLength: 10_000,
      drainBatchSize: 100,
    });
    await flushDiagnosticEvents();

    const counter = telemetryState.counters.get("mo.diagnostic.async_queue.dropped");
    expect(counter?.add).toHaveBeenCalledWith(4, {
      "mo.diagnostic.async_queue.drop_class": "total",
    });
    expect(counter?.add).toHaveBeenCalledWith(1, {
      "mo.diagnostic.async_queue.drop_class": "trusted",
    });
    expect(counter?.add).toHaveBeenCalledWith(2, {
      "mo.diagnostic.async_queue.drop_class": "untrusted",
    });
    expect(counter?.add).toHaveBeenCalledWith(1, {
      "mo.diagnostic.async_queue.drop_class": "priority",
    });

    await service.stop?.(ctx);
  });

  test("parents trusted diagnostic lifecycle spans from active started spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.call.started",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "tool.execution.started",
      runId: "run-1",
      toolName: "read",
      trace: {
        traceId: TRACE_ID,
        spanId: TOOL_SPAN_ID,
        parentSpanId: GRANDCHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "tool.execution.error",
      runId: "run-1",
      toolName: "read",
      durationMs: 20,
      errorCategory: "TypeError",
      trace: {
        traceId: TRACE_ID,
        spanId: TOOL_SPAN_ID,
        parentSpanId: GRANDCHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      durationMs: 80,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    const runSpan = telemetryState.spans.find((span) => span.name === "mo.run");
    const modelSpan = telemetryState.spans.find((span) => span.name === "mo.model.call");
    const toolSpan = telemetryState.spans.find((span) => span.name === "mo.tool.execution");
    const runSpanId = runSpan?.spanContext.mock.results[0]?.value?.spanId;
    const modelSpanId = modelSpan?.spanContext.mock.results[0]?.value?.spanId;

    expect(telemetryState.tracer.setSpanContext).toHaveBeenCalledTimes(2);
    const linkedSpanContexts = telemetryState.tracer.setSpanContext.mock.calls.map(
      (call) => call[1] as Record<string, unknown>,
    );
    expect(linkedSpanContexts[0]?.traceId).toBe(TRACE_ID);
    expect(linkedSpanContexts[0]?.spanId).toBe(runSpanId);
    expect(linkedSpanContexts[1]?.traceId).toBe(TRACE_ID);
    expect(linkedSpanContexts[1]?.spanId).toBe(modelSpanId);

    const parentBySpanName = Object.fromEntries(
      telemetryState.tracer.startSpan.mock.calls.map((call) => [
        call[0],
        (call[2] as { spanContext?: { spanId?: string } } | undefined)?.spanContext?.spanId,
      ]),
    );
    expect(parentBySpanName["mo.run"]).toBeUndefined();
    expect(parentBySpanName["mo.model.call"]).toBe(runSpanId);
    expect(parentBySpanName["mo.tool.execution"]).toBe(modelSpanId);
    expect(toolSpan?.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "TypeError",
    });
    await service.stop?.(ctx);
  });

  test("correlates one channel message waterfall across message, harness, usage, and model spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "message.dispatch.started",
      channel: "slack",
      source: "replyResolver",
      sessionKey: "agent:main:slack:channel:c1",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "harness.run.started",
      runId: "run-1",
      harnessId: "codex",
      pluginId: "codex",
      provider: "openai",
      model: "gpt-5.5",
      channel: "slack",
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.5",
      channel: "slack",
      trace: {
        traceId: TRACE_ID,
        spanId: TOOL_SPAN_ID,
        parentSpanId: GRANDCHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.call.started",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.5",
      api: "openai-codex-responses",
      transport: "stdio",
      trace: {
        traceId: TRACE_ID,
        spanId: MODEL_CALL_SPAN_ID,
        parentSpanId: TOOL_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.5",
      api: "openai-codex-responses",
      transport: "stdio",
      durationMs: 80,
      trace: {
        traceId: TRACE_ID,
        spanId: MODEL_CALL_SPAN_ID,
        parentSpanId: TOOL_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "harness.run.completed",
      runId: "run-1",
      harnessId: "codex",
      pluginId: "codex",
      provider: "openai",
      model: "gpt-5.5",
      channel: "slack",
      durationMs: 100,
      outcome: "completed",
      itemLifecycle: { startedCount: 1, completedCount: 1, activeCount: 0 },
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.usage",
      sessionKey: "agent:main:slack:channel:c1",
      channel: "slack",
      agentId: "main",
      provider: "openai",
      model: "gpt-5.5",
      usage: { input: 3, output: 2, total: 5 },
      durationMs: 10,
      trace: {
        traceId: TRACE_ID,
        spanId: MODEL_USAGE_SPAN_ID,
        parentSpanId: GRANDCHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "message.processed",
      channel: "slack",
      sessionKey: "agent:main:slack:channel:c1",
      durationMs: 120,
      outcome: "completed",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    const messageSpan = spanByName("mo.message.processed");
    const harnessSpan = spanByName("mo.harness.run");
    const runSpan = spanByName("mo.run");
    const usageSpan = spanByName("mo.model.usage");
    const modelCallSpan = spanByName("mo.model.call");
    const messageSpanContext = messageSpan.spanContext();
    const harnessSpanContext = harnessSpan.spanContext();
    const runSpanContext = runSpan.spanContext();
    const usageSpanContext = usageSpan.spanContext();
    const modelCallSpanContext = modelCallSpan.spanContext();

    const parentBySpanName = Object.fromEntries(
      telemetryState.tracer.startSpan.mock.calls.map((call) => [
        call[0],
        (call[2] as { spanContext?: { traceId?: string; spanId?: string } } | undefined)
          ?.spanContext,
      ]),
    );

    expect(messageSpanContext.traceId).toBe(TRACE_ID);
    expect(harnessSpanContext.traceId).toBe(TRACE_ID);
    expect(usageSpanContext.traceId).toBe(TRACE_ID);
    expect(modelCallSpanContext.traceId).toBe(TRACE_ID);
    expect(parentBySpanName["mo.message.processed"]?.spanId).toBe(SPAN_ID);
    expect(parentBySpanName["mo.harness.run"]?.spanId).toBe(messageSpanContext.spanId);
    expect(parentBySpanName["mo.run"]?.spanId).toBe(harnessSpanContext.spanId);
    expect(parentBySpanName["mo.model.usage"]?.spanId).toBe(harnessSpanContext.spanId);
    expect(parentBySpanName["mo.model.call"]?.spanId).toBe(runSpanContext.spanId);
    await service.stop?.(ctx);
  });

  test("uses production message lifecycle helpers as the message span anchor", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    const messageTrace = createDiagnosticTraceContext({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      parentSpanId: SPAN_ID,
      traceFlags: "01",
    });

    runWithDiagnosticTraceContext(messageTrace, () => {
      logMessageDispatchStarted({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        source: "replyResolver",
      });
      emitTrustedDiagnosticEvent({
        type: "harness.run.started",
        runId: "run-1",
        harnessId: "codex",
        pluginId: "codex",
        provider: "openai",
        model: "gpt-5.5",
        channel: "slack",
        trace: {
          traceId: TRACE_ID,
          spanId: GRANDCHILD_SPAN_ID,
          parentSpanId: CHILD_SPAN_ID,
          traceFlags: "01",
        },
      });
      emitTrustedDiagnosticEvent({
        type: "model.usage",
        sessionKey: "agent:main:slack:channel:c1",
        channel: "slack",
        agentId: "main",
        provider: "openai",
        model: "gpt-5.5",
        usage: { input: 3, output: 2, total: 5 },
        durationMs: 10,
        trace: {
          traceId: TRACE_ID,
          spanId: MODEL_USAGE_SPAN_ID,
          parentSpanId: GRANDCHILD_SPAN_ID,
          traceFlags: "01",
        },
      });
      logMessageProcessed({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        durationMs: 120,
        outcome: "completed",
      });
    });
    await flushDiagnosticEvents();

    const messageSpan = spanByName("mo.message.processed");
    const harnessSpan = spanByName("mo.harness.run");
    const messageSpanContext = messageSpan.spanContext();
    const harnessSpanContext = harnessSpan.spanContext();
    const parentBySpanName = Object.fromEntries(
      telemetryState.tracer.startSpan.mock.calls.map((call) => [
        call[0],
        (call[2] as { spanContext?: { traceId?: string; spanId?: string } } | undefined)
          ?.spanContext,
      ]),
    );

    expect(parentBySpanName["mo.message.processed"]?.spanId).toBe(SPAN_ID);
    expect(parentBySpanName["mo.harness.run"]?.spanId).toBe(messageSpanContext.spanId);
    expect(parentBySpanName["mo.model.usage"]?.spanId).toBe(harnessSpanContext.spanId);
    expect(messageSpanContext.traceId).toBe(TRACE_ID);
    expect(harnessSpanContext.traceId).toBe(TRACE_ID);
    await service.stop?.(ctx);
  });

  test("does not force a remote parent for root message lifecycle helpers", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    const messageTrace = createDiagnosticTraceContext({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      traceFlags: "01",
    });

    runWithDiagnosticTraceContext(messageTrace, () => {
      logMessageDispatchStarted({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        source: "replyResolver",
      });
      logMessageProcessed({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        durationMs: 120,
        outcome: "completed",
      });
    });
    await flushDiagnosticEvents();

    expect(spanByName("mo.message.processed").spanContext().traceId).toBe(TRACE_ID);
    expect(startedSpanParentContexts("mo.message.processed")[0]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("parents outbound delivery spans under the active message lifecycle span", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    const messageTrace = createDiagnosticTraceContext({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      parentSpanId: SPAN_ID,
      traceFlags: "01",
    });

    runWithDiagnosticTraceContext(messageTrace, () => {
      logMessageDispatchStarted({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        source: "replyResolver",
      });
      emitInternalDiagnosticEventForTest({
        type: "message.delivery.completed",
        channel: "slack",
        deliveryKind: "text",
        sessionKey: "agent:main:slack:channel:c1",
        durationMs: 15,
        resultCount: 1,
      });
      emitInternalDiagnosticEventForTest({
        type: "message.delivery.error",
        channel: "slack",
        deliveryKind: "media",
        sessionKey: "agent:main:slack:channel:c1",
        durationMs: 25,
        errorCategory: "network",
      });
      logMessageProcessed({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        durationMs: 120,
        outcome: "completed",
      });
    });
    await flushDiagnosticEvents();

    const messageSpanContext = spanByName("mo.message.processed").spanContext();
    const deliveryParentContexts = startedSpanParentContexts("mo.message.delivery");

    expect(deliveryParentContexts).toHaveLength(2);
    expect(deliveryParentContexts[0]?.traceId).toBe(TRACE_ID);
    expect(deliveryParentContexts[0]?.spanId).toBe(messageSpanContext.spanId);
    expect(deliveryParentContexts[1]?.traceId).toBe(TRACE_ID);
    expect(deliveryParentContexts[1]?.spanId).toBe(messageSpanContext.spanId);
    await service.stop?.(ctx);
  });

  test("parents multi-batch late delivery spans from the retained message context", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    const messageTrace = createDiagnosticTraceContext({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      parentSpanId: SPAN_ID,
      traceFlags: "01",
    });

    runWithDiagnosticTraceContext(messageTrace, () => {
      logMessageDispatchStarted({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        source: "replyResolver",
      });
      for (let index = 0; index < 125; index += 1) {
        emitInternalDiagnosticEventForTest({
          type: "message.delivery.completed",
          channel: "slack",
          deliveryKind: "text",
          sessionKey: `agent:main:slack:channel:c${index}`,
          durationMs: 15,
          resultCount: 1,
        });
      }
      logMessageProcessed({
        channel: "slack",
        sessionKey: "agent:main:slack:channel:c1",
        durationMs: 120,
        outcome: "completed",
      });
    });

    const messageSpan = spanByName("mo.message.processed");
    const messageSpanContext = messageSpan.spanContext();
    expect(messageSpan.end).toHaveBeenCalledTimes(1);
    await waitForDiagnosticEventsDrained();

    const deliveryParentContexts = startedSpanParentContexts("mo.message.delivery");
    expect(deliveryParentContexts).toHaveLength(125);
    expect(deliveryParentContexts.every((parent) => parent?.traceId === TRACE_ID)).toBe(true);
    expect(
      deliveryParentContexts.every((parent) => parent?.spanId === messageSpanContext.spanId),
    ).toBe(true);
    await service.stop?.(ctx);
  });

  test("correlates skipped duplicate message lifecycle helpers to the active inbound trace", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    const messageTrace = createDiagnosticTraceContext({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      parentSpanId: SPAN_ID,
      traceFlags: "01",
    });

    runWithDiagnosticTraceContext(messageTrace, () => {
      logMessageProcessed({
        channel: "slack",
        messageId: "msg-duplicate",
        chatId: "c1",
        sessionKey: "agent:main:slack:channel:c1",
        durationMs: 5,
        outcome: "skipped",
        reason: "duplicate",
      });
    });
    await flushDiagnosticEvents();

    const messageSpan = spanByName("mo.message.processed");
    const messageSpanContext = messageSpan.spanContext();
    const parentContext = startedSpanParentContexts("mo.message.processed")[0];

    expect(messageSpanContext.traceId).toBe(TRACE_ID);
    expect(parentContext?.traceId).toBe(TRACE_ID);
    expect(parentContext?.spanId).toBe(SPAN_ID);
    expect(firstSpanAttributes("mo.message.processed")["mo.reason"]).toBe("duplicate");
    expect(messageSpan.end).toHaveBeenCalledTimes(1);
    await service.stop?.(ctx);
  });

  test("does not force a remote parent for fallback root message processed spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "message.processed",
      channel: "slack",
      sessionKey: "agent:main:slack:channel:c1",
      durationMs: 25,
      outcome: "skipped",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    expect(spanByName("mo.message.processed").spanContext().traceId).toBe(TRACE_ID);
    expect(startedSpanParentContexts("mo.message.processed")[0]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("does not retain fallback message processed spans as active parents", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "message.processed",
      channel: "slack",
      sessionKey: "agent:main:slack:channel:c1",
      durationMs: 25,
      outcome: "skipped",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    expect(spanByName("mo.message.processed").end).toHaveBeenCalledTimes(1);

    telemetryState.tracer.setSpanContext.mockClear();
    emitTrustedDiagnosticEvent({
      type: "harness.run.started",
      runId: "run-1",
      harnessId: "codex",
      pluginId: "codex",
      provider: "openai",
      model: "gpt-5.5",
      channel: "slack",
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });

    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    expect(startedSpanCall("mo.harness.run")?.[2]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("retains trusted run context long enough for exact post-completion usage parenting", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    await Promise.resolve();
    emitTrustedDiagnosticEvent({
      type: "model.usage",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 3, output: 2, total: 5 },
      durationMs: 10,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    const runSpan = telemetryState.spans.find((span) => span.name === "mo.run");
    const runSpanId = runSpan?.spanContext.mock.results[0]?.value?.spanId;
    const modelUsageCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.usage",
    );

    const linkedSpanContext = firstSetSpanContext();
    expect(linkedSpanContext.traceId).toBe(TRACE_ID);
    expect(linkedSpanContext.spanId).toBe(runSpanId);
    expect(
      (modelUsageCall?.[2] as { spanContext?: { spanId?: string } } | undefined)?.spanContext
        ?.spanId,
    ).toBe(runSpanId);
    expect(firstSpanEndTime("mo.run")).toBeTypeOf("number");
    await service.stop?.(ctx);
  });

  test("does not parent sibling active runs through shared upstream aliases", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-2",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });

    const runContexts = startedSpanParentContextsByName("mo.run");

    expect(runContexts).toHaveLength(2);
    expect(runContexts[0]?.parentContext).toBeUndefined();
    expect(runContexts[1]?.parentContext).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("does not parent sibling runs through retained upstream aliases", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-2",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });

    const runContexts = startedSpanParentContextsByName("mo.run");

    expect(runContexts).toHaveLength(2);
    expect(runContexts[0]?.parentContext).toBeUndefined();
    expect(runContexts[1]?.parentContext).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("parents retained upstream alias events only when the owner matches", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      durationMs: 80,
      trace: {
        traceId: TRACE_ID,
        spanId: MODEL_CALL_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    const runSpanContext = spanByName("mo.run").spanContext();
    const modelParentContext = startedSpanParentContexts("mo.model.call")[0];

    expect(modelParentContext?.traceId).toBe(TRACE_ID);
    expect(modelParentContext?.spanId).toBe(runSpanContext.spanId);
    await service.stop?.(ctx);
  });

  test("parents multi-batch late model spans from the retained run context", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    for (let index = 0; index < 125; index += 1) {
      emitTrustedDiagnosticEvent({
        type: "model.call.completed",
        runId: "run-1",
        callId: `call-${index}`,
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
        trace: {
          traceId: TRACE_ID,
          spanId: numberedSpanId(index),
          parentSpanId: CHILD_SPAN_ID,
          traceFlags: "01",
        },
      });
    }
    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });

    const runSpan = spanByName("mo.run");
    const runSpanContext = runSpan.spanContext();
    expect(runSpan.end).toHaveBeenCalledTimes(1);
    await waitForDiagnosticEventsDrained();

    const modelParentContexts = startedSpanParentContexts("mo.model.call");
    expect(modelParentContexts).toHaveLength(125);
    expect(modelParentContexts.every((parent) => parent?.traceId === TRACE_ID)).toBe(true);
    expect(modelParentContexts.every((parent) => parent?.spanId === runSpanContext.spanId)).toBe(
      true,
    );
    await service.stop?.(ctx);
  });

  test("removes retained run contexts after queued diagnostics drain", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    for (let index = 0; index < 125; index += 1) {
      emitTrustedDiagnosticEvent({
        type: "model.call.completed",
        runId: "run-1",
        callId: `call-${index}`,
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
        trace: {
          traceId: TRACE_ID,
          spanId: numberedSpanId(index),
          parentSpanId: CHILD_SPAN_ID,
          traceFlags: "01",
        },
      });
    }
    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });

    await waitForDiagnosticEventsDrained();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    await waitForDiagnosticEventsDrained();
    await Promise.resolve();
    telemetryState.tracer.setSpanContext.mockClear();
    telemetryState.tracer.startSpan.mockClear();

    emitTrustedDiagnosticEvent({
      type: "model.usage",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 3, output: 2, total: 5 },
      durationMs: 10,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });

    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    expect(startedSpanCall("mo.model.usage")?.[2]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("clears retained run contexts when the service stops", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });

    await service.stop?.(ctx);
    await service.start(ctx);
    telemetryState.tracer.setSpanContext.mockClear();
    telemetryState.tracer.startSpan.mockClear();

    emitTrustedDiagnosticEvent({
      type: "model.usage",
      provider: "openai",
      model: "gpt-5.4",
      usage: { input: 3, output: 2, total: 5 },
      durationMs: 10,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });

    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    expect(startedSpanCall("mo.model.usage")?.[2]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("does not force remote parents for completed-only trusted lifecycle spans", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      durationMs: 80,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    const parentBySpanName = Object.fromEntries(
      telemetryState.tracer.startSpan.mock.calls.map((call) => [call[0], call[2]]),
    );
    expect(parentBySpanName["mo.run"]).toBeUndefined();
    expect(parentBySpanName["mo.model.call"]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("does not self-parent trusted diagnostic lifecycle spans without parent ids", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitTrustedDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      durationMs: 80,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    const parentBySpanName = Object.fromEntries(
      telemetryState.tracer.startSpan.mock.calls.map((call) => [call[0], call[2]]),
    );
    expect(parentBySpanName["mo.run"]).toBeUndefined();
    expect(parentBySpanName["mo.model.call"]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("does not parent untrusted diagnostic lifecycle spans from injected trace ids", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
      trace: {
        traceId: TRACE_ID,
        spanId: CHILD_SPAN_ID,
        parentSpanId: SPAN_ID,
        traceFlags: "01",
      },
    });
    emitDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      durationMs: 80,
      trace: {
        traceId: TRACE_ID,
        spanId: GRANDCHILD_SPAN_ID,
        parentSpanId: CHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    emitDiagnosticEvent({
      type: "tool.execution.completed",
      runId: "run-1",
      toolName: "read",
      durationMs: 20,
      trace: {
        traceId: TRACE_ID,
        spanId: TOOL_SPAN_ID,
        parentSpanId: GRANDCHILD_SPAN_ID,
        traceFlags: "01",
      },
    });
    await flushDiagnosticEvents();

    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    const parentBySpanName = Object.fromEntries(
      telemetryState.tracer.startSpan.mock.calls.map((call) => [call[0], call[2]]),
    );
    expect(parentBySpanName["mo.run"]).toBeUndefined();
    expect(parentBySpanName["mo.model.call"]).toBeUndefined();
    expect(parentBySpanName["mo.tool.execution"]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("does not create live started spans for untrusted lifecycle diagnostics", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "run.started",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
    });
    emitDiagnosticEvent({
      type: "run.completed",
      runId: "run-1",
      provider: "openai",
      model: "gpt-5.4",
      outcome: "completed",
      durationMs: 100,
    });
    emitDiagnosticEvent({
      type: "model.call.started",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
    });
    emitDiagnosticEvent({
      type: "model.call.completed",
      runId: "run-1",
      callId: "call-1",
      provider: "openai",
      model: "gpt-5.4",
      durationMs: 80,
    });
    emitDiagnosticEvent({
      type: "tool.execution.started",
      runId: "run-1",
      toolName: "read",
    });
    emitDiagnosticEvent({
      type: "tool.execution.error",
      runId: "run-1",
      toolName: "read",
      durationMs: 20,
      errorCategory: "TypeError",
    });
    emitDiagnosticEvent({
      type: "harness.run.started",
      runId: "run-1",
      provider: "codex",
      model: "gpt-5.4",
      harnessId: "codex",
      pluginId: "codex-plugin",
    });
    emitDiagnosticEvent({
      type: "harness.run.completed",
      runId: "run-1",
      provider: "codex",
      model: "gpt-5.4",
      harnessId: "codex",
      pluginId: "codex-plugin",
      outcome: "completed",
      durationMs: 90,
    });
    await flushDiagnosticEvents();

    expect(
      telemetryState.tracer.startSpan.mock.calls.filter((call) => call[0] === "mo.run"),
    ).toHaveLength(1);
    expect(
      telemetryState.tracer.startSpan.mock.calls.filter(
        (call) => call[0] === "mo.model.call",
      ),
    ).toHaveLength(1);
    expect(
      telemetryState.tracer.startSpan.mock.calls.filter(
        (call) => call[0] === "mo.tool.execution",
      ),
    ).toHaveLength(1);
    expect(
      telemetryState.tracer.startSpan.mock.calls.filter(
        (call) => call[0] === "mo.harness.run",
      ),
    ).toHaveLength(1);
    await service.stop?.(ctx);
  });

  test("exports exec process spans without command text", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "exec.process.completed",
      target: "host",
      mode: "child",
      outcome: "failed",
      durationMs: 30,
      commandLength: 42,
      exitCode: 1,
      timedOut: false,
      failureKind: "runtime-error",
    });
    await flushDiagnosticEvents();

    const execDuration = lastHistogramRecord("mo.exec.duration_ms");
    expect(execDuration?.[0]).toBe(30);
    expect(execDuration?.[1]?.["mo.exec.target"]).toBe("host");
    expect(execDuration?.[1]?.["mo.exec.mode"]).toBe("child");
    expect(execDuration?.[1]?.["mo.outcome"]).toBe("failed");
    expect(execDuration?.[1]?.["mo.failureKind"]).toBe("runtime-error");

    const execCall = startedSpanCall("mo.exec");
    const execOptions = execCall?.[1];
    expect(execOptions?.attributes?.["mo.exec.target"]).toBe("host");
    expect(execOptions?.attributes?.["mo.exec.mode"]).toBe("child");
    expect(execOptions?.attributes?.["mo.outcome"]).toBe("failed");
    expect(execOptions?.attributes?.["mo.exec.command_length"]).toBe(42);
    expect(execOptions?.attributes?.["mo.exec.exit_code"]).toBe(1);
    expect(execOptions?.attributes?.["mo.exec.timed_out"]).toBe(false);
    expect(execOptions?.attributes?.["mo.failureKind"]).toBe("runtime-error");
    expect(Object.hasOwn(execOptions?.attributes ?? {}, "mo.exec.command")).toBe(false);
    expect(Object.hasOwn(execOptions?.attributes ?? {}, "mo.exec.workdir")).toBe(false);
    expect(Object.hasOwn(execOptions?.attributes ?? {}, "mo.sessionKey")).toBe(false);
    expect(execOptions?.startTime).toBeTypeOf("number");

    const execSpan = spanByName("mo.exec");
    expect(execSpan?.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "runtime-error",
    });
    expect(firstSpanEndTime("mo.exec")).toBeTypeOf("number");
    await service.stop?.(ctx);
  });

  test("exports message delivery spans and metrics with low-cardinality attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "message.delivery.started",
      channel: "matrix",
      deliveryKind: "text",
      sessionKey: "session-secret",
    });
    emitDiagnosticEvent({
      type: "message.delivery.completed",
      channel: "matrix",
      deliveryKind: "text",
      durationMs: 25,
      resultCount: 1,
      sessionKey: "session-secret",
    });
    emitDiagnosticEvent({
      type: "message.delivery.error",
      channel: "discord",
      deliveryKind: "media",
      durationMs: 40,
      errorCategory: "TypeError",
      sessionKey: "session-secret",
    });
    await flushDiagnosticEvents();

    expect(
      telemetryState.counters.get("mo.message.delivery.started")?.add,
    ).toHaveBeenCalledWith(1, {
      "mo.channel": "matrix",
      "mo.delivery.kind": "text",
    });
    const deliveryDurationRecords = telemetryState.histograms.get(
      "mo.message.delivery.duration_ms",
    )?.record.mock.calls as Array<[unknown, Record<string, unknown>]>;
    expect(deliveryDurationRecords[0]?.[0]).toBe(25);
    expect(deliveryDurationRecords[0]?.[1]["mo.channel"]).toBe("matrix");
    expect(deliveryDurationRecords[0]?.[1]["mo.delivery.kind"]).toBe("text");
    expect(deliveryDurationRecords[0]?.[1]["mo.outcome"]).toBe("completed");
    expect(deliveryDurationRecords[1]?.[0]).toBe(40);
    expect(deliveryDurationRecords[1]?.[1]["mo.channel"]).toBe("discord");
    expect(deliveryDurationRecords[1]?.[1]["mo.delivery.kind"]).toBe("media");
    expect(deliveryDurationRecords[1]?.[1]["mo.outcome"]).toBe("error");
    expect(deliveryDurationRecords[1]?.[1]["mo.errorCategory"]).toBe("TypeError");

    const deliverySpanCalls = telemetryState.tracer.startSpan.mock.calls.filter(
      (call) => call[0] === "mo.message.delivery",
    );
    expect(deliverySpanCalls).toHaveLength(2);
    const firstDeliveryOptions = deliverySpanCalls[0]?.[1] as
      | { attributes?: Record<string, unknown>; startTime?: unknown }
      | undefined;
    expect(firstDeliveryOptions?.attributes?.["mo.channel"]).toBe("matrix");
    expect(firstDeliveryOptions?.attributes?.["mo.delivery.kind"]).toBe("text");
    expect(firstDeliveryOptions?.attributes?.["mo.outcome"]).toBe("completed");
    expect(firstDeliveryOptions?.attributes?.["mo.delivery.result_count"]).toBe(1);
    expect(firstDeliveryOptions?.startTime).toBeTypeOf("number");
    const secondDeliveryOptions = deliverySpanCalls[1]?.[1] as
      | { attributes?: Record<string, unknown>; startTime?: unknown }
      | undefined;
    expect(secondDeliveryOptions?.attributes?.["mo.channel"]).toBe("discord");
    expect(secondDeliveryOptions?.attributes?.["mo.delivery.kind"]).toBe("media");
    expect(secondDeliveryOptions?.attributes?.["mo.outcome"]).toBe("error");
    expect(secondDeliveryOptions?.attributes?.["mo.errorCategory"]).toBe("TypeError");
    expect(secondDeliveryOptions?.startTime).toBeTypeOf("number");
    for (const call of deliverySpanCalls) {
      const options = call[1] as { attributes?: Record<string, unknown>; startTime?: unknown };
      expect(Object.hasOwn(options.attributes ?? {}, "mo.chatId")).toBe(false);
      expect(Object.hasOwn(options.attributes ?? {}, "mo.sessionKey")).toBe(false);
      expect(Object.hasOwn(options.attributes ?? {}, "mo.messageId")).toBe(false);
      expect(Object.hasOwn(options.attributes ?? {}, "mo.conversationId")).toBe(false);
      expect(Object.hasOwn(options.attributes ?? {}, "mo.content")).toBe(false);
      expect(Object.hasOwn(options.attributes ?? {}, "mo.to")).toBe(false);
      expect(options.startTime).toBeTypeOf("number");
    }
    const errorSpan = telemetryState.spans.find(
      (span) => span.name === "mo.message.delivery" && span.setStatus.mock.calls.length > 0,
    );
    expect(errorSpan?.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "TypeError",
    });
    await service.stop?.(ctx);
  });

  test("bounds unsafe message delivery attributes before export", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "message.delivery.completed",
      channel: "discord/custom",
      deliveryKind: "progress draft" as never,
      durationMs: 20,
      resultCount: 1,
      sessionKey: "session-secret",
    });
    await flushDiagnosticEvents();

    const deliveryDuration = lastHistogramRecord("mo.message.delivery.duration_ms");
    expect(deliveryDuration?.[0]).toBe(20);
    expect(deliveryDuration?.[1]?.["mo.channel"]).toBe("unknown");
    expect(deliveryDuration?.[1]?.["mo.delivery.kind"]).toBe("other");
    expect(deliveryDuration?.[1]?.["mo.outcome"]).toBe("completed");
    const deliverySpanCall = startedSpanCall("mo.message.delivery");
    const deliveryOptions = deliverySpanCall?.[1];
    expect(deliveryOptions?.attributes?.["mo.channel"]).toBe("unknown");
    expect(deliveryOptions?.attributes?.["mo.delivery.kind"]).toBe("other");
    expect(deliveryOptions?.attributes?.["mo.outcome"]).toBe("completed");
    expect(deliveryOptions?.attributes?.["mo.delivery.result_count"]).toBe(1);
    expect(deliveryOptions?.startTime).toBeTypeOf("number");
    await service.stop?.(ctx);
  });

  test("exports session recovery and talk metrics with bounded attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitTrustedDiagnosticEvent({
      type: "session.recovery.requested",
      sessionId: "session-should-not-export",
      sessionKey: "key-should-not-export",
      state: "processing",
      ageMs: 12_000,
      reason: "startup-sweep",
      activeWorkKind: "tool_call",
      allowActiveAbort: true,
    });
    emitTrustedDiagnosticEvent({
      type: "session.recovery.completed",
      sessionId: "session-should-not-export",
      sessionKey: "key-should-not-export",
      state: "processing",
      ageMs: 13_000,
      reason: "startup-sweep",
      activeWorkKind: "tool_call",
      status: "released",
      action: "abort-active-run",
    });
    emitTrustedDiagnosticEvent({
      type: "talk.event",
      sessionId: "talk-session-should-not-export",
      turnId: "turn-should-not-export",
      talkEventType: "input.audio.delta",
      mode: "realtime",
      transport: "gateway-relay",
      brain: "agent-consult",
      provider: "openai",
      byteLength: 320,
    });
    emitTrustedDiagnosticEvent({
      type: "talk.event",
      sessionId: "talk-session-should-not-export",
      talkEventType: "latency.metrics",
      mode: "realtime",
      transport: "gateway-relay",
      brain: "agent-consult",
      provider: "openai",
      durationMs: 45,
    });
    await flushDiagnosticEvents();

    const recoveryRequestedCall = firstCounterAddCall("mo.session.recovery.requested");
    expect(recoveryRequestedCall[0]).toBe(1);
    expect(recoveryRequestedCall[1]?.["mo.state"]).toBe("processing");
    expect(recoveryRequestedCall[1]?.["mo.action"]).toBe("abort");
    expect(recoveryRequestedCall[1]?.["mo.active_work_kind"]).toBe("tool_call");
    const recoveryCompletedCall = firstCounterAddCall("mo.session.recovery.completed");
    expect(recoveryCompletedCall[0]).toBe(1);
    expect(recoveryCompletedCall[1]?.["mo.state"]).toBe("processing");
    expect(recoveryCompletedCall[1]?.["mo.status"]).toBe("released");
    expect(recoveryCompletedCall[1]?.["mo.action"]).toBe("abort-active-run");
    const recoveryAgeRecord = lastHistogramRecord("mo.session.recovery.age_ms");
    expect(recoveryAgeRecord?.[0]).toBe(13_000);
    expect(recoveryAgeRecord?.[1]?.["mo.status"]).toBe("released");
    expect(telemetryState.counters.get("mo.talk.event")?.add).toHaveBeenCalledWith(1, {
      "mo.talk.brain": "agent-consult",
      "mo.talk.event_type": "input.audio.delta",
      "mo.talk.mode": "realtime",
      "mo.talk.provider": "openai",
      "mo.talk.transport": "gateway-relay",
    });
    expect(telemetryState.histograms.get("mo.talk.audio.bytes")?.record).toHaveBeenCalledWith(
      320,
      {
        "mo.talk.brain": "agent-consult",
        "mo.talk.event_type": "input.audio.delta",
        "mo.talk.mode": "realtime",
        "mo.talk.provider": "openai",
        "mo.talk.transport": "gateway-relay",
      },
    );
    expect(
      telemetryState.histograms.get("mo.talk.event.duration_ms")?.record,
    ).toHaveBeenCalledWith(45, {
      "mo.talk.brain": "agent-consult",
      "mo.talk.event_type": "latency.metrics",
      "mo.talk.mode": "realtime",
      "mo.talk.provider": "openai",
      "mo.talk.transport": "gateway-relay",
    });

    const talkCounterCalls = JSON.stringify(
      telemetryState.counters.get("mo.talk.event")?.add.mock.calls,
    );
    expect(talkCounterCalls).not.toContain("talk-session-should-not-export");
    expect(talkCounterCalls).not.toContain("turn-should-not-export");
    await service.stop?.(ctx);
  });

  test("does not export model or tool content unless capture is explicitly enabled", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      {
        inputMessages: ["private user prompt"],
        outputMessages: ["private model reply"],
        systemPrompt: "private system prompt",
      },
    );
    emitTrustedToolExecutionCompletedWithContent(
      {
        runId: "run-1",
        toolName: "read",
        toolCallId: "tool-1",
        durationMs: 20,
      },
      {
        toolInput: "private tool input",
        toolOutput: "private tool output",
      },
    );
    await flushDiagnosticEvents();

    const modelOptions = startedSpanOptions("mo.model.call");
    expect(Object.hasOwn(modelOptions?.attributes ?? {}, "mo.content.input_messages")).toBe(
      false,
    );
    expect(Object.hasOwn(modelOptions?.attributes ?? {}, "mo.content.output_messages")).toBe(
      false,
    );
    expect(Object.hasOwn(modelOptions?.attributes ?? {}, "mo.content.system_prompt")).toBe(
      false,
    );
    expect(modelOptions?.startTime).toBeTypeOf("number");
    const toolOptions = startedSpanOptions("mo.tool.execution");
    expect(Object.hasOwn(toolOptions?.attributes ?? {}, "mo.content.tool_input")).toBe(false);
    expect(Object.hasOwn(toolOptions?.attributes ?? {}, "mo.content.tool_output")).toBe(
      false,
    );
    expect(toolOptions?.startTime).toBeTypeOf("number");
    await service.stop?.(ctx);
  });

  test("exports bounded redacted content when capture fields are opted in", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      metrics: true,
      captureContent: {
        enabled: true,
        inputMessages: true,
        outputMessages: true,
        toolInputs: true,
        toolOutputs: true,
        systemPrompt: true,
      },
    });
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      {
        inputMessages: ["use key sk-1234567890abcdef1234567890abcdef"], // pragma: allowlist secret
        outputMessages: ["model reply"],
        systemPrompt: "system prompt",
      },
    );
    emitTrustedToolExecutionCompletedWithContent(
      {
        runId: "run-1",
        toolName: "read",
        toolCallId: "tool-1",
        durationMs: 20,
      },
      {
        toolInput: "tool input",
        toolOutput: `${"x".repeat(4077)} Bearer ${"a".repeat(80)}`, // pragma: allowlist secret
      },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const toolCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.tool.execution",
    );
    const modelAttrs = (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;
    const toolAttrs = (toolCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;

    expect(modelAttrs?.["mo.content.output_messages"]).toBe("model reply");
    expect(modelAttrs?.["mo.content.system_prompt"]).toBe("system prompt");
    expect(String(modelAttrs?.["mo.content.input_messages"])).not.toContain(
      "sk-1234567890abcdef1234567890abcdef", // pragma: allowlist secret
    );
    expect(toolAttrs?.["mo.content.tool_input"]).toBe("tool input");
    expect(String(toolAttrs?.["mo.content.tool_output"]).length).toBeLessThanOrEqual(
      MAX_TEST_OTEL_CONTENT_ATTRIBUTE_CHARS + OTEL_TRUNCATED_SUFFIX_MAX_CHARS,
    );
    expect(String(toolAttrs?.["mo.content.tool_output"])).not.toContain("a".repeat(11));
    await service.stop?.(ctx);
  });

  test("omits absent model content fields when capture fields are opted in", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      captureContent: {
        enabled: true,
        inputMessages: true,
        outputMessages: true,
        systemPrompt: true,
        toolDefinitions: true,
      },
    });
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      { inputMessages: ["user prompt"] },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const attrs =
      (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)?.attributes ?? {};
    expect(attrs["mo.content.input_messages"]).toBe("user prompt");
    expect(Object.hasOwn(attrs, "mo.content.output_messages")).toBe(false);
    expect(Object.hasOwn(attrs, "mo.content.system_prompt")).toBe(false);
    expect(Object.hasOwn(attrs, "mo.content.tool_definitions")).toBe(false);
    expect(Object.hasOwn(attrs, "gen_ai.output.messages")).toBe(false);
    expect(Object.hasOwn(attrs, "gen_ai.system_instructions")).toBe(false);
    expect(Object.hasOwn(attrs, "gen_ai.tool.definitions")).toBe(false);
    await service.stop?.(ctx);
  });

  test("exports Phoenix-readable GenAI prompt, output, and tool definition attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      captureContent: {
        enabled: true,
        inputMessages: true,
        outputMessages: true,
        systemPrompt: true,
        toolDefinitions: true,
      },
    });
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      {
        inputMessages: [
          { role: "user", content: "what changed?", timestamp: 1 },
          {
            role: "assistant",
            content: [
              { type: "toolCall", id: "call-1", name: "lookup", arguments: { q: "trace" } },
            ],
          },
          { role: "toolResult", toolCallId: "call-1", content: { rows: 1 } },
        ],
        outputMessages: [
          {
            role: "assistant",
            content: [{ type: "text", text: "the trace changed" }],
            stopReason: "stop",
          },
        ],
        systemPrompt: "be exact",
        toolDefinitions: [
          { name: "lookup", description: "Lookup data", parameters: { type: "object" } },
        ],
      },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const attrs = (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;
    expect(attrs?.["gen_ai.system_instructions"]).toBe(
      JSON.stringify([{ type: "text", content: "be exact" }]),
    );
    expect(JSON.parse(stringAttribute(attrs, "gen_ai.input.messages"))).toEqual([
      { role: "user", parts: [{ type: "text", content: "what changed?" }] },
      {
        role: "assistant",
        parts: [
          {
            type: "tool_call",
            id: "call-1",
            name: "lookup",
            arguments: { q: "trace" },
          },
        ],
      },
      {
        role: "tool",
        parts: [{ type: "tool_call_response", id: "call-1", result: { rows: 1 } }],
      },
    ]);
    expect(JSON.parse(stringAttribute(attrs, "gen_ai.output.messages"))).toEqual([
      {
        role: "assistant",
        parts: [{ type: "text", content: "the trace changed" }],
        finish_reason: "stop",
      },
    ]);
    expect(JSON.parse(stringAttribute(attrs, "gen_ai.tool.definitions"))).toEqual([
      {
        type: "function",
        name: "lookup",
        description: "Lookup data",
        parameters: { type: "object" },
      },
    ]);
    expect(attrs?.["input.mime_type"]).toBe("application/json");
    expect(attrs?.["output.mime_type"]).toBe("application/json");
    await service.stop?.(ctx);
  });

  test("normalizes snake_case tool_call parts the same as camelCase toolCall parts", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      captureContent: {
        enabled: true,
        inputMessages: true,
        outputMessages: false,
      },
    });
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      {
        inputMessages: [
          {
            role: "assistant",
            content: [
              {
                type: "tool_call",
                id: "tc-1",
                name: "search",
                arguments: { q: "x" },
                extraField: "leaked",
              },
            ],
          },
        ],
      },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const attrs = (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;
    const parsed = JSON.parse(stringAttribute(attrs, "gen_ai.input.messages"));
    expect(parsed[0].parts[0]).toEqual({
      type: "tool_call",
      id: "tc-1",
      name: "search",
      arguments: { q: "x" },
    });
    expect(JSON.stringify(parsed)).not.toContain("leaked");
    await service.stop?.(ctx);
  });

  test("truncates oversized GenAI input messages instead of silently dropping them", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      captureContent: {
        enabled: true,
        inputMessages: true,
        outputMessages: false,
      },
    });
    await service.start(ctx);

    // Build messages that exceed MAX_OTEL_CONTENT_ATTRIBUTE_CHARS (128KB) in total.
    const largeMessages = Array.from({ length: 200 }, (_, i) => ({
      role: "user",
      content: `message-${i}-${"x".repeat(1024)}`,
    }));

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      { inputMessages: largeMessages },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const attrs = (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;
    const genAiInput = stringAttribute(attrs, "gen_ai.input.messages");
    // Must not be empty — a truncated subset should appear.
    expect(genAiInput.length).toBeGreaterThan(0);
    // Must fit within the attribute size limit.
    expect(genAiInput.length).toBeLessThanOrEqual(MAX_TEST_OTEL_CONTENT_ATTRIBUTE_CHARS + 50);
    // The first message should still be present.
    expect(genAiInput).toContain("message-0-");
    expect(JSON.parse(genAiInput)[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text" }],
    });
    await service.stop?.(ctx);
  });

  test("keeps single oversized GenAI messages and tool definitions parseable", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      captureContent: {
        enabled: true,
        inputMessages: true,
        outputMessages: false,
        toolDefinitions: true,
      },
    });
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      {
        inputMessages: [
          {
            role: "user",
            content: `single-message-${"x".repeat(MAX_TEST_OTEL_CONTENT_ATTRIBUTE_CHARS)}`,
          },
        ],
        toolDefinitions: [
          {
            name: "huge_schema",
            description: "Huge schema",
            parameters: {
              type: "object",
              properties: {
                payload: {
                  type: "string",
                  description: "x".repeat(MAX_TEST_OTEL_CONTENT_ATTRIBUTE_CHARS),
                },
              },
            },
          },
        ],
      },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const attrs = (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;
    const genAiInput = stringAttribute(attrs, "gen_ai.input.messages");
    const toolDefinitions = stringAttribute(attrs, "gen_ai.tool.definitions");
    expect(genAiInput.length).toBeLessThanOrEqual(MAX_TEST_OTEL_CONTENT_ATTRIBUTE_CHARS);
    expect(toolDefinitions.length).toBeLessThanOrEqual(MAX_TEST_OTEL_CONTENT_ATTRIBUTE_CHARS);
    expect(JSON.parse(genAiInput)).toEqual([
      {
        role: "user",
        parts: [
          {
            type: "text",
            content: expect.stringContaining("single-message-"),
          },
        ],
      },
    ]);
    expect(JSON.parse(toolDefinitions)[0]).toMatchObject({
      type: "function",
      name: "huge_schema",
      parameters: {
        type: "object",
      },
    });
    await service.stop?.(ctx);
  });

  test("exports tool definitions without requiring input message capture", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, {
      traces: true,
      captureContent: {
        enabled: true,
        inputMessages: false,
        toolDefinitions: true,
      },
    });
    await service.start(ctx);

    emitTrustedModelCallCompletedWithContent(
      {
        runId: "run-1",
        callId: "call-1",
        provider: "openai",
        model: "gpt-5.4",
        durationMs: 80,
      },
      {
        inputMessages: [{ role: "user", content: "do not export this prompt" }],
        toolDefinitions: [
          { name: "lookup", description: "Lookup data", parameters: { type: "object" } },
        ],
      },
    );
    await flushDiagnosticEvents();

    const modelCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.call",
    );
    const attrs = (modelCall?.[1] as { attributes?: Record<string, unknown> } | undefined)
      ?.attributes;
    expect(Object.hasOwn(attrs ?? {}, "gen_ai.input.messages")).toBe(false);
    expect(Object.hasOwn(attrs ?? {}, "input.value")).toBe(false);
    expect(Object.hasOwn(attrs ?? {}, "mo.content.input_messages")).toBe(false);
    expect(JSON.parse(stringAttribute(attrs, "gen_ai.tool.definitions"))).toEqual([
      {
        type: "function",
        name: "lookup",
        description: "Lookup data",
        parameters: { type: "object" },
      },
    ]);
    expect(JSON.parse(String(attrs?.["mo.content.tool_definitions"]))).toEqual([
      {
        name: "lookup",
        description: "Lookup data",
        parameters: { type: "object" },
      },
    ]);
    await service.stop?.(ctx);
  });

  test("ignores invalid diagnostic event trace parents", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { traces: true, metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "model.usage",
      trace: {
        traceId: "0".repeat(32),
        spanId: "not-a-span",
        traceFlags: "zz",
      },
      provider: "openai",
      model: "gpt-5.4",
      usage: { total: 4 },
      durationMs: 12,
    });

    const modelUsageCall = telemetryState.tracer.startSpan.mock.calls.find(
      (call) => call[0] === "mo.model.usage",
    );
    expect(telemetryState.tracer.setSpanContext).not.toHaveBeenCalled();
    expect(modelUsageCall?.[2]).toBeUndefined();
    await service.stop?.(ctx);
  });

  test("redacts sensitive reason in session.state metric attributes", async () => {
    const service = createDiagnosticsOtelService();
    const ctx = createOtelContext(OTEL_TEST_ENDPOINT, { metrics: true });
    await service.start(ctx);

    emitDiagnosticEvent({
      type: "session.state",
      state: "waiting",
      reason: "token=ghp_abcdefghijklmnopqrstuvwxyz123456", // pragma: allowlist secret
    });

    const sessionStateCall = firstCounterAddCall("mo.session.state");
    const attrs = sessionStateCall[1];
    expect(sessionStateCall[0]).toBe(1);
    expect(String(attrs?.["mo.reason"])).toContain("…");
    expect(typeof attrs?.["mo.reason"]).toBe("string");
    expect(String(attrs?.["mo.reason"])).not.toContain(
      "ghp_abcdefghijklmnopqrstuvwxyz123456", // pragma: allowlist secret
    );
    await service.stop?.(ctx);
  });
});
