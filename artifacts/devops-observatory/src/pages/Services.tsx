import { useServicesPoll } from "@/hooks/use-services";
import { Server, Zap, GitBranch, Activity, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { PageState } from "@/components/states/PageState";

export default function Services() {
  const { data: services, isLoading, isError, refetch } = useServicesPoll();
  const serviceList = Array.isArray(services) ? services : [];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <PageState
        className="max-w-7xl"
        icon={Server}
        title="Services are unavailable"
        description="The service registry could not be loaded."
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center">
          <Server className="w-6 h-6 mr-2 text-primary" />
          Service Registry
        </h2>
        <p className="text-sm text-slate-400">
          Inventory and health status of all registered microservices
        </p>
      </div>

      {serviceList.length === 0 ? (
        <PageState
          className="max-w-7xl"
          icon={Server}
          title="No services registered"
          description="No monitored services are available yet in the registry."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {serviceList.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel p-6 rounded-2xl flex flex-col group hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-slate-100">
                      {service.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        service.environment === "production"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : service.environment === "staging"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {service.environment}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500">
                    <GitBranch className="w-3 h-3 mr-1" />v{service.version}
                  </div>
                </div>

                <div
                  className={`flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                    service.status === "healthy"
                      ? "bg-success/10 text-success border-success/20"
                      : service.status === "degraded"
                        ? "bg-warning/10 text-warning border-warning/20"
                        : "bg-destructive/10 text-destructive border-destructive/20 animate-pulse"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mr-1.5 ${
                      service.status === "healthy"
                        ? "bg-success"
                        : service.status === "degraded"
                          ? "bg-warning"
                          : "bg-destructive"
                    }`}
                  />
                  {service.status.toUpperCase()}
                </div>
              </div>

              <p className="text-sm text-slate-400 mb-6 flex-1">
                {service.description}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-background/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-mono uppercase mb-1 flex items-center">
                    <Activity className="w-3 h-3 mr-1" /> Uptime
                  </p>
                  <p
                    className={`text-lg font-mono font-bold ${service.uptime < 99.9 ? "text-warning" : "text-slate-200"}`}
                  >
                    {service.uptime}%
                  </p>
                </div>
                <div className="bg-background/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-mono uppercase mb-1 flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> Latency
                  </p>
                  <p className="text-lg font-mono font-bold text-slate-200">
                    {service.responseTime}ms
                  </p>
                </div>
                <div className="bg-background/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-mono uppercase mb-1 flex items-center">
                    <Zap className="w-3 h-3 mr-1" /> Traffic
                  </p>
                  <p className="text-lg font-mono font-bold text-slate-200">
                    {service.requestsPerMin}{" "}
                    <span className="text-xs text-slate-500 font-sans font-normal">
                      req/m
                    </span>
                  </p>
                </div>
                <div className="bg-background/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-slate-500 font-mono uppercase mb-1 flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Errors
                  </p>
                  <p
                    className={`text-lg font-mono font-bold ${service.errorRate > 1 ? "text-destructive" : "text-slate-200"}`}
                  >
                    {service.errorRate}%
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 text-xs text-slate-500 flex justify-between items-center">
                <span>Owner Team:</span>
                <span className="font-medium text-slate-300 bg-white/5 px-2 py-1 rounded">
                  {service.team}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
