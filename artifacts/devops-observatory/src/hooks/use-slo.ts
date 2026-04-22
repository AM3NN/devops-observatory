import { useGetSlos } from "@devops-observatory/api-client-react";

export function useSloPoll() {
  return useGetSlos({
    query: {
      refetchInterval: 60000, // Poll every 60s
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}
