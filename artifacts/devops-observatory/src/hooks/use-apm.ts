import { useGetApmMetrics, useGetTraces, type GetApmMetricsParams, type GetTracesParams } from "@workspace/api-client-react";

export function useApmPoll(params?: GetApmMetricsParams) {
  return useGetApmMetrics(params, {
    query: {
      refetchInterval: 15000,
      keepPreviousData: true,
    },
  });
}

export function useTracesPoll(params?: GetTracesParams) {
  return useGetTraces(params, {
    query: {
      refetchInterval: 15000,
      keepPreviousData: true,
    },
  });
}
