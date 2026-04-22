import {
  useGetApmMetrics,
  useGetTraces,
  type GetApmMetricsParams,
  type GetTracesParams,
} from "@devops-observatory/api-client-react";

export function useApmPoll(params?: GetApmMetricsParams) {
  return useGetApmMetrics(params, {
    query: {
      refetchInterval: 15000,
      keepPreviousData: true,
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}

export function useTracesPoll(params?: GetTracesParams) {
  return useGetTraces(params, {
    query: {
      refetchInterval: 15000,
      keepPreviousData: true,
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}
