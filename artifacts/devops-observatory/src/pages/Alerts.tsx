import { useState } from "react";
import { useAlertsPoll, useAckAlert } from "@/hooks/use-alerts";
import { AlertTriangle, CheckCircle2, Info, Check, Clock, FilterX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { GetAlertsSeverity, GetAlertsStatus } from "@workspace/api-client-react";

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", glow: "shadow-[0_0_15px_rgba(248,113,113,0.15)]" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", glow: "" },
  info: { icon: Info, color: "text-info", bg: "bg-info/10", border: "border-info/30", glow: "" }
};

export default function Alerts() {
  const [status, setStatus] = useState<GetAlertsStatus | "all">("firing");
  const [severity, setSeverity] = useState<GetAlertsSeverity | "all">("all");

  const { data: alerts, isLoading } = useAlertsPoll({
    status: status !== "all" ? status : undefined,
    severity: severity !== "all" ? severity : undefined
  });

  const { mutate: acknowledge, isPending: isAcking } = useAckAlert();

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2 text-destructive" />
            Alert Management
          </h2>
          <p className="text-sm text-slate-400">Respond to active incidents and anomalies</p>
        </div>

        <div className="flex gap-2">
          <select 
            className="bg-card border border-white/10 rounded-xl py-2 px-4 text-sm text-slate-200 focus:outline-none focus:border-primary shadow-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="all">All Statuses</option>
            <option value="firing">Firing</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>

          <select 
            className="bg-card border border-white/10 rounded-xl py-2 px-4 text-sm text-slate-200 focus:outline-none focus:border-primary shadow-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as any)}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : null}

        <AnimatePresence>
          {alerts?.length === 0 && !isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center"
            >
              <CheckCircle2 className="w-16 h-16 text-success mb-4 opacity-50" />
              <h3 className="text-xl font-display font-bold text-slate-200 mb-2">No active alerts</h3>
              <p className="text-slate-400 max-w-sm">
                Your systems are looking healthy. Enjoy the silence, or adjust your filters to see historical data.
              </p>
            </motion.div>
          )}

          {alerts?.map((alert, i) => {
            const conf = severityConfig[alert.severity];
            const Icon = conf.icon;
            
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className={`bg-card/80 backdrop-blur-md rounded-2xl border ${conf.border} overflow-hidden ${conf.glow} shadow-xl relative`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${alert.status === 'firing' ? 'bg-destructive animate-pulse' : alert.status === 'acknowledged' ? 'bg-warning' : 'bg-success'}`} />
                
                <div className="p-5 pl-7 flex flex-col md:flex-row gap-5 items-start md:items-center">
                  
                  {/* Icon & Meta */}
                  <div className={`p-3 rounded-xl ${conf.bg} shrink-0`}>
                    <Icon className={`w-6 h-6 ${conf.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                        {alert.service}
                      </span>
                      {alert.peakLoadPeriod && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning/20 text-warning border border-warning/30">
                          PEAK LOAD
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${alert.status === 'firing' ? 'bg-destructive/20 text-destructive border-destructive/50' : alert.status === 'acknowledged' ? 'bg-warning/20 text-warning border-warning/50' : 'bg-success/20 text-success border-success/50'}`}>
                        {alert.status.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100 mb-1 truncate">
                      {alert.title}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {alert.description}
                    </p>
                  </div>

                  {/* Actions & Timestamps */}
                  <div className="shrink-0 flex flex-col items-end gap-3 w-full md:w-auto">
                    <div className="flex items-center text-xs text-slate-500 font-mono">
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                      {formatDistanceToNow(new Date(alert.firedAt), { addSuffix: true })}
                    </div>
                    
                    {alert.status === 'firing' && (
                      <button
                        onClick={() => acknowledge({ id: alert.id })}
                        disabled={isAcking}
                        className="w-full md:w-auto px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-medium text-sm transition-all flex items-center justify-center disabled:opacity-50"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Acknowledge
                      </button>
                    )}
                    
                    {alert.status === 'acknowledged' && (
                      <div className="text-xs text-slate-500 bg-background/50 px-3 py-1.5 rounded-lg border border-white/5">
                        Ack'd by <span className="text-slate-300 font-medium">{alert.acknowledgedBy || 'System'}</span>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
