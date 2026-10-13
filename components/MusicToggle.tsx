"use client";

// Fixed-corner ambient music toggle. Off by default, never autoplays: sound
// starts only from a tap/click on this button. A stored "on" choice only shows
// the button ready; it never starts sound without a gesture.
// Playback is Web Audio (AudioBufferSourceNode, loop=true with loopStart/loopEnd)
// so the loop is sample-accurate; the 627 KB MP3 is fetched on the first tap
// only. If Web Audio is missing or the decode fails, the <audio loop> element
// plays instead (preload="none").
// Gapless offsets (measured from the LAME/Info header, ffprobe, 48 kHz):
// encoder delay 576 + decoder delay 529 + 1 = 1105 samples (23.021 ms) of
// priming at the start; 1620 - 528 - 1 = 1091 samples of padding at the end;
// true loop = 1,501,164 samples = 31.27425 s. Browsers that honour the header
// return the trimmed buffer (31.274 s), others the raw one (31.320 s): the
// buffer length decides which, so both loop cleanly.
// The choice is kept in localStorage under titanos.music ("on" / "off").
// Sits bottom-left so it never covers the sticky mobile CTA (bottom bar).

import { useEffect, useRef, useState } from "react";

const KEY = "titanos.music";
const SRC = "/audio/underworld-loop.mp3";
const VOLUME = 0.35;
const FADE_S = 0.3;
const SRC_RATE = 48000;
const PRIMING_S = 1105 / SRC_RATE; // 0.0230208 s
const LOOP_S = 1501164 / SRC_RATE; // 31.27425 s

type Ctx = AudioContext;
type WebAudio = {
  ctx: Ctx;
  gain: GainNode;
  buffer: AudioBuffer | null;
  loading: Promise<AudioBuffer> | null;
  source: AudioBufferSourceNode | null;
};

function loopPoints(buffer: AudioBuffer): [number, number] {
  // untrimmed decode is about PRIMING_S + LOOP_S + padding; trimmed is LOOP_S
  const untrimmed = buffer.duration > LOOP_S + 0.01;
  const start = untrimmed ? PRIMING_S : 0;
  const end = untrimmed ? PRIMING_S + LOOP_S : buffer.duration;
  return [start, Math.min(end, buffer.duration)];
}

export default function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waRef = useRef<WebAudio | null>(null);
  const modeRef = useRef<"wa" | "el">("wa");
  const stopTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setReady(window.localStorage.getItem(KEY) === "on");
    } catch {
      /* storage blocked: stay off */
    }
    return () => {
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      const wa = waRef.current;
      if (wa) {
        try {
          wa.source?.stop();
        } catch {
          /* ignore */
        }
        wa.ctx.close().catch(() => undefined);
        waRef.current = null;
      }
    };
  }, []);

  const remember = (v: "on" | "off") => {
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };

  const getWebAudio = (): WebAudio | null => {
    if (waRef.current) return waRef.current;
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext || w.webkitAudioContext;
    if (!Ctor || typeof fetch !== "function") return null;
    try {
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      waRef.current = { ctx, gain, buffer: null, loading: null, source: null };
      return waRef.current;
    } catch {
      return null;
    }
  };

  const startElement = () => {
    const a = audioRef.current;
    if (!a) return Promise.reject(new Error("no audio"));
    modeRef.current = "el";
    a.volume = VOLUME;
    return a.play().then(() => setPlaying(true));
  };

  const startWebAudio = (wa: WebAudio) => {
    // resume() inside the gesture is the iOS requirement; do not await it first
    const resumed = wa.ctx.resume();
    if (!wa.loading) {
      wa.loading = fetch(SRC)
        .then((r) => {
          if (!r.ok) throw new Error("fetch " + r.status);
          return r.arrayBuffer();
        })
        .then(
          (data) =>
            new Promise<AudioBuffer>((ok, bad) => {
              // callback form: older Safari has no promise decodeAudioData
              wa.ctx.decodeAudioData(data, ok, bad);
            }),
        );
      wa.loading.catch(() => {
        wa.loading = null;
      });
    }
    return Promise.all([resumed, wa.loading]).then(([, buffer]) => {
      wa.buffer = buffer;
      if (wa.source) return;
      const src = wa.ctx.createBufferSource();
      const [ls, le] = loopPoints(buffer);
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = ls;
      src.loopEnd = le;
      src.connect(wa.gain);
      src.start(0, ls);
      wa.source = src;
      const t = wa.ctx.currentTime;
      wa.gain.gain.cancelScheduledValues(t);
      wa.gain.gain.setValueAtTime(wa.gain.gain.value, t);
      wa.gain.gain.linearRampToValueAtTime(VOLUME, t + FADE_S);
      modeRef.current = "wa";
      setPlaying(true);
    });
  };

  const stop = () => {
    setPlaying(false);
    if (modeRef.current === "el") {
      audioRef.current?.pause();
      return;
    }
    const wa = waRef.current;
    if (!wa) return;
    const t = wa.ctx.currentTime;
    wa.gain.gain.cancelScheduledValues(t);
    wa.gain.gain.setValueAtTime(wa.gain.gain.value, t);
    wa.gain.gain.linearRampToValueAtTime(0, t + FADE_S);
    const src = wa.source;
    wa.source = null;
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(() => {
      try {
        src?.stop();
      } catch {
        /* ignore */
      }
      if (!wa.source) wa.ctx.suspend().catch(() => undefined);
    }, FADE_S * 1000 + 50);
  };

  const toggle = () => {
    if (playing) {
      stop();
      remember("off");
      setReady(false);
      return;
    }
    if (stopTimer.current) {
      window.clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    const wa = modeRef.current === "wa" ? getWebAudio() : null;
    const run = wa
      ? startWebAudio(wa).catch(() => {
          // fetch/decode/resume failed: fall back to the media element
          return startElement();
        })
      : startElement();
    run
      .then(() => {
        remember("on");
        setReady(false);
      })
      .catch(() => setPlaying(false));
  };

  return (
    <div className="music-toggle">
      <audio ref={audioRef} src={SRC} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        data-ready={ready && !playing ? "true" : undefined}
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
        .music-toggle button[data-ready="true"] {
          border-color: var(--gold);
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
