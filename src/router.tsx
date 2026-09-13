import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function isUnauthorized(error: unknown) {
  return error instanceof Error && /unauthorized/i.test(error.message);
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    // Sessão expirada: em vez de tela branca, volta para o login.
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthorized(error) && typeof window !== "undefined") {
          window.location.replace("/auth");
        }
      },
    }),
    defaultOptions: {
      queries: {
        retry: (count, error) => !isUnauthorized(error) && count < 3,
        // Mantém as telas atualizadas sem precisar recarregar a página.
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
