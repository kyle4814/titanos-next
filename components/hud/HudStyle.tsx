export default function HudStyle() {
  return (
    <style>{`
.hud-wrap{width:min(100% - 2*var(--pe-gutter),var(--pe-wrap));margin:0 auto;padding:var(--pe-section-y) 0 0;display:grid;gap:16px;grid-template-columns:1fr;position:relative;z-index:2}
.hud-panel{position:relative;background:var(--pe-card);border:1px solid var(--pe-line);border-top-color:var(--pe-line-gold);border-radius:var(--pe-r-card);padding:clamp(20px,2.4vw,32px);box-shadow:var(--pe-shadow-card);overflow:hidden;min-width:0}
.hud-label{font:600 12px/1.3 var(--font-body),system-ui,sans-serif;letter-spacing:var(--pe-track-eyebrow);text-transform:uppercase;color:var(--pe-gold);margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.hud-tag{font:600 11px/1 var(--font-body),system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;border:1px solid var(--pe-line-gold);color:var(--pe-gold-hi);border-radius:var(--pe-r-pill);padding:5px 10px}
.hud-tag-ok{border-color:rgba(120,200,150,.4);color:var(--pe-ok)}
.hud-hero{border-color:var(--pe-line-gold)}
.hud-bigrow{display:grid;gap:24px;grid-template-columns:1fr}
.hud-big{font-family:var(--font-body),system-ui,sans-serif;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;font-size:clamp(2.2rem,9vw,3.8rem);line-height:1.05;color:#fff;overflow-wrap:anywhere}
.hud-big-gold{color:var(--pe-gold-hi)}
.hud-unit{color:var(--pe-mute);font-size:var(--pe-fs-sm);margin-top:6px}
.hud-note{color:var(--pe-mute);font-size:var(--pe-fs-sm);line-height:1.65;margin:14px 0 0}
.hud-link{color:var(--pe-gold-hi);text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
.hud-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.hud-tile{border:1px solid var(--pe-line);background:var(--pe-card2);border-radius:var(--pe-r-md);padding:16px;display:flex;flex-direction:column;gap:6px}
.hud-tile-k{font:600 11px/1.3 var(--font-body),system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--pe-faint)}
.hud-tile-v{font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;font-size:clamp(1.25rem,5vw,1.7rem);color:var(--pe-gold-hi)}
.hud-tile-s{font-size:var(--pe-fs-sm);color:var(--pe-mute);line-height:1.45;flex:1}
.hud-tile .hud-tag{align-self:flex-start;margin-top:8px}
.hud-feed{list-style:none;margin:0;padding:0;max-height:440px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--pe-line-strong) transparent;font-family:var(--font-mono),ui-monospace,monospace}
.hud-feed:focus-visible{outline:2px solid var(--pe-gold);outline-offset:2px}
.hud-feed-row{display:grid;grid-template-columns:auto auto auto 1fr auto;gap:8px 12px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--pe-line);font-size:.78rem;opacity:0;animation:hud-in .5s ease forwards}
.hud-feed-time{color:var(--pe-faint)}
.hud-feed-acct{border:1px solid var(--pe-line-gold);color:var(--pe-gold-hi);border-radius:var(--pe-r-sm);padding:1px 6px}
.hud-feed-acct-b{border-color:var(--pe-line-strong);color:var(--pe-mute)}
.hud-feed-cat{color:var(--pe-mute);letter-spacing:.08em}
.hud-feed-code{color:var(--pe-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.hud-feed-ok{color:var(--pe-ok);letter-spacing:.1em;font-size:.68rem}
.hud-stamp{color:var(--pe-faint);font-size:var(--pe-fs-xs);text-align:center;line-height:1.7;width:min(100% - 2*var(--pe-gutter),860px);margin:0 auto;padding:var(--pe-sp-6) 0 var(--pe-sp-8)}
@keyframes hud-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@media (max-width:460px){.hud-feed-row{grid-template-columns:auto auto 1fr auto}.hud-feed-cat{display:none}}
@media (min-width:900px){
 .hud-wrap{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
 .hud-hero,.hud-wide{grid-column:1/-1}
 .hud-bigrow{grid-template-columns:1fr 1.3fr}
 .hud-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}
 .hud-feed{max-height:520px}
}
@media (prefers-reduced-motion:reduce){.hud-feed-row{animation:none;opacity:1}}
`}</style>
  );
}
