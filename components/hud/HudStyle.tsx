export default function HudStyle() {
  return (
    <style>{`
.hud-wrap{max-width:var(--maxw-full);margin:0 auto;padding:0 16px;display:grid;gap:16px;grid-template-columns:1fr;position:relative;z-index:2}
.hud-panel{position:relative;background:linear-gradient(180deg,rgba(26,19,16,.92),rgba(11,9,8,.92));border:1px solid rgba(212,175,55,.28);border-radius:var(--radius-md);padding:var(--pad-card);box-shadow:inset 0 0 40px rgba(212,175,55,.05),0 0 30px rgba(0,0,0,.5);overflow:hidden;min-width:0}
.hud-panel::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,240,190,.025) 0 1px,transparent 1px 4px);pointer-events:none}
.hud-panel::after{content:"";position:absolute;left:0;right:0;top:-40%;height:40%;background:linear-gradient(180deg,transparent,rgba(212,175,55,.07),transparent);animation:hud-scan 7s linear infinite;pointer-events:none}
.hud-label{font-size:var(--fs-xs);letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.hud-tag{font-size:.68rem;letter-spacing:.14em;border:1px solid var(--gold-dim);color:var(--gold-warm);border-radius:2px;padding:1px 6px}
.hud-tag-ok{border-color:#2e6b45;color:var(--ok)}
.hud-hero{border-color:rgba(212,175,55,.5)}
.hud-bigrow{display:grid;gap:18px;grid-template-columns:1fr}
.hud-big{font-family:var(--font-mono),ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:clamp(2.1rem,9vw,3.6rem);line-height:1.05;color:var(--gold-spec);text-shadow:0 0 18px rgba(212,175,55,.45);overflow-wrap:anywhere}
.hud-big-gold{color:var(--gold);}
.hud-unit{color:var(--dim);font-size:var(--fs-sm);margin-top:4px}
.hud-note{color:var(--dim);font-size:var(--fs-sm);line-height:1.65;margin:14px 0 0}
.hud-link{color:var(--gold-warm);text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
.hud-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.hud-tile{border:1px solid rgba(212,175,55,.18);background:rgba(5,3,3,.55);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:4px}
.hud-tile-k{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.hud-tile-v{font-family:var(--font-mono),ui-monospace,monospace;font-size:clamp(1.15rem,5vw,1.6rem);color:var(--gold)}
.hud-tile-s{font-size:.78rem;color:var(--dim);line-height:1.4;flex:1}
.hud-tile .hud-tag{align-self:flex-start;margin-top:6px}
.hud-feed{list-style:none;margin:0;padding:0;max-height:440px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--gold-dim) transparent;font-family:var(--font-mono),ui-monospace,monospace}
.hud-feed-row{display:grid;grid-template-columns:auto auto auto 1fr auto;gap:8px 10px;align-items:center;padding:7px 4px;border-bottom:1px solid rgba(212,175,55,.1);font-size:.74rem;opacity:0;animation:hud-in .5s ease forwards}
.hud-feed-time{color:var(--dim)}
.hud-feed-acct{border:1px solid var(--gold-dim);color:var(--gold-warm);border-radius:2px;padding:0 5px}
.hud-feed-acct-b{border-color:var(--steel);color:var(--steel)}
.hud-feed-cat{color:var(--ice);letter-spacing:.08em}
.hud-feed-code{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.hud-feed-ok{color:var(--ok);letter-spacing:.1em;font-size:.64rem}
.hud-stamp{color:var(--dim);font-size:var(--fs-xs);text-align:center;letter-spacing:.06em}
@keyframes hud-scan{from{transform:translateY(0)}to{transform:translateY(360%)}}
@keyframes hud-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@media (max-width:460px){.hud-feed-row{grid-template-columns:auto auto 1fr auto}.hud-feed-cat{display:none}}
@media (min-width:900px){
 .hud-wrap{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;padding:0 24px}
 .hud-hero,.hud-wide{grid-column:1/-1}
 .hud-bigrow{grid-template-columns:1fr 1.3fr}
 .hud-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}
 .hud-feed{max-height:520px}
}
@media (prefers-reduced-motion:reduce){.hud-panel::after{animation:none}.hud-feed-row{animation:none;opacity:1}}
`}</style>
  );
}
