import {
  useGetDashboardSummary,
  useGetTrafficData,
  getGetDashboardSummaryQueryKey,
  getGetTrafficDataQueryKey,
} from "@devops-observatory/api-client-react";

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
