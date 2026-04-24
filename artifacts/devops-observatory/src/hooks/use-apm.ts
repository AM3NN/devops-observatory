import {
  useGetApmMetrics,
  useGetTraces,
  getGetApmMetricsQueryKey,
  getGetTracesQueryKey,
  type GetApmMetricsParams,
  type GetTracesParams,
} from "@devops-observatory/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";

export function useApmPoll(params?: GetApmMetricsParams) {
  return useGetApmMetrics(params, {
    query: {
      queryKey: getGetApmMetricsQueryKey(params),
      refetchInterval: 15000,
      placeholderData: keepPreviousData,
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}

export function useTracesPoll(params?: GetTracesParams) {
  return useGetTraces(params, {
    query: {
      queryKey: getGetTracesQueryKey(params),
      refetchInterval: 15000,
      placeholderData: keepPreviousData,
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}
