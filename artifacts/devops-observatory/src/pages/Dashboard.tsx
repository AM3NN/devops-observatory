import { useDashboardPoll, useTrafficPoll } from "@/hooks/use-dashboard";
import { useServicesPoll } from "@/hooks/use-services";
import { useAlertsPoll } from "@/hooks/use-alerts";
import { useLogsPoll } from "@/hooks/use-logs";
import {
  Server,
  AlertTriangle,
  Activity,
  Clock,
  Target,
  ShieldAlert,
  Wifi,
  RefreshCcw,
  Siren,
  Bug,
  type LucideIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { PageState } from "@/components/states/PageState";
import { Link } from "wouter";

type TrafficPoint = {
  time: string;
  requests: number;
  errors: number;
  responseTime: number;
};

type KPICardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  subtext?: string;
  colorClass: string;
  href?: string;
};

type ServiceHealthMapItem = {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "down";
  environment: string;
  responseTime: number;
  errorRate: number;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  subtext,
  colorClass,
  href,
}: KPICardProps) {
  const content = (
    <motion.div
      variants={itemVariants}
      className={`glass-panel p-6 rounded-2xl relative overflow-hidden group ${href ? "cursor-pointer hover:border-primary/20" : ""}`}
    >
      <div
        className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${colorClass} group-hover:opacity-40 transition-opacity duration-500`}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <h3 className="text-3xl font-display font-bold text-slate-100">
            {value}
          </h3>
          {(trend || subtext) && (
            <p className="text-xs text-slate-500 mt-2 font-mono">
              {trend && (
                <span
                  className={trend > 0 ? "text-destructive" : "text-success"}
                >
                  {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%{" "}
                </span>
              )}
              {subtext}
            </p>
          )}
          {href ? (
            <p className="text-[11px] font-mono uppercase tracking-wider text-primary/80 mt-3">
              Open details
            </p>
          ) : null}
        </div>
        <div
          className={`p-3 rounded-xl bg-background/50 border border-white/5 ${colorClass}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

function formatRefreshTimestamp(timestamp: number) {
  if (!timestamp) {
    return "Waiting for data";
  }

  return `Updated ${new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

export default function Dashboard() {
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
    dataUpdatedAt: summaryUpdatedAt,
    isFetching: isFetchingSummary,
  } = useDashboardPoll();
  const {
    data: traffic,
    isLoading: isLoadingTraffic,
    isError: isTrafficError,
    refetch: refetchTraffic,
    dataUpdatedAt: trafficUpdatedAt,
    isFetching: isFetchingTraffic,
  } = useTrafficPoll();
  const {
    data: services,
    isLoading: isLoadingServices,
    isError: isServicesError,
    refetch: refetchServices,
    dataUpdatedAt: servicesUpdatedAt,
    isFetching: isFetchingServices,
  } = useServicesPoll();
  const {
    data: alerts,
    isError: isAlertsError,
    refetch: refetchAlerts,
    dataUpdatedAt: alertsUpdatedAt,
    isFetching: isFetchingAlerts,
  } = useAlertsPoll({ status: "firing" });
  const {
    data: recentLogs,
    isError: isLogsError,
    refetch: refetchLogs,
    dataUpdatedAt: logsUpdatedAt,
    isFetching: isFetchingLogs,
  } = useLogsPoll({ limit: 100, offset: 0 });
  const trafficSeries = Array.isArray(traffic)
    ? traffic.filter((point): point is TrafficPoint => {
        if (point == null || typeof point !== "object") {
          return false;
        }

        const candidate = point as Record<string, unknown>;

        return (
          typeof candidate.time === "string" &&
          typeof candidate.requests === "number" &&
          typeof candidate.errors === "number" &&
          typeof candidate.responseTime === "number"
        );
      })
    : [];
  const serviceHealthMap = Array.isArray(services)
    ? [...services]
        .filter(
          (service): service is ServiceHealthMapItem =>
            service != null &&
            typeof service === "object" &&
            typeof service.id === "string" &&
            typeof service.name === "string" &&
            (service.status === "healthy" ||
              service.status === "degraded" ||
              service.status === "down") &&
            typeof service.environment === "string" &&
            typeof service.responseTime === "number" &&
            typeof service.errorRate === "number",
        )
        .sort((left, right) => {
          const severityOrder = { down: 0, degraded: 1, healthy: 2 } as const;

          return (
            severityOrder[left.status] - severityOrder[right.status] ||
            left.name.localeCompare(right.name)
          );
        })
    : [];
  const firingAlerts = Array.isArray(alerts) ? alerts : [];
  const recentLogEntries = Array.isArray(recentLogs?.logs)
    ? recentLogs.logs
    : [];
  const alertSeveritySummary = {
    critical: firingAlerts.filter((alert) => alert.severity === "critical")
      .length,
    warning: firingAlerts.filter((alert) => alert.severity === "warning")
      .length,
    info: firingAlerts.filter((alert) => alert.severity === "info").length,
  };
  const topErrors = Object.values(
    recentLogEntries.reduce<
      Record<
        string,
        {
          key: string;
          message: string;
          service: string;
          level: string;
          count: number;
        }
      >
    >((accumulator, log) => {
      if (log.level !== "ERROR" && log.level !== "FATAL") {
        return accumulator;
      }

      const key = `${log.service}:${log.message}`;
      const existing = accumulator[key];

      if (existing) {
        existing.count += 1;
        if (log.level === "FATAL") {
          existing.level = "FATAL";
        }
        return accumulator;
      }

      accumulator[key] = {
        key,
        message: log.message,
        service: log.service,
        level: log.level,
        count: 1,
      };

      return accumulator;
    }, {}),
  )
    .sort(
      (left, right) =>
        right.count - left.count || left.service.localeCompare(right.service),
    )
    .slice(0, 5);
  const lastRefreshAt = Math.max(
    summaryUpdatedAt,
    trafficUpdatedAt,
    servicesUpdatedAt,
    alertsUpdatedAt,
    logsUpdatedAt,
  );
  const isLiveUpdating =
    isFetchingSummary ||
    isFetchingTraffic ||
    isFetchingServices ||
    isFetchingAlerts ||
    isFetchingLogs;

  if (isLoadingSummary || isLoadingTraffic) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isSummaryError || isTrafficError) {
    return (
      <PageState
        className="max-w-7xl"
        icon={ShieldAlert}
        title="Dashboard data is unavailable"
        description="The observability services did not respond. Try reloading the data."
        actionLabel="Retry"
        onAction={() => {
          void refetchSummary();
          void refetchTraffic();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Platform Overview
          </h2>
          <p className="text-sm text-slate-400">
            Real-time telemetry and service health
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3 py-2 text-xs font-mono text-slate-300">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isLiveUpdating ? "bg-primary animate-pulse" : "bg-success"}`}
            ></span>
            <Wifi className="h-3.5 w-3.5 text-primary" />
            <span>{isLiveUpdating ? "Live updating" : "Live"}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3 py-2 text-xs font-mono text-slate-400">
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>{formatRefreshTimestamp(lastRefreshAt)}</span>
          </div>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        <KPICard
          title="Total Services"
          value={summary?.totalServices || 0}
          icon={Server}
          subtext={`${summary?.healthyServices} healthy`}
          colorClass="text-primary"
          href="/services"
        />
        <KPICard
          title="Active Alerts"
          value={summary?.activeAlerts || 0}
          icon={AlertTriangle}
          subtext={`${summary?.criticalAlerts} critical`}
          colorClass={
            summary?.criticalAlerts ? "text-destructive" : "text-warning"
          }
          href="/alerts"
        />
        <KPICard
          title="Logs / Min"
          value={(summary?.logsPerMinute || 0).toLocaleString()}
          icon={Activity}
          colorClass="text-info"
          href="/logs"
        />
        <KPICard
          title="Avg Latency"
          value={`${summary?.avgResponseTime || 0}ms`}
          icon={Clock}
          colorClass={
            summary?.avgResponseTime && summary.avgResponseTime > 500
              ? "text-warning"
              : "text-success"
          }
          href="/apm"
        />
        <KPICard
          title="Global Errors"
          value={`${summary?.globalErrorRate || 0}%`}
          icon={ShieldAlert}
          trend={0.5}
          colorClass="text-destructive"
          href="/logs"
        />
        <KPICard
          title="SLOs at Risk"
          value={summary?.slosAtRisk || 0}
          icon={Target}
          colorClass="text-warning"
          href="/slo"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-panel p-6 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-100">
              Global Traffic & Errors
            </h3>
            <div className="flex items-center space-x-4 text-sm font-mono">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-primary mr-2"></div>
                Requests
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-destructive mr-2"></div>
                Errors
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            {trafficSeries.length === 0 ? (
              <PageState
                icon={Activity}
                title="No traffic data"
                description="Traffic metrics are not available yet for the dashboard window."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trafficSeries}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(val) => val}
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                    interval={9}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(val) => val}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Services Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6 rounded-2xl flex flex-col"
        >
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Service Health Map
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Live service registry grouped by current health state
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-success/20 bg-success/10 px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Healthy
                </p>
                <p className="text-lg font-bold text-success">
                  {summary?.healthyServices || 0}
                </p>
              </div>
              <div className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Degraded
                </p>
                <p className="text-lg font-bold text-warning">
                  {summary?.degradedServices || 0}
                </p>
              </div>
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Down
                </p>
                <p className="text-lg font-bold text-destructive">
                  {summary?.downServices || 0}
                </p>
              </div>
            </div>
          </div>

          {isServicesError ? (
            <PageState
              icon={Server}
              title="Service health map unavailable"
              description="The live service registry could not be loaded."
              actionLabel="Retry"
              onAction={() => void refetchServices()}
            />
          ) : isLoadingServices ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : serviceHealthMap.length === 0 ? (
            <PageState
              icon={Server}
              title="No monitored services"
              description="Services will appear here as soon as telemetry starts reaching the platform."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {serviceHealthMap.map((service) => {
                const statusStyles =
                  service.status === "healthy"
                    ? {
                        badge: "border-success/20 bg-success/10 text-success",
                        dot: "bg-success",
                        pulse: "shadow-[0_0_20px_rgba(34,197,94,0.12)]",
                      }
                    : service.status === "degraded"
                      ? {
                          badge: "border-warning/20 bg-warning/10 text-warning",
                          dot: "bg-warning",
                          pulse: "shadow-[0_0_20px_rgba(245,158,11,0.12)]",
                        }
                      : {
                          badge:
                            "border-destructive/20 bg-destructive/10 text-destructive",
                          dot: "bg-destructive",
                          pulse: "shadow-[0_0_20px_rgba(248,113,113,0.14)]",
                        };

                return (
                  <Link key={service.id} href="/services">
                    <div
                      className={`rounded-2xl border border-white/5 bg-background/50 p-4 transition-colors hover:border-primary/20 cursor-pointer ${statusStyles.pulse}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 truncate">
                            {service.name}
                          </p>
                          <p className="text-xs uppercase tracking-wider text-slate-500 mt-1">
                            {service.environment}
                          </p>
                        </div>
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyles.badge}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${statusStyles.dot}`}
                          ></span>
                          {service.status}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                        <div className="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                          <p className="text-slate-500 mb-1">Latency</p>
                          <p>{service.responseTime}ms</p>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                          <p className="text-slate-500 mb-1">Errors</p>
                          <p>{service.errorRate}%</p>
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] font-mono uppercase tracking-wider text-primary/80">
                        Open service registry
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="lg:col-span-2 glass-panel p-6 rounded-2xl"
        >
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Top Errors</h3>
              <p className="text-sm text-slate-400 mt-1">
                Most frequent error signatures from the recent log stream
              </p>
            </div>
            <Link
              href="/logs"
              className="text-xs font-mono uppercase tracking-wider text-primary"
            >
              Open logs
            </Link>
          </div>

          {isLogsError ? (
            <PageState
              icon={Bug}
              title="Top errors unavailable"
              description="Recent log data could not be loaded."
              actionLabel="Retry"
              onAction={() => void refetchLogs()}
            />
          ) : topErrors.length === 0 ? (
            <PageState
              icon={Bug}
              title="No recent error spikes"
              description="No repeated ERROR or FATAL signatures were found in the latest logs."
            />
          ) : (
            <div className="space-y-3">
              {topErrors.map((errorItem, index) => (
                <div
                  key={errorItem.key}
                  className="rounded-2xl border border-white/5 bg-background/50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-slate-500">
                          #{index + 1}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${errorItem.level === "FATAL" ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-warning/20 bg-warning/10 text-warning"}`}
                        >
                          {errorItem.level}
                        </span>
                        <span className="text-xs uppercase tracking-wider text-slate-500">
                          {errorItem.service}
                        </span>
                      </div>
                      <p className="text-sm text-slate-100 leading-6">
                        {errorItem.message}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl border border-white/5 bg-black/10 px-3 py-2 text-right">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        Occurrences
                      </p>
                      <p className="text-lg font-bold text-slate-100">
                        {errorItem.count}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-panel p-6 rounded-2xl"
        >
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Alert Severity
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Active alert distribution by severity level
              </p>
            </div>
            <Link
              href="/alerts"
              className="text-xs font-mono uppercase tracking-wider text-primary"
            >
              Open alerts
            </Link>
          </div>

          {isAlertsError ? (
            <PageState
              icon={Siren}
              title="Alert summary unavailable"
              description="Severity counts could not be loaded from the alert stream."
              actionLabel="Retry"
              onAction={() => void refetchAlerts()}
            />
          ) : firingAlerts.length === 0 ? (
            <PageState
              icon={Siren}
              title="No active alerts"
              description="There are no currently firing alerts in the platform."
            />
          ) : (
            <div className="space-y-4">
              {[
                {
                  label: "Critical",
                  value: alertSeveritySummary.critical,
                  tone: "border-destructive/20 bg-destructive/10 text-destructive",
                },
                {
                  label: "Warning",
                  value: alertSeveritySummary.warning,
                  tone: "border-warning/20 bg-warning/10 text-warning",
                },
                {
                  label: "Info",
                  value: alertSeveritySummary.info,
                  tone: "border-primary/20 bg-primary/10 text-primary",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/5 bg-background/50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-200">
                      {item.label}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${item.tone}`}
                    >
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full ${item.label === "Critical" ? "bg-destructive" : item.label === "Warning" ? "bg-warning" : "bg-primary"}`}
                      style={{
                        width: `${firingAlerts.length > 0 ? (item.value / firingAlerts.length) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
