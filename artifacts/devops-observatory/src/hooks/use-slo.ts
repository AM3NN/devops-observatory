import { useGetSlos, getGetSlosQueryKey } from "@devops-observatory/api-client-react";

export function useSloPoll() {
  return useGetSlos({
    query: {
      queryKey: getGetSlosQueryKey(),
      refetchInterval: 60000, // Poll every 60s
      select: (data) => (Array.isArray(data) ? data : []),
    },
  });
}
