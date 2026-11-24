import type { QueryClient } from "@tanstack/react-query";

// Task dates drive both task lists and the ordering/badges of pipeline cards.
export function refreshTaskViews(queryClient: QueryClient): Promise<void> {
  return Promise.all(
    ["crm-tasks", "pipeline", "dashboard-backlog", "crm-notes"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  ).then(() => undefined);
}