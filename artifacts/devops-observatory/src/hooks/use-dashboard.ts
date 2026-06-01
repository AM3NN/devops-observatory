import {
  useGetDashboardSummary,
  useGetTrafficData,
  getGetDashboardSummaryQueryKey,
  getGetTrafficDataQueryKey,
} from "@devops-observatory/api-client-react";
import { useQuery } from "@tanstack/react-query";

export type IncidentPrediction = {
  service: string;
  serviceName: string;
  score: number;
  level: "low" | "medium" | "high";
  horizonMinutes: number;
  confidence: number;
  reasons: string[];
  signals: {
    latencyTrendPct: number;
    errorRateTrendPct: number;
    cpuUsage: number;
    memoryUsage: number;
    sloBurnRate: number;
    recentErrorLogs: number;
  };
  generatedAt: string;
};

export type IncidentPredictionHistoryPoint = {
  service: string;
  serviceName: string;
  score: number;
  level: "low" | "medium" | "high";
  generatedAt: string;
};

export function useDashboardPoll() {
  return useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      refetchInterval: 10000, // Poll every 10s
    },
  });
}

export function useTrafficPoll() {
  return useGetTrafficData({
    query: {
      queryKey: getGetTrafficDataQueryKey(),
      refetchInterval: 10000,
    },
  });
}

export function useIncidentPredictionsPoll() {
  return useQuery({
    queryKey: ["/api/predictions/incidents"],
    queryFn: async ({ signal }) => {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
      const response = await fetch(`${apiBaseUrl}/api/predictions/incidents`, {
        signal,
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Prediction request failed with ${response.status}`);
      }

      return (await response.json()) as IncidentPrediction[];
    },
    refetchInterval: 30000,
  });
}

export function useIncidentPredictionHistoryPoll() {
  return useQuery({
    queryKey: ["/api/predictions/incidents/history"],
    queryFn: async ({ signal }) => {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
      const response = await fetch(
        `${apiBaseUrl}/api/predictions/incidents/history?limit=120`,
        {
          signal,
          method: "GET",
        },
      );

      if (!response.ok) {
        throw new Error(
          `Prediction history request failed with ${response.status}`,
        );
      }

      return (await response.json()) as IncidentPredictionHistoryPoint[];
    },
    refetchInterval: 30000,
  });
}
