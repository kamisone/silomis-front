"use client";

import { useEffect } from "react";

/**
 * Global fetch interceptor: on a 401/403 from any /next-api call (except
 * auth itself), attempts one refresh-token rotation and retries. Concurrent
 * 401s during the same refresh are queued rather than each firing their own
 * rotation (which would race and revoke each other's tokens).
 */
export default function TokenRefresher() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let isRefreshing = false;
    let queue: Array<{ resolve: (r: Response | PromiseLike<Response>) => void; retry: () => Promise<Response> }> = [];

    function drainQueue(succeeded: boolean, fallback?: Response) {
      const pending = queue;
      queue = [];
      isRefreshing = false;
      if (succeeded) {
        pending.forEach(({ resolve, retry }) => resolve(retry()));
      } else {
        pending.forEach(({ resolve }) => resolve(fallback!));
      }
    }

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const url = input instanceof Request ? input.url : String(input);

      if (url.includes("/next-api/auth")) {
        return originalFetch(...args);
      }

      const res = await originalFetch(...args);
      if (res.status !== 401 && res.status !== 403) return res;

      if (isRefreshing) {
        return new Promise<Response>((resolve) => {
          queue.push({ resolve, retry: () => originalFetch(...args) });
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await originalFetch("/next-api/auth/refresh", { method: "POST" });

        if (refreshRes.ok) {
          drainQueue(true);
          return originalFetch(...args);
        }

        drainQueue(false, res);
        await originalFetch("/next-api/auth", { method: "DELETE" });
        window.location.replace("/login");
        return res;
      } catch {
        drainQueue(false, res);
        return res;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
