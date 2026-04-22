/**
 * Microservice Simulator
 *
 * Simulates 6 real microservices. Each service has:
 *   - Real endpoint handlers (that can be called via HTTP)
 *   - Its own error rate, latency profile, and behavior
 *   - Auto-instrumentation sending data to the observatory
 *
 * Services:
 *   svc-api-gateway    — Routes all client requests
 *   svc-auth           — OAuth2 / JWT authentication
 *   svc-user           — User account management
 *   svc-payment        — Payment processing
 *   svc-notification   — Email / SMS / Push
 *   svc-analytics      — Event collection & reporting
 */

import { randomUUID } from "crypto";
import { recordLog, recordTrace, type LogLevel } from "./instrumentation";

export interface ServiceConfig {
  id: string;
  name: string;
  baseLatencyMs: number; // normal latency
  peakLatencyMs: number; // latency under peak load
  baseErrorRate: number; // normal error rate (0-1)
  peakErrorRate: number; // error rate during peak load
  operations: string[]; // list of operation names
}

export const SERVICES: ServiceConfig[] = [
  {
    id: "svc-api-gateway",
    name: "API Gateway",
    baseLatencyMs: 45,
    peakLatencyMs: 280,
    baseErrorRate: 0.01,
    peakErrorRate: 0.04,
    operations: [
      "routeRequest",
      "rateLimitCheck",
      "authValidation",
      "responseAggregation",
    ],
  },
  {
    id: "svc-auth",
    name: "Auth Service",
    baseLatencyMs: 60,
    peakLatencyMs: 150,
    baseErrorRate: 0.005,
    peakErrorRate: 0.02,
    operations: [
      "login",
      "tokenRefresh",
      "logout",
      "validateToken",
      "revokeToken",
    ],
  },
  {
    id: "svc-user",
    name: "User Service",
    baseLatencyMs: 80,
    peakLatencyMs: 320,
    baseErrorRate: 0.02,
    peakErrorRate: 0.06,
    operations: [
      "getProfile",
      "updateProfile",
      "listUsers",
      "deleteUser",
      "searchUsers",
    ],
  },
  {
    id: "svc-payment",
    name: "Payment Service",
    baseLatencyMs: 200,
    peakLatencyMs: 850,
    baseErrorRate: 0.03,
    peakErrorRate: 0.08,
    operations: [
      "processPayment",
      "refund",
      "getInvoice",
      "validateCard",
      "checkBalance",
    ],
  },
  {
    id: "svc-notification",
    name: "Notification Service",
    baseLatencyMs: 120,
    peakLatencyMs: 400,
    baseErrorRate: 0.015,
    peakErrorRate: 0.05,
    operations: [
      "sendEmail",
      "sendSMS",
      "pushNotification",
      "getBatchStatus",
      "retryFailed",
    ],
  },
  {
    id: "svc-analytics",
    name: "Analytics Service",
    baseLatencyMs: 150,
    peakLatencyMs: 600,
    baseErrorRate: 0.01,
    peakErrorRate: 0.03,
    operations: [
      "trackEvent",
      "aggregateMetrics",
      "generateReport",
      "getStats",
      "exportData",
    ],
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(base: number, factor = 0.4): number {
  return base + (Math.random() - 0.5) * base * factor;
}

function isPeakHour(): boolean {
  const h = new Date().getHours();
  return h >= 8 && h <= 18;
}

const SUCCESS_MESSAGES: Record<string, string[]> = {
  login: [
    "User authenticated successfully",
    "JWT token issued successfully (exp: 3600s)",
    "Session created - IP: 192.168.1.x",
  ],
  tokenRefresh: [
    "Token refreshed successfully",
    "Refresh token validated, new access token generated",
  ],
  validateToken: [
    "JWT token valid - claims verified",
    "Token signature verified successfully",
  ],
  getProfile: [
    "User profile retrieved from cache",
    "User profile loaded from the database",
    "Cache HIT - user:profile:*",
  ],
  updateProfile: [
    "Profile updated successfully",
    "User data saved to the database",
  ],
  processPayment: [
    "Payment processed successfully - Transaction ID: TXN-*",
    "Bank authorization received (code 00)",
    "Payment validated - amount charged",
  ],
  refund: ["Refund initiated successfully", "Reversal sent to the bank"],
  sendEmail: [
    "Email sent successfully - SMTP 250 OK",
    "Email queued for delivery",
  ],
  sendSMS: [
    "SMS sent successfully - status: delivered",
    "SMS handed off to the carrier",
  ],
  trackEvent: [
    "Event recorded in the Kafka stream",
    "Event batched - flush in 5s",
    "Analytics event persisted",
  ],
  routeRequest: [
    "Request routed to the target service",
    "Route resolved - proxy latency: *ms",
  ],
  default: [
    "Operation completed successfully",
    "Processing completed",
    "Response sent to client",
  ],
};

const WARN_MESSAGES: string[] = [
  "High latency detected: *ms > 500ms threshold",
  "Retrying Redis connection (attempt 2/3)",
  "Rate-limiting quota nearing threshold: 82% used",
  "Response time degraded - connection pool saturated",
  "Retrying outbound call (attempt 2/3)",
  "Cache miss - falling back to database",
  "Heap memory nearing maximum: 87%",
  "TLS certificate expires in 12 days",
];

const ERROR_MESSAGES: Record<string, string[]> = {
  processPayment: [
    "Payment declined - code: insufficient_funds",
    "Payment gateway timeout after 3000ms",
    "CVV validation failed - invalid card",
    "Stripe connection failed: Network Error",
  ],
  login: [
    "Authentication failed - incorrect password",
    "Account locked after 5 attempts",
    "Invalid CSRF token",
  ],
  validateToken: [
    "JWT token expired - invalid signature",
    "Invalid token audience",
  ],
  sendSMS: [
    "Monthly SMS quota exceeded",
    "Invalid phone number",
    "SMS carrier unavailable",
  ],
  default: [
    "Internal service error",
    "Database connection failed: timeout",
    "Unhandled exception: NullPointerException",
    "Dependent service unavailable - circuit breaker open",
    "External call timed out after 5000ms",
  ],
};

function resolveMessage(templates: string[], seed = ""): string {
  const msg = pickRandom(templates);
  return msg
    .replace("*", Math.floor(Math.random() * 900 + 100).toString())
    .replace("*", seed || randomUUID().substring(0, 8));
}

/**
 * Simulate one request to a service and record all telemetry
 */
export async function simulateRequest(service: ServiceConfig): Promise<{
  durationMs: number;
  isError: boolean;
  statusCode: number;
}> {
  const isPeak = isPeakHour();
  const operation = pickRandom(service.operations);
  const traceId = randomUUID();
  const spanId = randomUUID();

  // Compute realistic latency with jitter
  const targetLatency = isPeak ? service.peakLatencyMs : service.baseLatencyMs;
  const durationMs = Math.max(5, Math.floor(jitter(targetLatency)));

  // Determine if this request fails
  const errorRate = isPeak ? service.peakErrorRate : service.baseErrorRate;
  const isError = Math.random() < errorRate;
  const isTimeout = durationMs > 2000;

  const statusCode = isError
    ? isTimeout
      ? 504
      : pickRandom([400, 500, 502, 503])
    : 200;
  const traceStatus: "ok" | "error" | "timeout" = isTimeout
    ? "timeout"
    : isError
      ? "error"
      : "ok";

  // Determine log level
  let level: LogLevel = "INFO";
  let message: string;

  if (isError) {
    level = durationMs > 1500 ? "FATAL" : "ERROR";
    const errorPool = ERROR_MESSAGES[operation] ?? ERROR_MESSAGES["default"];
    message = resolveMessage(errorPool);
  } else if (durationMs > 500) {
    level = "WARN";
    message = resolveMessage(WARN_MESSAGES);
  } else if (Math.random() < 0.1) {
    level = "DEBUG";
    message = `[DEBUG] ${operation} - duration: ${durationMs}ms, trace: ${traceId.substring(0, 8)}`;
  } else {
    const pool = SUCCESS_MESSAGES[operation] ?? SUCCESS_MESSAGES["default"];
    message = resolveMessage(pool);
  }

  // Fire-and-forget: record telemetry without blocking the simulation
  Promise.all([
    recordLog(service.id, level, message, traceId, spanId, {
      operation,
      durationMs,
      statusCode,
      isPeak,
    }),
    recordTrace(
      service.id,
      operation,
      durationMs,
      traceStatus,
      traceId,
      spanId,
      undefined,
      {
        "http.status_code": statusCode,
        "http.method": pickRandom(["GET", "POST", "PUT", "DELETE"]),
        "service.version": "v2.3.1",
        "peak.hour": isPeak,
      },
    ),
  ]).catch(() => {});

  return { durationMs, isError, statusCode };
}
