import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { refreshTaskViews } from "./crm-refresh";

describe("refreshTaskViews", () => {
  it("refetches active task lists, pipeline next dates, counters and history after a saved change", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const keys = [
      ["crm-tasks", "opp", "card-1"],
      ["crm-tasks", "pending"],
      ["pipeline", "funnel-1", "open"],
      ["dashboard-backlog", "school-1"],
      ["crm-notes", "card-1"],
    ];
    let dueDate = "2026-11-24";
    const observers = keys.map((queryKey) => new QueryObserver(client, {
      queryKey,
      queryFn: async () => dueDate,
    }));
    const unsubscribe = observers.map((observer) => observer.subscribe(() => {}));
    await Promise.all(observers.map((observer) => observer.refetch()));
    dueDate = "2026-11-25";
    await refreshTaskViews(client);
    for (const key of keys) expect(client.getQueryData(key)).toBe("2026-11-25");
    unsubscribe.forEach((stop) => stop());
    client.clear();
  });

  it("marks inactive funnels stale without refetching unrelated user data", async () => {
    const client = new QueryClient();
    client.setQueryData(["pipeline", "other-funnel", "open"], []);
    client.setQueryData(["users"], []);
    await refreshTaskViews(client);
    expect(client.getQueryState(["pipeline", "other-funnel", "open"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["users"])?.isInvalidated).toBe(false);
    client.clear();
  });
});