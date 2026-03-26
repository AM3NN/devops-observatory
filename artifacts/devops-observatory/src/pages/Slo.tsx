import { useSloPoll } from "@/hooks/use-slo";
import { Target, TrendingDown, Users, ShieldCheck, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Slo() {
  const { data: slos, isLoading } = useSloPoll();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center">
          <Target className="w-6 h-6 mr-2 text-primary" />
          Service Level Objectives
        </h2>
        <p className="text-sm text-slate-400">Track and enforce the chain of responsibility</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slos?.map((slo, i) => (
          <motion.div
            key={slo.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`glass-panel p-6 rounded-2xl relative overflow-hidden ${
              slo.status === 'breached' ? 'border-destructive/30 shadow-[0_0_15px_rgba(248,113,113,0.1)]' : 
              slo.status === 'at_risk' ? 'border-warning/30' : ''
            }`}
          >
            {/* Background Glow */}
            <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-10 ${
              slo.status === 'breached' ? 'bg-destructive' : slo.status === 'at_risk' ? 'bg-warning' : 'bg-success'
            }`} />

            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-slate-500 font-mono uppercase tracking-wider">{slo.service}</span>
                <h3 className="text-lg font-bold text-slate-100 leading-tight mt-1">{slo.name}</h3>
              </div>
              <div className={`p-2 rounded-xl border ${
                slo.status === 'breached' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                slo.status === 'at_risk' ? 'bg-warning/10 text-warning border-warning/20' : 
                'bg-success/10 text-success border-success/20'
              }`}>
                {slo.status === 'met' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-6 min-h-[40px] line-clamp-2">
              {slo.description}
            </p>

            <div className="space-y-5">
              {/* Target vs Current */}
              <div className="flex items-end justify-between border-b border-white/5 pb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Current SLI</p>
                  <p className={`text-2xl font-mono font-bold ${slo.current < slo.target ? 'text-warning' : 'text-slate-200'}`}>
                    {slo.current}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-1">Target</p>
                  <p className="text-lg font-mono text-slate-300">
                    {slo.target}%
                  </p>
                </div>
              </div>

              {/* Error Budget */}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">Error Budget Remaining</span>
                  <span className={`font-mono font-bold ${slo.errorBudgetConsumed > 90 ? 'text-destructive' : 'text-slate-300'}`}>
                    {100 - slo.errorBudgetConsumed}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${slo.errorBudgetConsumed > 90 ? 'bg-destructive' : slo.errorBudgetConsumed > 75 ? 'bg-warning' : 'bg-primary'}`}
                    style={{ width: `${slo.errorBudgetConsumed}%` }}
                  />
                </div>
              </div>

              {/* Burn Rate & Team */}
              <div className="flex justify-between items-center bg-background/50 rounded-lg p-3 border border-white/5 mt-4">
                <div className="flex items-center text-sm text-slate-300">
                  <TrendingDown className={`w-4 h-4 mr-2 ${slo.burnRate > 1 ? 'text-destructive' : 'text-slate-500'}`} />
                  <span className="font-mono">{slo.burnRate}x <span className="text-xs text-slate-500 font-sans">burn rate</span></span>
                </div>
                <div className="flex items-center text-sm text-slate-300">
                  <Users className="w-4 h-4 mr-2 text-slate-500" />
                  <span>{slo.responsible}</span>
                </div>
              </div>

            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
