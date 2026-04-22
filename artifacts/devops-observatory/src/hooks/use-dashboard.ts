import {
  useGetDashboardSummary,
  useGetTrafficData,
} from "@devops-observatory/api-client-react";

export function useDashboardPoll() {
  return useGetDashboardSummary({
    query: {
      refetchInterval: 10000, // Poll every 10s
    },
  });
}

export function useTrafficPoll() {
  return useGetTrafficData({
    query: {
      refetchInterval: 10000,
    },
  });
}
