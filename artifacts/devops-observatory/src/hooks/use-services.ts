import { useGetServices } from "@devops-observatory/api-client-react";

export function useServicesPoll() {
  return useGetServices({
    query: {
      refetchInterval: 30000, // Poll every 30s
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}
