// Qa Lab plugin module implements docker harness behavior.
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { toQaErrorObject } from "./errors.js";
import { seedQaAgentWorkspace } from "./qa-agent-workspace.js";
import {
  createQaChannelGatewayConfig,
  QA_CHANNEL_REQUIRED_PLUGIN_IDS,
} from "./qa-channel-transport.js";
import { buildQaGatewayConfig } from "./qa-gateway-config.js";

const QA_LAB_INTERNAL_PORT = 43123;
const QA_LAB_UI_OVERLAY_DIR = "/opt/mo-qa-lab-ui";

function toPosixRelative(fromDir: string, toPath: string): string {
  return path.relative(fromDir, toPath).split(path.sep).join("/");
}

function yamlDoubleQuoted(value: string) {
  return JSON.stringify(value);
}

function renderImageBlock(params: {
  outputDir: string;
  repoRoot: string;
  imageName: string;
  usePrebuiltImage: boolean;
}) {
  if (params.usePrebuiltImage) {
    return `    image: ${params.imageName}\n`;
  }
  const context = toPosixRelative(params.outputDir, params.repoRoot) || ".";
  return `    build:\n      context: ${yamlDoubleQuoted(context)}\n      dockerfile: Dockerfile\n      args:\n        MO_EXTENSIONS: "qa-channel qa-lab"\n`;
}

function renderCompose(params: {
  outputDir: string;
  repoRoot: string;
  imageName: string;
  usePrebuiltImage: boolean;
  bindUiDist: boolean;
  gatewayPort: number;
  qaLabPort: number;
  includeQaLabUi: boolean;
}) {
  const imageBlock = renderImageBlock(params);
  const repoMount = toPosixRelative(params.outputDir, params.repoRoot) || ".";
  const qaLabUiMount = toPosixRelative(
    params.outputDir,
    path.join(params.repoRoot, "extensions", "qa-lab", "web", "dist"),
  );

  return `services:
  qa-mock-openai:
${imageBlock}    pull_policy: never
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch("http://127.0.0.1:44080/healthz").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 3s
    environment:
      MO_ENABLE_PRIVATE_QA_CLI: "1"
      MO_PROFILE: ""
    command:
      - node
      - dist/index.js
      - qa
      - mock-openai
      - --host
      - "0.0.0.0"
      - --port
      - "44080"
${
  params.includeQaLabUi
    ? `  qa-lab:
${imageBlock}    pull_policy: never
    ports:
      - "127.0.0.1:${params.qaLabPort}:${QA_LAB_INTERNAL_PORT}"
    volumes:
      - ./state:/opt/mo-scaffold:ro
${params.bindUiDist ? `      - ${yamlDoubleQuoted(`${qaLabUiMount}:${QA_LAB_UI_OVERLAY_DIR}:ro`)}\n` : ""}    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch("http://127.0.0.1:${QA_LAB_INTERNAL_PORT}/healthz").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 5s
    environment:
      MO_ENABLE_PRIVATE_QA_CLI: "1"
      MO_CONFIG_PATH: /opt/mo-scaffold/mo.json
      MO_STATE_DIR: /tmp/mo/state
      MO_SKIP_GMAIL_WATCHER: "1"
      MO_SKIP_BROWSER_CONTROL_SERVER: "1"
      MO_SKIP_CANVAS_HOST: "1"
      MO_PROFILE: ""
    command:
      - sh
      - -lc
      - MO_QA_CONTROL_UI_PROXY_TOKEN="$(node -e 'const fs=require("node:fs");const cfg=JSON.parse(fs.readFileSync("/opt/mo-scaffold/mo.json","utf8"));process.stdout.write(cfg.gateway?.auth?.token ?? "")')" exec node dist/index.js qa ui --host 0.0.0.0 --port ${QA_LAB_INTERNAL_PORT} --advertise-host 127.0.0.1 --advertise-port ${params.qaLabPort} --control-ui-url http://127.0.0.1:${params.gatewayPort}/ --control-ui-proxy-target http://mo-qa-gateway:18789/${params.bindUiDist ? ` --ui-dist-dir ${QA_LAB_UI_OVERLAY_DIR}` : ""} --auto-kickoff-target direct --send-kickoff-on-start --embedded-gateway disabled
    depends_on:
      qa-mock-openai:
        condition: service_healthy
`
    : ""
}  mo-qa-gateway:
${imageBlock}    pull_policy: never
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "127.0.0.1:${params.gatewayPort}:18789"
    environment:
      MO_CONFIG_PATH: /tmp/mo/mo.json
      MO_STATE_DIR: /tmp/mo/state
      MO_NO_RESPAWN: "1"
      MO_SKIP_GMAIL_WATCHER: "1"
      MO_SKIP_BROWSER_CONTROL_SERVER: "1"
      MO_SKIP_CANVAS_HOST: "1"
      MO_PROFILE: ""
    volumes:
      - ./state:/opt/mo-scaffold:ro
      - ${yamlDoubleQuoted(`${repoMount}:/opt/mo-repo:ro`)}
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch("http://127.0.0.1:18789/healthz").then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 15s
    depends_on:
${
  params.includeQaLabUi
    ? `      qa-lab:
        condition: service_healthy
`
    : ""
}      qa-mock-openai:
        condition: service_healthy
    command:
      - sh
      - -lc
      - mkdir -p /tmp/mo/workspace /tmp/mo/state && cp /opt/mo-scaffold/mo.json /tmp/mo/mo.json && cp -R /opt/mo-scaffold/seed-workspace/. /tmp/mo/workspace/ && rm -rf /tmp/mo/workspace/repo && ln -s /opt/mo-repo /tmp/mo/workspace/repo && exec node dist/index.js gateway run --port 18789 --bind lan --allow-unconfigured
`;
}

