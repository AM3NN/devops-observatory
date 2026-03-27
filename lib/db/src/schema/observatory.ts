import { pgTable, text, serial, integer, timestamp, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicesTable = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  environment: text("environment").notNull(),
  status: text("status").notNull(),
  version: text("version").notNull(),
  uptime: real("uptime").notNull(),
  responseTime: real("response_time").notNull(),
  errorRate: real("error_rate").notNull(),
  requestsPerMin: real("requests_per_min").notNull(),
  team: text("team").notNull(),
  description: text("description").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const logsTable = pgTable("logs", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  level: text("level").notNull(),
  service: text("service").notNull(),
  message: text("message").notNull(),
  traceId: text("trace_id"),
  spanId: text("span_id"),
  environment: text("environment").notNull(),
  metadata: jsonb("metadata"),
});

export const apmMetricsTable = pgTable("apm_metrics", {
  id: text("id").primaryKey(),
  service: text("service").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  responseTime: real("response_time").notNull(),
  throughput: real("throughput").notNull(),
  errorRate: real("error_rate").notNull(),
  cpuUsage: real("cpu_usage").notNull(),
  memoryUsage: real("memory_usage").notNull(),
  activeConnections: real("active_connections").notNull(),
});

export const tracesTable = pgTable("traces", {
  traceId: text("trace_id").notNull(),
  spanId: text("span_id").primaryKey(),
  service: text("service").notNull(),
  operation: text("operation").notNull(),
  duration: real("duration").notNull(),
  status: text("status").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  parentSpanId: text("parent_span_id"),
  tags: jsonb("tags"),
});

export const alertsTable = pgTable("alerts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  service: text("service").notNull(),
  firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedBy: text("acknowledged_by"),
  runbook: text("runbook"),
  labels: jsonb("labels"),
  peakLoadPeriod: boolean("peak_load_period").notNull().default(false),
});

export const slosTable = pgTable("slos", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  service: text("service").notNull(),
  type: text("type").notNull(),
  target: real("target").notNull(),
  current: real("current").notNull(),
  errorBudget: real("error_budget").notNull(),
  errorBudgetConsumed: real("error_budget_consumed").notNull(),
  window: text("window").notNull(),
  status: text("status").notNull(),
  responsible: text("responsible").notNull(),
  description: text("description").notNull(),
  burnRate: real("burn_rate").notNull(),
});

export const ingestionAgentsTable = pgTable("ingestion_agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  apiKey: text("api_key").notNull().unique(),
  status: text("status").notNull().default("active"),
  host: text("host"),
  language: text("language"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  totalLogs: integer("total_logs").notNull().default(0),
  totalMetrics: integer("total_metrics").notNull().default(0),
  totalTraces: integer("total_traces").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLogSchema = createInsertSchema(logsTable);
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = typeof logsTable.$inferSelect;
export type Service = typeof servicesTable.$inferSelect;
export type Alert = typeof alertsTable.$inferSelect;
export type Slo = typeof slosTable.$inferSelect;
export type ApmMetric = typeof apmMetricsTable.$inferSelect;
export type Trace = typeof tracesTable.$inferSelect;
export type IngestionAgent = typeof ingestionAgentsTable.$inferSelect;
