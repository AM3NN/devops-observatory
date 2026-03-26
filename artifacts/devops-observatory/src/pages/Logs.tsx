import { useState } from "react";
import { useLogsPoll } from "@/hooks/use-logs";
import { Search, Filter, Terminal, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import type { GetLogsLevel } from "@workspace/api-client-react";

const getLevelColor = (level: string) => {
  switch (level) {
    case "DEBUG": return "bg-slate-800 text-slate-300 border-slate-700";
    case "INFO": return "bg-info/10 text-info border-info/20";
    case "WARN": return "bg-warning/10 text-warning border-warning/20";
    case "ERROR": return "bg-destructive/10 text-destructive border-destructive/20";
    case "FATAL": return "bg-purple-900/30 text-purple-400 border-purple-500/30";
    default: return "bg-slate-800 text-slate-300 border-slate-700";
  }
};

export default function Logs() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<GetLogsLevel | "ALL">("ALL");
  const [service, setService] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = useLogsPoll({
    search: search || undefined,
    level: level !== "ALL" ? level : undefined,
    service: service || undefined,
    limit,
    offset: page * limit
  });

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <Terminal className="w-6 h-6 mr-2 text-primary" />
            Centralized Logs
          </h2>
          <p className="text-sm text-slate-400">Search and filter application logs in real-time</p>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-t-2xl flex flex-col sm:flex-row gap-4 shrink-0 border-b-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search logs by message or traceId..."
            className="w-full bg-background border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex gap-4">
          <select 
            className="bg-background border border-white/10 rounded-xl py-2 px-4 text-sm text-slate-200 focus:outline-none focus:border-primary cursor-pointer appearance-none"
            value={level}
            onChange={(e) => { setLevel(e.target.value as any); setPage(0); }}
          >
            <option value="ALL">All Levels</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="FATAL">FATAL</option>
          </select>
          <input 
            type="text"
            placeholder="Filter by Service"
            className="w-40 bg-background border border-white/10 rounded-xl py-2 px-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
            value={service}
            onChange={(e) => { setService(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      <div className="glass-panel flex-1 rounded-b-2xl rounded-t-none overflow-hidden flex flex-col min-h-0 border-t border-white/5 relative">
        {isLoading && !data ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : null}
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 bg-card z-10 shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-b border-white/10">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-400 w-48">Timestamp</th>
                <th className="px-6 py-3 font-semibold text-slate-400 w-24">Level</th>
                <th className="px-6 py-3 font-semibold text-slate-400 w-40">Service</th>
                <th className="px-6 py-3 font-semibold text-slate-400">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.logs?.length ? data.logs.map((log, i) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  key={log.id} 
                  className="hover:bg-white/[0.02] transition-colors font-mono cursor-pointer"
                >
                  <td className="px-6 py-2 text-slate-400 whitespace-nowrap text-xs">
                    {format(new Date(log.timestamp), "MMM dd, HH:mm:ss.SSS")}
                  </td>
                  <td className="px-6 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getLevelColor(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-slate-300 text-xs truncate max-w-[160px]">
                    {log.service}
                  </td>
                  <td className="px-6 py-2 text-slate-300 text-xs">
                    <span className={log.level === 'ERROR' || log.level === 'FATAL' ? 'text-destructive font-semibold' : ''}>
                      {log.message}
                    </span>
                    {log.traceId && (
                      <span className="ml-3 text-[10px] text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {log.traceId}
                      </span>
                    )}
                  </td>
                </motion.tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Filter className="w-10 h-10 mb-3 opacity-20" />
                      <p>No logs found matching criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-white/5 bg-card/80 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400">
            Showing {data?.logs?.length || 0} of {data?.total || 0} logs
          </p>
          <div className="flex items-center space-x-2">
            <button 
              className="p-1.5 rounded-lg bg-background border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-2 text-slate-400">Page {page + 1}</span>
            <button 
              className="p-1.5 rounded-lg bg-background border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              onClick={() => setPage(p => p + 1)}
              disabled={!data?.total || (page + 1) * limit >= data.total}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