function renderEnvExample(params: {
  gatewayPort: number;
  qaLabPort: number;
  gatewayToken: string;
  providerBaseUrl: string;
  qaBusBaseUrl: string;
  includeQaLabUi: boolean;
}) {
  return `# QA Docker harness example env
MO_GATEWAY_TOKEN=${params.gatewayToken}
QA_GATEWAY_PORT=${params.gatewayPort}
QA_BUS_BASE_URL=${params.qaBusBaseUrl}
QA_PROVIDER_BASE_URL=${params.providerBaseUrl}
${params.includeQaLabUi ? `QA_LAB_URL=http://127.0.0.1:${params.qaLabPort}\n` : ""}`;
}

function renderReadme(params: {
  gatewayPort: number;
  qaLabPort: number;
  usePrebuiltImage: boolean;
  bindUiDist: boolean;
  includeQaLabUi: boolean;
}) {
  return `# QA Docker Harness

Generated scaffold for the Docker-backed QA lane.

Files:

- \`docker-compose.qa.yml\`
- \`.env.example\`
- \`state/mo.json\`

Suggested flow:

1. Build the prebaked image once:
   - \`docker build -t mo:qa-local-prebaked --build-arg MO_EXTENSIONS="qa-channel qa-lab" -f Dockerfile .\`
2. Start the stack:
   - \`docker compose -f docker-compose.qa.yml up${params.usePrebuiltImage ? "" : " --build"} -d\`
3. Open the QA dashboard:
   - \`${params.includeQaLabUi ? `http://127.0.0.1:${params.qaLabPort}` : "not published in this scaffold"}\`
4. The single QA site embeds both panes:
   - left: Control UI
   - right: Slack-ish QA lab
5. The repo-backed kickoff task auto-injects on startup.

Fast UI refresh:

- Start once with a prebuilt image + bind-mounted QA Lab assets:
  - \`pnpm qa:lab:up --use-prebuilt-image --bind-ui-dist --skip-ui-build\`
- In another shell, rebuild the QA Lab bundle on change:
  - \`pnpm qa:lab:watch\`
- The browser auto-reloads when the QA Lab asset hash changes.

Gateway:

- health: \`http://127.0.0.1:${params.gatewayPort}/healthz\`
- Control UI: \`http://127.0.0.1:${params.gatewayPort}/\`
- Mock OpenAI: internal \`http://qa-mock-openai:44080/v1\`

This scaffold uses localhost Control UI insecure-auth compatibility for QA only.
The gateway runs with in-process restarts inside Docker so restart actions do not
kill the container by detaching a replacement child.
`;
}

