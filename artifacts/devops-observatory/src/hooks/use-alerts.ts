import {
  useGetAlerts,
  useAcknowledgeAlert,
  getGetAlertsQueryKey,
  type GetAlertsParams,
} from "@devops-observatory/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useAlertsPoll(params?: GetAlertsParams) {
  return useGetAlerts(params, {
    query: {
      refetchInterval: 30000, // Poll every 30s
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}

export function useAckAlert() {
  const queryClient = useQueryClient();
  return useAcknowledgeAlert({
    mutation: {
      onSuccess: () => {
        // Invalidate all alert queries
        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      },
    },
  });
}
