import crypto from "node:crypto";

const OBSERVATORY_URL =
  process.env.OBSERVATORY_URL ?? "http://localhost:4000/api";
const OBSERVATORY_API_KEY =
  process.env.OBSERVATORY_API_KEY ?? "obs-key-pfe-demo-2024";
const SERVICE_NAME = process.env.SERVICE_NAME ?? "sample-live-service";
const ENVIRONMENT = process.env.ENVIRONMENT ?? "production";
const HEARTBEAT_INTERVAL_MS = Number(
  process.env.HEARTBEAT_INTERVAL_MS ?? "30000",
);
const METRICS_INTERVAL_MS = Number(process.env.METRICS_INTERVAL_MS ?? "15000");
const LOG_INTERVAL_MS = Number(process.env.LOG_INTERVAL_MS ?? "7000");

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

async function postJson(path, body) {
  const response = await fetch(`${OBSERVATORY_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": OBSERVATORY_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }

  return response;
}

async function sendHeartbeat() {
  await postJson("/ingest/heartbeat", {
    service: SERVICE_NAME,
    status: "ok",
    environment: ENVIRONMENT,
  });

  console.log("heartbeat sent");
}

async function sendMetrics() {
  const responseTime = randomBetween(120, 650);
  const throughput = randomBetween(15, 180);
  const errorRate =
    Math.random() < 0.2 ? randomBetween(2, 8) : randomBetween(0, 1.5);

  await postJson("/ingest/metrics", {
    service: SERVICE_NAME,
    responseTime: Number(responseTime.toFixed(2)),
    throughput: Number(throughput.toFixed(2)),
    errorRate: Number(errorRate.toFixed(2)),
    cpuUsage: Number(randomBetween(25, 85).toFixed(2)),
    memoryUsage: Number(randomBetween(30, 78).toFixed(2)),
    activeConnections: Math.floor(randomBetween(4, 35)),
    environment: ENVIRONMENT,
  });

  console.log("metrics sent");
}

async function sendTrace() {
  const traceId = crypto.randomUUID();
  const spanId = crypto.randomUUID();
  const duration = randomBetween(80, 900);
  const isError = Math.random() < 0.18;

  await postJson("/ingest/traces", {
    spans: [
      {
        traceId,
        spanId,
        service: SERVICE_NAME,
        operation:
          Math.random() < 0.5 ? "GET /api/orders" : "POST /api/payments/charge",
        duration: Number(duration.toFixed(2)),
        status: isError ? "error" : "ok",
        environment: ENVIRONMENT,
        tags: {
          source: "live-sample-service",
          region: "eu-west-1",
        },
      },
    ],
  });

  console.log("trace sent");
}

async function sendLog() {
  const traceId = crypto.randomUUID();
  const spanId = crypto.randomUUID();
  const samples = [
    {
      level: "INFO",
      message: "Order checkout completed successfully",
    },
    {
      level: "WARN",
      message: "Downstream payment provider latency is increasing",
    },
    {
      level: "ERROR",
      message: "Failed to confirm payment with external gateway",
    },
  ];
  const sample = samples[Math.floor(Math.random() * samples.length)];

  await postJson("/ingest/logs", {
    logs: [
      {
        service: SERVICE_NAME,
        level: sample.level,
        message: sample.message,
        traceId,
        spanId,
        environment: ENVIRONMENT,
        metadata: {
          source: "live-sample-service",
          region: "eu-west-1",
          requestId: crypto.randomUUID(),
        },
      },
    ],
  });

  console.log(`log sent (${sample.level})`);
}

async function bootstrap() {
  console.log(`starting ${SERVICE_NAME}`);
  console.log(`observatory url: ${OBSERVATORY_URL}`);

  await sendHeartbeat();
  await sendMetrics();
  await sendTrace();
  await sendLog();

  setInterval(() => {
    void sendHeartbeat().catch((error) =>
      console.error("heartbeat failed", error),
    );
  }, HEARTBEAT_INTERVAL_MS);

  setInterval(() => {
    void sendMetrics().catch((error) => console.error("metrics failed", error));
  }, METRICS_INTERVAL_MS);

  setInterval(() => {
    void sendTrace().catch((error) => console.error("trace failed", error));
  }, METRICS_INTERVAL_MS + 3000);

  setInterval(() => {
    void sendLog().catch((error) => console.error("log failed", error));
  }, LOG_INTERVAL_MS);
}

bootstrap().catch((error) => {
  console.error("sample service failed to start", error);
  process.exit(1);
});
