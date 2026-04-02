import {
  useGetLogs,
  useIngestLog,
  type GetLogsParams,
} from "@devops-observatory/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useLogsPoll(params?: GetLogsParams) {
  return useGetLogs(params, {
    query: {
      refetchInterval: 15000, // Poll every 15s
      keepPreviousData: true,
      select: (data) => {
        if (data == null || typeof data !== "object") {
          return { logs: [], total: 0 };
        }

        const candidate = data as Record<string, unknown>;

        return {
          logs: Array.isArray(candidate.logs) ? candidate.logs : [],
          total: typeof candidate.total === "number" ? candidate.total : 0,
        };
      },
    },
  });
}

export function useIngestNewLog() {
  const queryClient = useQueryClient();
  return useIngestLog({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      },
    },
  });
}
