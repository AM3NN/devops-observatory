import { useDashboardPoll, useTrafficPoll } from "@/hooks/use-dashboard";
import {
  Server,
  AlertTriangle,
  Activity,
  Clock,
  Target,
  ShieldAlert,
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
}: KPICardProps) {
  return (
    <motion.div
      variants={itemVariants}
      className="glass-panel p-6 rounded-2xl relative overflow-hidden group"
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
        </div>
        <div
          className={`p-3 rounded-xl bg-background/50 border border-white/5 ${colorClass}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useDashboardPoll();
  const {
    data: traffic,
    isLoading: isLoadingTraffic,
    isError: isTrafficError,
    refetch: refetchTraffic,
  } = useTrafficPoll();
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
        />
        <KPICard
          title="Active Alerts"
          value={summary?.activeAlerts || 0}
          icon={AlertTriangle}
          subtext={`${summary?.criticalAlerts} critical`}
          colorClass={
            summary?.criticalAlerts ? "text-destructive" : "text-warning"
          }
        />
        <KPICard
          title="Logs / Min"
          value={(summary?.logsPerMinute || 0).toLocaleString()}
          icon={Activity}
          colorClass="text-info"
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
        />
        <KPICard
          title="Global Errors"
          value={`${summary?.globalErrorRate || 0}%`}
          icon={ShieldAlert}
          trend={0.5}
          colorClass="text-destructive"
        />
        <KPICard
          title="SLOs at Risk"
          value={summary?.slosAtRisk || 0}
          icon={Target}
          colorClass="text-warning"
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
          <h3 className="text-lg font-bold text-slate-100 mb-6">
            Environment Health
          </h3>
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="bg-background/50 border border-white/5 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-success"></div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-200">Healthy</span>
                <span className="text-xl font-mono text-success">
                  {summary?.healthyServices}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-success h-full"
                  style={{
                    width: `${((summary?.healthyServices || 0) / (summary?.totalServices || 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="bg-background/50 border border-white/5 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-warning"></div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-200">Degraded</span>
                <span className="text-xl font-mono text-warning">
                  {summary?.degradedServices}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-warning h-full"
                  style={{
                    width: `${((summary?.degradedServices || 0) / (summary?.totalServices || 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="bg-background/50 border border-white/5 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-destructive"></div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-200">Down</span>
                <span className="text-xl font-mono text-destructive">
                  {summary?.downServices}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-destructive h-full"
                  style={{
                    width: `${((summary?.downServices || 0) / (summary?.totalServices || 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
