import { useGetLogs, useIngestLog, type GetLogsParams } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useLogsPoll(params?: GetLogsParams) {
  return useGetLogs(params, {
    query: {
      refetchInterval: 15000, // Poll every 15s
      keepPreviousData: true,
    },
  });
}

export function useIngestNewLog() {
  const queryClient = useQueryClient();
  return useIngestLog({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      }
    }
  });
}
