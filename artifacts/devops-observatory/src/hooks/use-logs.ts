import {
  useGetLogs,
  useIngestLog,
  getGetLogsQueryKey,
  type GetLogsParams,
} from "@devops-observatory/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useLogsPoll(params?: GetLogsParams) {
  return useGetLogs(params, {
    query: {
      queryKey: getGetLogsQueryKey(params),
      refetchInterval: 15000, // Poll every 15s
      select: (data) => {
        if (data == null || typeof data !== "object") {
          return { logs: [], total: 0, offset: 0, limit: 50 };
        }

        return {
          logs: Array.isArray(data.logs) ? data.logs : [],
          total: typeof data.total === "number" ? data.total : 0,
          offset: typeof data.offset === "number" ? data.offset : 0,
          limit: typeof data.limit === "number" ? data.limit : 50,
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
