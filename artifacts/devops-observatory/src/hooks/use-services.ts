import { useGetServices } from "@workspace/api-client-react";

export function useServicesPoll() {
  return useGetServices({
    query: {
      refetchInterval: 30000, // Poll every 30s
    },
  });
}
