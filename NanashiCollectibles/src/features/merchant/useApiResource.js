import { useCallback, useEffect, useState } from "react";

// Shared loading/error/data bookkeeping for a REST call, mirroring the
// loading|success|error status shape features/tournament/useTournaments.js already
// established for the Socket.IO equivalent. `fetcher` is called with no arguments and
// re-runs whenever anything in `deps` changes (pass the values the fetch actually
// depends on — token, page, filters, etc.) or when `refresh()` is called manually.
export function useApiResource(fetcher, deps, { enabled = true } = {}) {
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(() => {
    if (!enabled) return undefined;
    setStatus("loading");
    setError(null);
    return fetcher()
      .then((res) => {
        setData(res);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
    // fetcher intentionally excluded — callers pass a fresh closure each render;
    // `deps` below lists the actual values that should trigger a re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadToken, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return { status, data, error, refresh };
}
