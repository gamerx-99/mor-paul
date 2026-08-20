import { trpc } from "@/lib/trpc";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { markSessionExpired } from "./lib/sessionExpiry";

function clearForExpiredSession(error: unknown) {
  if (!(error instanceof TRPCClientError) || error.message !== UNAUTHED_ERR_MSG) return;
  markSessionExpired();
  queryClient.clear();
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: clearForExpiredSession }),
  mutationCache: new MutationCache({ onError: clearForExpiredSession }),
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
