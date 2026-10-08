"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { emptyState, importPairing, type TixState } from "@/lib/tix";

const KEY = "tix-demo-v1";

// DEMO MODE store: one JSON blob in localStorage. Keys live in the browser by design.
export function useTix() {
  const ref = useRef<TixState | null>(null);
  const [, bump] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let st: TixState | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) st = JSON.parse(raw);
    } catch {}
    if (!st || !st.key) st = emptyState();
    const m = /[#&]p=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (m && importPairing(st, m[1])) history.replaceState(null, "", location.pathname);
    ref.current = st;
    localStorage.setItem(KEY, JSON.stringify(st));
    setReady(true);
  }, []);

  const commit = useCallback(() => {
    if (ref.current) localStorage.setItem(KEY, JSON.stringify(ref.current));
    bump((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    ref.current = emptyState();
    commit();
  }, [commit]);

  return { st: ref.current, ready, commit, reset };
}
