import { useGetSlos } from "@workspace/api-client-react";

export function useSloPoll() {
  return useGetSlos({
    query: {
      refetchInterval: 60000, // Poll every 60s
    },
  });
}
