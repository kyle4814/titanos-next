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
    // A pairing link (#p=...) works on load and also when pasted into an already-open scanner tab (hashchange).
    const pairFromHash = (cur: TixState): boolean => {
      const m = /[#&]p=([A-Za-z0-9_-]+)/.exec(location.hash);
      if (!m || !importPairing(cur, m[1])) return false;
      history.replaceState(null, "", location.pathname);
      return true;
    };
    pairFromHash(st);
    ref.current = st;
    localStorage.setItem(KEY, JSON.stringify(st));
    setReady(true);
    const onHash = () => {
      if (ref.current && pairFromHash(ref.current)) {
        localStorage.setItem(KEY, JSON.stringify(ref.current));
        bump((n) => n + 1);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
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
