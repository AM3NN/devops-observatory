import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  FileTerminal,
  Gauge,
  LayoutDashboard,
  Server,
  Target,
  Menu,
  BellRing,
  Plug,
} from "lucide-react";
import { useDashboardPoll } from "@/hooks/use-dashboard";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: summary } = useDashboardPoll();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/logs", label: "Logs (ELK)", icon: FileTerminal },
    { href: "/apm", label: "APM & Traces", icon: Activity },
    {
      href: "/alerts",
      label: "Alerts",
      icon: AlertTriangle,
      badge: summary?.activeAlerts,
    },
    { href: "/slo", label: "SLOs", icon: Target, badge: summary?.slosAtRisk },
    { href: "/services", label: "Services", icon: Server },
    { href: "/agents", label: "Agents", icon: Plug },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background tech-grid text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card/80 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Gauge className="w-6 h-6 text-primary mr-3" />
          <h1 className="text-xl font-display font-bold tracking-wider text-slate-100 uppercase text-shadow-sm">
            Observatory
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute inset-0 border border-primary/20 rounded-xl bg-gradient-to-r from-primary/10 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "w-5 h-5 mr-3 relative z-10",
                    isActive
                      ? "text-primary"
                      : "text-slate-500 group-hover:text-slate-300",
                  )}
                />
                <span className="font-medium text-sm relative z-10">
                  {item.label}
                </span>
                {item.badge ? (
                  <span
                    className={cn(
                      "ml-auto text-xs font-bold px-2 py-0.5 rounded-full relative z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-destructive text-destructive-foreground",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-background/50 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-slate-500 font-mono mb-1">
              SYSTEM STATUS
            </p>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse mr-2 shadow-[0_0_8px_rgba(74,222,128,0.6)]"></div>
              <span className="text-sm font-medium text-slate-300">
                All Systems Nominal
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-card/50 backdrop-blur-md z-40">
          <div className="flex items-center">
            <button
              className="p-2 -ml-2 mr-2 text-slate-400 hover:text-slate-200 lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {summary?.isPeakLoadPeriod && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning"
              >
                <BellRing className="w-4 h-4 mr-2 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Peak Load ({summary.peakLoadLevel})
                </span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-mono text-slate-300">
                {currentTime.toLocaleTimeString("en-US", { hour12: false })}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {currentTime.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-indigo-600 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="font-bold text-white text-sm">JS</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