export async function writeQaDockerHarnessFiles(params: {
  outputDir: string;
  repoRoot: string;
  gatewayPort?: number;
  qaLabPort?: number;
  gatewayToken?: string;
  providerBaseUrl?: string;
  qaBusBaseUrl?: string;
  imageName?: string;
  usePrebuiltImage?: boolean;
  bindUiDist?: boolean;
  includeQaLabUi?: boolean;
}) {
  const gatewayPort = params.gatewayPort ?? 18789;
  const qaLabPort = params.qaLabPort ?? 43124;
  const gatewayToken = params.gatewayToken ?? `qa-token-${randomUUID()}`;
  const providerBaseUrl = params.providerBaseUrl ?? "http://qa-mock-openai:44080/v1";
  const qaBusBaseUrl = params.qaBusBaseUrl ?? "http://qa-lab:43123";
  const imageName = params.imageName ?? "mo:qa-local-prebaked";
  const usePrebuiltImage = params.usePrebuiltImage ?? false;
  const bindUiDist = params.bindUiDist ?? false;
  const includeQaLabUi = params.includeQaLabUi ?? true;

  await fs.mkdir(path.join(params.outputDir, "state", "seed-workspace"), { recursive: true });
  await seedQaAgentWorkspace({
    workspaceDir: path.join(params.outputDir, "state", "seed-workspace"),
    repoRoot: params.repoRoot,
  });

  const config = buildQaGatewayConfig({
    bind: "lan",
    gatewayPort: 18789,
    gatewayToken,
    providerBaseUrl,
    workspaceDir: "/tmp/mo/workspace",
    controlUiRoot: "/app/dist/control-ui",
    transportPluginIds: QA_CHANNEL_REQUIRED_PLUGIN_IDS,
    transportConfig: createQaChannelGatewayConfig({
      baseUrl: qaBusBaseUrl,
    }),
  });

  const files = [
    path.join(params.outputDir, "docker-compose.qa.yml"),
    path.join(params.outputDir, ".env.example"),
    path.join(params.outputDir, "README.md"),
    path.join(params.outputDir, "state", "mo.json"),
  ];

  await Promise.all([
    fs.writeFile(
      path.join(params.outputDir, "docker-compose.qa.yml"),
      renderCompose({
        outputDir: params.outputDir,
        repoRoot: params.repoRoot,
        imageName,
        usePrebuiltImage,
        bindUiDist,
        gatewayPort,
        qaLabPort,
        includeQaLabUi,
      }),
      "utf8",
    ),
    fs.writeFile(
      path.join(params.outputDir, ".env.example"),
      renderEnvExample({
        gatewayPort,
        qaLabPort,
        gatewayToken,
        providerBaseUrl,
        qaBusBaseUrl,
        includeQaLabUi,
      }),
      "utf8",
    ),
    fs.writeFile(
      path.join(params.outputDir, "README.md"),
      renderReadme({
        gatewayPort,
        qaLabPort,
        usePrebuiltImage,
        bindUiDist,
        includeQaLabUi,
      }),
      "utf8",
    ),
    fs.writeFile(
      path.join(params.outputDir, "state", "mo.json"),
      `${JSON.stringify(config, null, 2)}\n`,
      "utf8",
    ),
  ]);

  return {
    outputDir: params.outputDir,
    imageName,
    files: [
      ...files,
      path.join(params.outputDir, "state", "seed-workspace", "IDENTITY.md"),
      path.join(params.outputDir, "state", "seed-workspace", "QA_KICKOFF_TASK.md"),
      path.join(params.outputDir, "state", "seed-workspace", "QA_SCENARIO_PLAN.md"),
      path.join(params.outputDir, "state", "seed-workspace", "QA_SCENARIOS.yaml"),
    ],
  };
}

export async function buildQaDockerHarnessImage(
  params: {
    repoRoot: string;
    imageName?: string;
  },
  deps?: {
    runCommand?: (
      command: string,
      args: string[],
      cwd: string,
    ) => Promise<{ stdout: string; stderr: string }>;
  },
) {
  const imageName = params.imageName ?? "mo:qa-local-prebaked";
  const runCommand =
    deps?.runCommand ??
    (async (command: string, args: string[], cwd: string) => {
      return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(command, args, { cwd }, (error, stdout, stderr) => {
          if (error) {
            reject(toQaErrorObject(error, "Non-Error rejection"));
            return;
          }
          resolve({ stdout, stderr });
        });
      });
    });

  await runCommand(
    "docker",
    [
      "build",
      "-t",
      imageName,
      "--build-arg",
      "MO_EXTENSIONS=qa-channel qa-lab",
      "-f",
      "Dockerfile",
      ".",
    ],
    params.repoRoot,
  );

  return { imageName };
}
