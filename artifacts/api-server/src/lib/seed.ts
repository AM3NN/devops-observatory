import { db } from "@devops-observatory/db";
import {
  servicesTable,
  logsTable,
  apmMetricsTable,
  tracesTable,
  alertsTable,
  slosTable,
} from "@devops-observatory/db";
import { logger } from "./logger";

function randomBetween(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId() {
  return Math.random().toString(36).substring(2, 10);
}

const SERVICES = [
  {
    id: "svc-api-gateway",
    name: "API Gateway",
    team: "Platform",
    description: "Primary entry point for all client requests",
  },
  {
    id: "svc-auth",
    name: "Auth Service",
    team: "Security",
    description: "OAuth2/OIDC authentication and authorization",
  },
  {
    id: "svc-user",
    name: "User Service",
    team: "Core",
    description: "User account and profile management",
  },
  {
    id: "svc-payment",
    name: "Payment Service",
    team: "Finance",
    description: "Payment processing and billing",
  },
  {
    id: "svc-notification",
    name: "Notification Service",
    team: "Core",
    description: "Email, SMS, and push notification delivery",
  },
  {
    id: "svc-analytics",
    name: "Analytics Service",
    team: "Data",
    description: "Business event collection and analysis",
  },
  {
    id: "svc-storage",
    name: "Storage Service",
    team: "Platform",
    description: "File and binary object management",
  },
  {
    id: "svc-scheduler",
    name: "Job Scheduler",
    team: "Platform",
    description: "Scheduled job orchestration",
  },
];

const LOG_MESSAGES = {
  INFO: [
    "Request processed successfully",
    "Database connection established",
    "Cache invalidated for key user:profile",
    "Scheduled job executed: cleanup_sessions",
    "New JWT token issued for the user",
    "Deployment of version v2.3.1 completed",
    "Health check passed",
    "Data synchronization completed",
  ],
  WARN: [
    "High latency detected: 850ms > 500ms threshold",
    "Rate limiting quota nearing threshold: 85% used",
    "Retrying Redis connection (attempt 2/3)",
    "SSL certificate expires in 15 days",
    "Cache memory nearing limit: 89%",
    "Traffic spike detected: +340% vs baseline",
  ],
  ERROR: [
    "Database connection failed: timeout",
    "JWT token validation failed: invalid signature",
    "Payment failed: card declined (code: insufficient_funds)",
    "Timeout during external Stripe API call",
    "SMS service quota exceeded",
    "500 error: NullPointerException in UserService.getProfile()",
  ],
  DEBUG: [
    "DNS resolution: api.stripe.com -> 3.33.15.1",
    "Connection pool: 8/20 active",
    "Cache HIT for key: products:featured",
    "SQL query: SELECT * FROM users WHERE id = ? (2ms)",
  ],
  FATAL: [
    "Critical disk space: 2% remaining",
    "Out of memory: the process will be restarted",
    "Unable to connect to the Redis cluster: all connections refused",
  ],
};

const OPERATIONS = [
  "GET /api/users",
  "POST /api/auth/login",
  "GET /api/products",
  "POST /api/payments/charge",
  "GET /api/analytics/events",
  "PUT /api/users/:id",
  "DELETE /api/sessions/:id",
  "POST /api/notifications/send",
];

export async function seedDatabase() {
  try {
    const existingServices = await db.select().from(servicesTable).limit(1);
    if (existingServices.length > 0) {
      logger.info("Database already seeded, skipping");
      return;
    }

    logger.info("Seeding database...");

    const environments = ["production", "staging", "development"] as const;
    const statuses = [
      "healthy",
      "healthy",
      "healthy",
      "degraded",
      "down",
    ] as const;

    for (const svc of SERVICES) {
      await db
        .insert(servicesTable)
        .values({
          id: svc.id,
          name: svc.name,
          environment: randomItem([...environments]),
          status: randomItem([...statuses]),
          version: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
          uptime: randomBetween(95, 99.99),
          responseTime: randomBetween(20, 450),
          errorRate: randomBetween(0.01, 2.5),
          requestsPerMin: randomBetween(100, 5000, 0),
          team: svc.team,
          description: svc.description,
        })
        .onConflictDoNothing();
    }

    const levels = [
      "DEBUG",
      "INFO",
      "INFO",
      "INFO",
      "WARN",
      "ERROR",
      "FATAL",
    ] as const;
    const now = new Date();

    for (let i = 0; i < 200; i++) {
      const level = randomItem([...levels]);
      const messages = LOG_MESSAGES[level];
      const svc = randomItem(SERVICES);
      const tsOffset = Math.floor(Math.random() * 3600000);
      await db
        .insert(logsTable)
        .values({
          id: `log-${randomId()}`,
          timestamp: new Date(now.getTime() - tsOffset),
          level,
          service: svc.id,
          message: randomItem(messages),
          traceId: `trace-${randomId()}`,
          spanId: `span-${randomId()}`,
          environment: randomItem(["production", "staging"]),
          metadata: {
            host: `node-${Math.floor(Math.random() * 10) + 1}`,
            pid: Math.floor(Math.random() * 30000) + 1000,
          },
        })
        .onConflictDoNothing();
    }

    for (const svc of SERVICES) {
      for (let i = 0; i < 24; i++) {
        const tsOffset = i * 3600000;
        const isPeak = i >= 8 && i <= 12;
        await db
          .insert(apmMetricsTable)
          .values({
            id: `apm-${svc.id}-${i}`,
            service: svc.id,
            timestamp: new Date(now.getTime() - tsOffset),
            responseTime: randomBetween(isPeak ? 200 : 50, isPeak ? 800 : 300),
            throughput: randomBetween(isPeak ? 500 : 100, isPeak ? 2000 : 600),
            errorRate: randomBetween(isPeak ? 1 : 0.1, isPeak ? 5 : 1),
            cpuUsage: randomBetween(isPeak ? 60 : 20, isPeak ? 95 : 60),
            memoryUsage: randomBetween(isPeak ? 55 : 30, isPeak ? 85 : 65),
            activeConnections: randomBetween(
              isPeak ? 50 : 10,
              isPeak ? 200 : 80,
              0,
            ),
          })
          .onConflictDoNothing();
      }
    }

    for (let i = 0; i < 50; i++) {
      const traceId = `trace-${randomId()}`;
      const svc = randomItem(SERVICES);
      await db
        .insert(tracesTable)
        .values({
          traceId,
          spanId: `span-${randomId()}`,
          service: svc.id,
          operation: randomItem(OPERATIONS),
          duration: randomBetween(5, 2000),
          status: randomItem(["ok", "ok", "ok", "error", "timeout"]),
          timestamp: new Date(
            now.getTime() - Math.floor(Math.random() * 3600000),
          ),
          tags: { "http.method": "GET", "http.status_code": 200 },
        })
        .onConflictDoNothing();
    }

    const alertDefs = [
      {
        id: "alert-001",
        title: "High API Gateway Latency",
        description:
          "Average response time exceeds 800ms (threshold: 500ms) over the last 5 minutes",
        severity: "critical",
        service: "svc-api-gateway",
        peakLoadPeriod: true,
        runbook: "https://wiki.internal/runbooks/high-latency",
      },
      {
        id: "alert-002",
        title: "High Payment Service Error Rate",
        description:
          "Error rate at 4.2% (threshold: 2%) - check the Stripe connection",
        severity: "critical",
        service: "svc-payment",
        peakLoadPeriod: true,
        runbook: "https://wiki.internal/runbooks/payment-errors",
      },
      {
        id: "alert-003",
        title: "SMS Quota Near Limit",
        description:
          "85% of the monthly SMS quota has been used - 15 days remain this month",
        severity: "warning",
        service: "svc-notification",
        peakLoadPeriod: false,
        runbook: "https://wiki.internal/runbooks/sms-quota",
      },
      {
        id: "alert-004",
        title: "SSL Certificate Expiring Soon",
        description: "The SSL certificate for auth.internal expires in 14 days",
        severity: "warning",
        service: "svc-auth",
        peakLoadPeriod: false,
        runbook: null,
      },
      {
        id: "alert-005",
        title: "Job Scheduler Unreachable",
        description: "The scheduling service has not responded for 2 minutes",
        severity: "critical",
        service: "svc-scheduler",
        peakLoadPeriod: false,
        runbook: "https://wiki.internal/runbooks/scheduler-down",
      },
      {
        id: "alert-006",
        title: "Analytics Load Spike",
        description:
          "Throughput is 3x higher than the normal baseline for this period",
        severity: "info",
        service: "svc-analytics",
        peakLoadPeriod: true,
        runbook: null,
      },
    ];

    for (const alert of alertDefs) {
      await db
        .insert(alertsTable)
        .values({
          ...alert,
          status: randomItem(["firing", "firing", "acknowledged", "resolved"]),
          firedAt: new Date(
            now.getTime() - Math.floor(Math.random() * 7200000),
          ),
          labels: { team: "ops", env: "production" },
        })
        .onConflictDoNothing();
    }

    const sloDefs = [
      {
        id: "slo-001",
        name: "API Gateway Availability",
        service: "svc-api-gateway",
        type: "availability",
        target: 99.9,
        current: 99.94,
        window: "30 days",
        responsible: "Platform Team",
        description: "Overall availability of the production API Gateway",
        burnRate: 0.12,
      },
      {
        id: "slo-002",
        name: "API Gateway P99 Latency",
        service: "svc-api-gateway",
        type: "latency",
        target: 99.0,
        current: 96.2,
        window: "7 days",
        responsible: "Platform Team",
        description: "95% of requests complete in under 500ms",
        burnRate: 3.8,
      },
      {
        id: "slo-003",
        name: "Auth Service Availability",
        service: "svc-auth",
        type: "availability",
        target: 99.99,
        current: 99.99,
        window: "30 days",
        responsible: "Security Team",
        description: "High availability of the authentication service",
        burnRate: 0.01,
      },
      {
        id: "slo-004",
        name: "Payment Error Rate",
        service: "svc-payment",
        type: "error_rate",
        target: 99.5,
        current: 95.8,
        window: "7 days",
        responsible: "Finance Team",
        description: "No more than 0.5% of transactions may fail",
        burnRate: 7.4,
      },
      {
        id: "slo-005",
        name: "User Service Availability",
        service: "svc-user",
        type: "availability",
        target: 99.9,
        current: 99.92,
        window: "30 days",
        responsible: "Core Team",
        description: "Availability of the user service",
        burnRate: 0.18,
      },
      {
        id: "slo-006",
        name: "Notification Throughput",
        service: "svc-notification",
        type: "throughput",
        target: 95.0,
        current: 93.1,
        window: "7 days",
        responsible: "Core Team",
        description: "95% of notifications are delivered within 30 seconds",
        burnRate: 2.9,
      },
    ];

    for (const slo of sloDefs) {
      const errorBudget = 100 - slo.target;
      const errorBudgetConsumed = Math.max(
        0,
        ((slo.target - slo.current) / errorBudget) * 100,
      );
      let status: "met" | "at_risk" | "breached" = "met";
      if (slo.burnRate > 5) status = "breached";
      else if (slo.burnRate > 2) status = "at_risk";

      await db
        .insert(slosTable)
        .values({
          ...slo,
          errorBudget,
          errorBudgetConsumed,
          status,
        })
        .onConflictDoNothing();
    }

    logger.info("Database seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed database");
  }
}
