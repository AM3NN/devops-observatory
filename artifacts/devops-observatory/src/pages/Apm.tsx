import { useState } from "react";
import { useApmPoll, useTracesPoll } from "@/hooks/use-apm";
import { useServicesPoll } from "@/hooks/use-services";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Network, Cpu, Database, Zap } from "lucide-react";

export default function Apm() {
  const [selectedService, setSelectedService] = useState<string>("all");
  
  const { data: services } = useServicesPoll();
  const { data: metrics, isLoading: loadingMetrics } = useApmPoll(
    selectedService !== "all" ? { service: selectedService } : undefined
  );
  const { data: traces, isLoading: loadingTraces } = useTracesPoll(
    selectedService !== "all" ? { service: selectedService, limit: 10 } : { limit: 10 }
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <Zap className="w-6 h-6 mr-2 text-primary" />
            Application Performance
          </h2>
          <p className="text-sm text-slate-400">Real-time metrics and distributed tracing</p>
        </div>
        <div>
          <select 
            className="bg-card border border-white/10 rounded-xl py-2 px-4 text-sm text-slate-200 focus:outline-none focus:border-primary shadow-lg"
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
          >
            <option value="all">All Services</option>
            {services?.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Latency Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Response Time (ms)</h3>
              <p className="text-xs text-slate-500 font-mono">P99 & Average Latency</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            {loadingMetrics ? (
              <div className="w-full h-full flex items-center justify-center text-slate-500">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics || []} margin={{ left: -20, right: 10, bottom: 0, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="timestamp" tickFormatter={(v) => format(new Date(v), 'HH:mm')} stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'rgba(255,255,255,0.1)' }} labelFormatter={(v) => format(new Date(v), 'HH:mm:ss')} />
                  <Line type="monotone" dataKey="responseTime" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Resource Usage Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-info/10 rounded-lg mr-3">
              <Cpu className="w-5 h-5 text-info" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Resource Utilization</h3>
              <p className="text-xs text-slate-500 font-mono">CPU % and Memory (MB)</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            {loadingMetrics ? (
              <div className="w-full h-full flex items-center justify-center text-slate-500">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics || []} margin={{ left: -20, right: 10, bottom: 0, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="timestamp" tickFormatter={(v) => format(new Date(v), 'HH:mm')} stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'rgba(255,255,255,0.1)' }} labelFormatter={(v) => format(new Date(v), 'HH:mm:ss')} />
                  <Line yAxisId="left" type="monotone" dataKey="cpuUsage" name="CPU %" stroke="hsl(var(--info))" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="memoryUsage" name="Memory" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

      </div>

      {/* Traces Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-bold text-slate-100 flex items-center">
            <Database className="w-5 h-5 mr-2 text-slate-400" />
            Slowest Distributed Traces
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-background/50">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-400">Timestamp</th>
                <th className="px-6 py-3 font-semibold text-slate-400">Trace ID</th>
                <th className="px-6 py-3 font-semibold text-slate-400">Service</th>
                <th className="px-6 py-3 font-semibold text-slate-400">Operation</th>
                <th className="px-6 py-3 font-semibold text-slate-400 text-right">Duration (ms)</th>
                <th className="px-6 py-3 font-semibold text-slate-400 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingTraces ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading traces...</td></tr>
              ) : traces?.map((trace) => (
                <tr key={trace.traceId} className="hover:bg-white/[0.02] transition-colors font-mono">
                  <td className="px-6 py-3 text-slate-400 text-xs">
                    {format(new Date(trace.timestamp), "HH:mm:ss.SSS")}
                  </td>
                  <td className="px-6 py-3 text-primary text-xs cursor-pointer hover:underline">
                    {trace.traceId.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-3 text-slate-300 text-xs">
                    {trace.service}
                  </td>
                  <td className="px-6 py-3 text-slate-300 text-xs">
                    <span className="bg-white/5 px-2 py-1 rounded">{trace.operation}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end">
                      <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden mr-3">
                        <div 
                          className={`h-full ${trace.duration > 1000 ? 'bg-destructive' : trace.duration > 500 ? 'bg-warning' : 'bg-primary'}`} 
                          style={{ width: `${Math.min(100, (trace.duration / 2000) * 100)}%` }}
                        />
                      </div>
                      <span className={trace.duration > 1000 ? 'text-destructive font-bold' : 'text-slate-300'}>
                        {trace.duration}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className={`inline-block w-2 h-2 rounded-full ${trace.status === 'ok' ? 'bg-success' : trace.status === 'timeout' ? 'bg-warning' : 'bg-destructive shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse'}`} />
                  </td>
                </tr>
              ))}
              {!loadingTraces && traces?.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No traces available for this selection</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
