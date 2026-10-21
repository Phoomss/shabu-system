"use client";
import { useAuthStore } from "@/stores/authStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30 * 1000 },
        },
      }),
  );

  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (state.revision !== previous.revision) queryClient.clear();
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
