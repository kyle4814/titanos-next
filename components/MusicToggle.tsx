"use client";

// Fixed-corner ambient music toggle. Off by default, never autoplays: audio
// starts only from a tap/click (or, when the visitor chose "on" earlier, from
// their first gesture on a later page, because browsers block a bare play()).
// preload="none" keeps the 600 KB loop out of page load until it is played.
// The choice is kept in localStorage under titanos.music ("on" / "off").
// Sits bottom-left so it never covers the sticky mobile CTA (bottom bar).

import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "titanos.music";
const POS_KEY = "titanos.music.pos";
const VOLUME = 0.35;

export default function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const start = useCallback(() => {
    const a = audioRef.current;
    if (!a) return Promise.reject(new Error("no audio"));
    a.volume = VOLUME;
    return a.play().then(() => setPlaying(true));
  }, []);

  useEffect(() => {
    let want = false;
    try {
      want = window.localStorage.getItem(KEY) === "on";
    } catch {
      /* storage blocked: stay off */
    }
    const a = audioRef.current;
    if (!want || !a) return;
    try {
      const pos = parseFloat(window.sessionStorage.getItem(POS_KEY) || "0");
      if (pos > 0) a.currentTime = pos;
    } catch {
      /* ignore */
    }
    let cancelled = false;
    const onGesture = () => {
      cleanup();
      if (!cancelled) start().catch(() => setPlaying(false));
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    start().catch(() => {
      // autoplay blocked: resume on the visitor's first gesture
      window.addEventListener("pointerdown", onGesture, { once: true });
      window.addEventListener("keydown", onGesture, { once: true });
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [start]);

  useEffect(() => {
    const save = () => {
      const a = audioRef.current;
      if (!a || a.paused) return;
      try {
        window.sessionStorage.setItem(POS_KEY, String(a.currentTime));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      try {
        window.localStorage.setItem(KEY, "off");
      } catch {
        /* ignore */
      }
      return;
    }
    start()
      .then(() => {
        try {
          window.localStorage.setItem(KEY, "on");
        } catch {
          /* ignore */
        }
      })
      .catch(() => setPlaying(false));
  };

  return (
    <div className="music-toggle">
      <audio ref={audioRef} src="/audio/underworld-loop.mp3" loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Pause background music" : "Play background music"}
        title={playing ? "Pause music" : "Play music"}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
          {playing ? (
            <>
              <path d="M15.5 9a4 4 0 0 1 0 6" />
              <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
            </>
          ) : (
            <path d="M16 9.5l5 5M21 9.5l-5 5" />
          )}
        </svg>
      </button>
      <style>{`
        .music-toggle {
          position: fixed;
          left: 14px;
          bottom: 14px;
          z-index: 45;
        }
        .music-toggle button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          padding: 0;
          cursor: pointer;
          color: var(--gold);
          background: rgb(10 7 7 / 0.82);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--gold-dim);
          border-radius: 50%;
        }
        .music-toggle button[aria-pressed="true"] {
          border-color: var(--gold);
          box-shadow: 0 0 12px rgb(var(--gold-rgb) / 0.35);
        }
        @media (max-width: 720px) {
          .music-toggle { bottom: calc(76px + env(safe-area-inset-bottom)); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .music-toggle button { transition: transform 0.15s ease, box-shadow 0.2s ease; }
          .music-toggle button:active { transform: scale(0.94); }
        }
      `}</style>
    </div>
  );
}
