"use strict";
// CreatorOS demo client. Talks only to its own origin (CSP connect-src 'self'). No trackers, no external assets.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let token = "";
  try { const m = location.hash.match(/t=([\w-]+)/); if (m) { token = m[1]; sessionStorage.setItem("cos_t", token); history.replaceState(null, "", "/"); } else { token = sessionStorage.getItem("cos_t") || ""; } } catch (e) { /* storage may be blocked */ }
  let S = null;

  // ---- Static mode: the whole demo runs in this browser from a build-time snapshot. Nothing is stored or sent. ----
  const ST = window.COS_STATIC || null;
  const L = ST && { brands: ST.brands.brands.map((b) => ({ ...b })), drafts: [], approvals: [], bounds: { ...ST.boundaries },
    consents: ST.consent.consents.map((c) => ({ ...c })), members: (ST.consent.members || []).map((m) => ({ ...m })), audit: [], n: 0 };
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, "0")).join("");
  async function sha(o) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(o))); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(""); }
  const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
  async function audit(action, subject) { const prev = L.audit.length ? L.audit[L.audit.length - 1].hash : "GENESIS"; const e = { seq: L.audit.length + 1, ts: now(), actor_id: S.actor, action, subject, prev_hash: prev }; e.hash = await sha([prev, e.ts, e.actor_id, action, subject]); L.audit.push(e); }
  const fail = (msg, status, data) => { const e = new Error(msg); e.status = status || 422; e.data = data || { reason: msg }; throw e; };
  const dhash = (d) => sha({ channel: d.channel, target: d.target, subject: d.subject, body: d.body, version: d.version });
  function runScen(a) {
    const keep = 1 - a.monthly_churn_pct / 100, fee = (a.platform_fee_pct + a.payment_fee_pct) / 100, npm = a.audience * a.conversion_pct / 100 / a.months * 2;
    let mem = 0, cum = 0; const rows = [];
    for (let m = 1; m <= a.months; m++) { mem = mem * keep + npm * (m <= a.months / 2 ? 1 : 0.25); const g = mem * a.price, pre = g * (1 - fee) - a.production_cost, net = pre > 0 ? pre * (1 - a.tax_provision_pct / 100) : pre; cum += net; rows.push({ month: m, members: Math.round(mem), gross: Math.round(g), net_after_tax_provision: Math.round(net) }); }
    const den = a.price * (1 - fee);
    return { rows, total_net: Math.round(cum), breakeven_members: den > 0 ? Math.ceil(a.production_cost / den - 1e-9) : null };
  }
  function scenarios(a) {
    for (const k of ["conversion_pct", "monthly_churn_pct", "platform_fee_pct", "payment_fee_pct", "tax_provision_pct"]) if (!(a[k] >= 0 && a[k] <= 100)) fail(k + " must be 0-100");
    if (!(a.audience >= 0 && a.price >= 0 && a.production_cost >= 0)) fail("negative inputs are not meaningful");
    const low = { ...a, conversion_pct: a.conversion_pct * 0.5, monthly_churn_pct: Math.min(100, a.monthly_churn_pct * 1.5) };
    const high = { ...a, conversion_pct: a.conversion_pct * 1.5, monthly_churn_pct: a.monthly_churn_pct * 0.7 };
    const sens = [["conversion -50%", "conversion_pct", 0.5], ["conversion +50%", "conversion_pct", 1.5], ["price -30%", "price", 0.7], ["price +30%", "price", 1.3], ["churn x2", "monthly_churn_pct", 2]]
      .map(([change, f, m]) => ({ change, total_net: runScen({ ...a, [f]: f === "price" ? a.price * m : Math.min(100, a[f] * m) }).total_net }));
    return { ...ST.monetization.scenario, assumptions: a, low: runScen(low), base: runScen(a), high: runScen(high), sensitivity: sens };
  }
  async function staticApi(path, body) {
    let m;
    const draft = (id) => L.drafts.find((d) => d.id === id) || fail("no such draft", 403);
    if (path === "/api/session") return ST.session;
    if (path === "/api/analytics/overview") return ST.overview;
    if ((m = path.match(/^\/api\/analytics\/evidence\/(.+)$/))) return ST.evidence[decodeURIComponent(m[1])] || fail("no such observation", 403);
    if (path === "/api/content") return ST.content;
    if (path === "/api/brands") return { ...ST.brands, brands: L.brands, summary: { ...ST.brands.summary, drafts_awaiting_approval: L.approvals.filter((a) => a.status === "PENDING").length } };
    if ((m = path.match(/^\/api\/brands\/([\w-]+)\/stage$/))) {
      const b = L.brands.find((x) => x.id === m[1]) || fail("no such brand", 403);
      if (!(ST.transitions[b.stage] || []).includes(body.stage)) fail(`cannot move ${b.stage} -> ${body.stage}`);
      b.stage = body.stage; await audit("brand.stage", b.id); return b;
    }
    if (path === "/api/outreach/draft") {
      const t = (ST.drafts[body.brand_id] || fail("this brand is vetoed or under-evidenced; no draft until that changes", 403))[body.length === "long" ? "long" : "short"];
      const d = { ...t, id: "dr-" + rnd().slice(0, 10), version: 1, publication_state: "DRAFT" }; d.content_hash = await dhash(d);
      L.drafts.push(d); const b = L.brands.find((x) => x.id === body.brand_id); if (b && b.stage === "shortlisted") b.stage = "drafted";
      await audit("draft.create", d.id); return d;
    }
    if (path === "/api/drafts") return { drafts: L.drafts.map((d) => ({ ...d, approvals: L.approvals.filter((a) => a.draft_id === d.id) })) };
    if ((m = path.match(/^\/api\/drafts\/([\w-]+)\/edit$/))) {
      const d = draft(m[1]); if (d.content_hash !== body.expected_hash) fail("stale edit", 403); if (d.publication_state !== "DRAFT") fail("a sent draft cannot be edited", 403);
      d.body = String(body.body).slice(0, 5000); d.version += 1; d.content_hash = await dhash(d);
      L.approvals.filter((a) => a.draft_id === d.id && ["PENDING", "APPROVED"].includes(a.status)).forEach((a) => (a.status = "INVALIDATED"));
      await audit("draft.edit", d.id); return d;
    }
    if (path === "/api/approvals") {
      const d = draft(body.draft_id); if (L.approvals.some((a) => a.draft_id === d.id && a.status === "PENDING")) fail("already pending", 403);
      const a = { id: "apr-" + rnd().slice(0, 12), draft_id: d.id, resource_version_hash: d.content_hash, nonce: rnd(), status: "PENDING", expiry: Date.now() + 72 * 3600e3 };
      L.approvals.push(a); await audit("approval.request", a.id); return a;
    }
    if ((m = path.match(/^\/api\/approvals\/([\w-]+)\/decision$/))) {
      const a = L.approvals.find((x) => x.id === m[1]) || fail("no such approval", 403), d = draft(a.draft_id);
      if (a.status !== "PENDING" || a.nonce !== body.nonce) fail("stale or replayed decision", 403);
      if (d.content_hash !== a.resource_version_hash || body.content_hash !== d.content_hash) fail("content hash mismatch: approve only the exact version you saw", 403);
      a.status = body.decision === "APPROVED" ? "APPROVED" : "REJECTED"; a.nonce = rnd(); await audit("approval." + a.status.toLowerCase(), a.id); return a;
    }
    if ((m = path.match(/^\/api\/actions\/(\w+)$/))) { await audit("external.blocked", String(body.resource_id).slice(0, 100)); fail("blocked", 403, { outcome: "BLOCKED", reasons: ST.blocked_reasons, safe_alternative: "Copy the approved draft and send it yourself from your own account." }); }
    if ((m = path.match(/^\/api\/drafts\/([\w-]+)\/owner-sent$/))) {
      const d = draft(m[1]); if (!L.approvals.some((a) => a.draft_id === d.id && a.status === "APPROVED" && a.resource_version_hash === d.content_hash && Date.now() < a.expiry)) fail("only an approved, unedited draft can be marked sent", 403);
      d.publication_state = "CREATOR_SENT"; await audit("draft.owner_marked_sent", d.id); return d;
    }
    if (path === "/api/boundaries" && !body) return L.bounds;
    if (path === "/api/boundaries") {
      if (body.key in ST.locked && body.value !== ST.locked[body.key]) fail("that setting is locked in CreatorOS");
      if (body.key === "adult_platform_module" && body.value && String(body.opt_in_text).trim() !== "I choose to add adult-platform planning to my workspace") fail("adult-platform planning needs your own explicit opt-in sentence");
      L.bounds[body.key] = body.value === true; await audit("boundary.set", body.key); return L.bounds;
    }
    if (path === "/api/monetization/scenario") {
      const a = { ...ST.monetization.scenario.assumptions }; for (const [k, v] of Object.entries(body.assumptions || {})) if (k in a) a[k] = +v;
      const routes = ST.monetization.routes.map((r) => (r.gated ? { ...r, enabled: !!L.bounds.adult_platform_module, status: L.bounds.adult_platform_module ? "OPTED IN: planning only, nothing is set up for you" : r.status } : r));
      return { ...ST.monetization, routes, scenario: scenarios(a) };
    }
    if (path === "/api/consent") return { ...ST.consent, consents: L.consents, members: L.members };
    if ((m = path.match(/^\/api\/consent\/([\w-]+)\/revoke$/))) { const c = L.consents.find((x) => x.id === m[1]) || fail("no such consent", 403); c.revoked_at = now(); await audit("consent.revoke", c.id); return c; }
    if ((m = path.match(/^\/api\/delegations\/(.+)\/revoke$/))) { const mm = L.members.find((x) => x.actor_id === decodeURIComponent(m[1])) || fail("no such member", 403); mm.active = 0; mm.revoked_at = now(); await audit("delegation.revoke", mm.actor_id); return mm; }
    if (path === "/api/audit") return { events: L.audit, chain_ok: true, local: true };
    if ((m = path.match(/^\/api\/reports\/(weekly\.md|metrics\.csv)$/))) return ST.reports[m[1]];
    fail("not available in this demo", 404);
  }

  async function api(path, body, raw) {
    if (ST) return staticApi(path, body);
    const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "X-Demo-Token": token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (raw) { if (!r.ok) throw new Error("export failed"); return r.text(); }
    const j = await r.json().catch(() => ({ error: "bad response" }));
    if (!r.ok) { const e = new Error(j.reason || (j.reasons && j.reasons.join(" · ")) || j.error || "request failed"); e.data = j; e.status = r.status; throw e; }
    return j;
  }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 5200); }
  const tag = (txt, kind) => `<span class="tag ${kind || ""}">${esc(txt)}</span>`;
  const srcTag = (s) => s === "DEMO_SYNTHETIC" ? tag("SAMPLE", "sample") : s === "UNAVAILABLE" ? tag("NOT AVAILABLE", "") : s === "INFERRED_MODEL" ? tag("MODEL GUESS", "warn") : tag(s, "good");
  const isCreator = () => S && S.role === "creator";

  const views = {
    async home() {
      const [ov, cl, br] = await Promise.all([api("/api/analytics/overview"), api("/api/content"), api("/api/brands")]);
      const t = S.trial;
      const top = cl.experiments.items.slice(0, 2);
      const strong = br.brands.filter((b) => b.fit.band === "STRONG").slice(0, 2);
      return `
      <div class="hero"><p class="small muted">Prepared for ${esc(S.display_name)}${S.alias_confirmed_by_owner ? "" : " · display name pending your OK"}</p>
        <h1>Your brand. Your audience. Your approval.</h1>
        <p>A private control centre for growth, brand deals and optional income ideas. You own every account. Nothing is posted or sent without you.</p>
        <div class="row">${tag(ov.badge, "sample")}${tag("Role: " + S.role)}${tag("Outbound: OFF", "good")}</div></div>
      <div class="card"><h3>The trial</h3><p><b>$${esc(t.price)}</b> · no obligation · no automatic upgrade · no commission. Anything beyond the trial would be ${esc(t.future_terms)}.</p></div>
      <h2>Your goals</h2>${S.profile.goals.map((g) => `<div class="card"><p>${esc(g)}</p></div>`).join("")}
      <h2>Priority actions</h2>
      ${top.map((e) => `<div class="card"><h3>${esc(e.title)}</h3><p class="small">${esc(e.why)}</p><div class="row">${tag("Effort: " + e.cost)}${tag("Needs your approval", "warn")}</div></div>`).join("")}
      ${strong.map((b) => `<div class="card"><h3>Look at ${esc(b.name)}</h3><p class="small">${esc(b.fit.verdict)}</p><div class="row">${tag("SAMPLE BRAND", "sample")}</div></div>`).join("")}
      <h2>The 8-minute walkthrough</h2>
      <ol class="steps">
        <li><b>Privacy and ownership.</b> Control tab: what we hold, what we never ask for.</li>
        <li><b>Social performance.</b> Growth tab: every number shows where it came from.</li>
        <li><b>Three content tests.</b> Growth tab: hypothesis, test, what would prove it wrong.</li>
        <li><b>Five sample brand cards.</b> Brands tab: why each fits, or why it's vetoed.</li>
        <li><b>A tailored, no-spam pitch.</b> Draft one, edit it, read it.</li>
        <li><b>An optional income scenario.</b> Options tab: no explicit content, assumptions on show.</li>
        <li><b>Approval, consent and export.</b> Approve the exact version; try “Send” and watch it refuse.</li>
        <li><b>Next steps.</b> Public-data analysis first; your own analytics export only if you choose.</li>
      </ol>
      <div class="card"><p>No passwords, ID or payment details are needed for any of this, now or later. If a platform ever needs to verify you, you do it yourself, on that platform.</p></div>`;
    },

    async growth() {
      const [ov, cl] = await Promise.all([api("/api/analytics/overview"), api("/api/content")]);
      const kpis = ov.metrics.map((m) => {
        const vs = m.vs_previous && m.vs_previous.status === "OK" ? `<span class="small">${m.vs_previous.delta >= 0 ? "▲" : "▼"} ${esc(Math.abs(m.vs_previous.delta))} vs previous 28 days</span>` : m.vs_previous ? `<span class="small muted">${esc(m.vs_previous.reason)}</span>` : "";
        const v = m.status === "OK" ? `<span class="v">${esc(m.display_value)}</span>` : `<span class="na">Not available</span>`;
        return `<div class="kpi"><span class="l">${esc(m.label)}</span>${v}${vs}<div>${srcTag(m.source)}</div>
          <details><summary>Evidence</summary><p class="small">${esc(m.formula || "")}</p><p class="small muted">${esc(m.reason || "")} ${m.inputs && m.inputs.length ? "· " + m.inputs.length + " observation(s)" : ""}</p>
          ${m.inputs && m.inputs[0] ? `<button class="ghost small" data-ev="${esc(m.inputs[0])}">Open evidence record</button>` : ""}</details></div>`;
      }).join("");
      const o = cl.observations;
      const fm = o.status === "OK" ? Object.entries(o.by_format).sort((a, b) => b[1].median_engagement_rate - a[1].median_engagement_rate) : [];
      const max = fm.length ? fm[0][1].median_engagement_rate : 1;
      const ex = cl.experiments;
      return `<h1>Growth</h1><p class="muted small">Window ${esc(ov.window.start)} to ${esc(ov.window.end)} · ${esc(ov.coverage_pct)}% of tracked metrics have evidence · the rest say “Not available”, never zero.</p>
      <div class="grid">${kpis}</div>
      <h2>What's working (sample posts)</h2>
      <div class="card">${o.status === "OK" ? `<table><thead><tr><th>Format</th><th>Posts</th><th>Median engagement</th></tr></thead><tbody>
        ${fm.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.posts)}</td><td><div class="bar"><i data-w="${(v.median_engagement_rate / max) * 100}"></i></div><span class="small">${esc(v.median_engagement_rate)}% · ${esc(v.note)}</span></td></tr>`).join("")}</tbody></table>
        <p class="small muted">${esc(o.caution)}</p>` : `<p>${esc(o.reason)}</p>`}</div>
      <h2>Content experiments</h2>
      ${ex.status === "OK" ? ex.items.map((e) => `<div class="card"><h3>${esc(e.title)}</h3>
        <table><tbody><tr><th>Why</th><td>${esc(e.why)}</td></tr><tr><th>Source</th><td>${esc(e.source)}</td></tr><tr><th>Confidence</th><td>${esc(e.confidence)}</td></tr>
        <tr><th>Test</th><td>${esc(e.test)}</td></tr><tr><th>Proves it wrong</th><td>${esc(e.invalidate)}</td></tr><tr><th>Cost</th><td>${esc(e.cost)}</td></tr><tr><th>You</th><td>${esc(e.owner_action)}</td></tr></tbody></table></div>`).join("")
        : ex.onboarding.map((x) => `<div class="card">${esc(x)}</div>`).join("")}
      ${ex.removed && ex.removed.length ? `<div class="card"><p class="small">${esc(ex.removed.length)} idea(s) hidden because they touch something you've switched off (${esc([...new Set(ex.removed.flatMap((r) => r.blocked_by))].join(", "))}). ${esc(ex.removed_note)}</p></div>` : ""}`;
    },

    async brands() {
      const br = await api("/api/brands");
      const s = br.summary;
      const bandKind = { STRONG: "good", POSSIBLE: "warn", UNKNOWN: "", WEAK: "", "NO FIT": "bad" };
      return `<h1>Brand radar</h1><div class="card blocked"><p class="small">${esc(br.sample_notice)}</p></div>
      <div class="card small"><p>Discovered ${esc(s.discovered)} · unique ${esc(s.unique)} · qualified ${esc(s.qualified)} · duplicates removed ${esc(s.duplicates_dropped)} · drafts awaiting approval ${esc(s.drafts_awaiting_approval)}</p><p class="muted">Research cost: ${esc(s.cost)} · Daily research: ${esc(s.daily_research)}. Some days “none qualified” is the right answer.</p></div>
      ${br.brands.map((b) => `<div class="card"><div class="row"><h3>${esc(b.name)}</h3>${tag(b.fit.band, bandKind[b.fit.band])}${tag("SAMPLE", "sample")}${tag("Stage: " + b.stage)}</div>
        <p class="small">${esc(b.categories.join(" · "))}</p><p>${esc(b.fit.verdict)}</p>
        <details><summary>Why this score</summary><table><tbody>${Object.entries(b.fit.components).map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td>${v.score > 0 ? "+" : ""}${esc(v.score)}</td><td class="small">${esc(v.why)}</td></tr>`).join("")}</tbody></table>
        <p class="small muted">${esc(b.fit.uncertainty)}</p><p class="small">Evidence: ${esc(b.evidence[0].claim)} · ${esc(b.evidence[0].source)} · checked ${esc(b.checked_at)}</p><p class="small">Contact route (sample): ${esc(b.contact_route)}</p></details>
        <div class="row">${b.stage === "researched" ? `<button data-stage="shortlisted" data-b="${esc(b.id)}">Shortlist</button>` : ""}
          ${["researched", "shortlisted"].includes(b.stage) ? `<button class="ghost" data-stage="dismissed" data-b="${esc(b.id)}">Dismiss</button>` : ""}
          ${["STRONG", "POSSIBLE"].includes(b.fit.band) && S.role !== "viewer" && S.role !== "analyst" ? `<button class="primary" data-draft="${esc(b.id)}" data-len="short">Draft pitch</button><button data-draft="${esc(b.id)}" data-len="long">Long version</button>` : ""}</div></div>`).join("")}`;
    },

    async drafts() {
      const { drafts } = await api("/api/drafts");
      if (!drafts.length) return `<h1>Drafts</h1><div class="card"><p>No drafts yet. Open Brands and tap “Draft pitch”.</p></div>`;
      return `<h1>Drafts</h1><p class="muted small">Approval binds to the exact text. Edit it and the approval is cancelled. There is no send button that works: you copy it and send it yourself.</p>
      ${drafts.map((d) => {
        const live = d.approvals.find((a) => a.status === "APPROVED" && a.resource_version_hash === d.content_hash);
        const pend = d.approvals.find((a) => a.status === "PENDING");
        return `<div class="card" id="d-${esc(d.id)}"><div class="row"><h3>${esc(d.subject)}</h3>${d.sample ? tag("SAMPLE", "sample") : ""}${tag(d.publication_state)}${live ? tag("APPROVED v" + d.version, "good") : pend ? tag("AWAITING APPROVAL", "warn") : tag("NOT APPROVED")}</div>
        <p class="small muted">To: ${esc(d.target)} · version ${esc(d.version)} · hash ${esc(d.content_hash.slice(0, 12))}…</p>
        <pre class="draft">${esc(d.body)}</pre>
        <div class="row"><button data-copy="${esc(d.id)}">Copy</button>
          ${S.role !== "viewer" ? `<button data-edit="${esc(d.id)}" data-h="${esc(d.content_hash)}">Edit</button>` : ""}
          ${!pend && !live && S.role !== "viewer" ? `<button data-req="${esc(d.id)}">Ask for approval</button>` : ""}
          ${pend && isCreator() ? `<button class="primary" data-dec="APPROVED" data-a="${esc(pend.id)}" data-n="${esc(pend.nonce)}" data-h="${esc(d.content_hash)}">Approve this exact text</button><button data-dec="REJECTED" data-a="${esc(pend.id)}" data-n="${esc(pend.nonce)}" data-h="${esc(d.content_hash)}">Reject</button>` : ""}
          ${pend && !isCreator() ? `<span class="small muted">Only the creator can approve.</span>` : ""}
          <button class="ghost" data-send="${esc(d.id)}">Send</button>
          ${live && isCreator() && d.publication_state !== "CREATOR_SENT" ? `<button class="ghost" data-sent="${esc(d.id)}">I sent it myself</button>` : ""}</div>
        <div class="receipt"></div></div>`;
      }).join("")}`;
    },

    async money() {
      if (!isCreator()) return `<h1>Options</h1><div class="card"><p>Income planning is private to the creator. Your role (${esc(S.role)}) can't see it.</p></div>`;
      const m = await api("/api/monetization/scenario", { assumptions: views._assump || {} });
      const sc = m.scenario, a = sc.assumptions;
      const field = (k, label, step) => `<label class="field">${esc(label)}<input type="number" step="${step}" name="${k}" value="${esc(a[k])}"><span class="small">${esc(sc.assumption_status[k])}</span></label>`;
      const row = (n, r) => `<tr><td>${n}</td><td>${esc(r.total_net)}</td><td>${r.breakeven_members === null ? "n/a" : esc(r.breakeven_members)}</td><td>${esc(r.rows[r.rows.length - 1].members)}</td></tr>`;
      return `<h1>Income options</h1><p class="muted small">All optional. None need explicit content. Pick what fits; ignore the rest.</p>
      ${m.routes.map((r) => `<div class="card"><div class="row"><h3>${esc(r.name)}</h3>${r.gated ? tag(r.enabled ? "OPTED IN" : "OFF", r.enabled ? "warn" : "") : tag("non-explicit", "good")}</div><p class="small">${esc(r.status)}</p><p class="small muted">Needs: ${esc(r.needs)}</p></div>`).join("")}
      <h2>Members community scenario</h2><div class="card blocked"><p><b>${esc(sc.label)}</b></p></div>
      <form id="scen" class="card"><div class="form">${field("audience", "People who see the offer", 100)}${field("conversion_pct", "% who join", 0.1)}${field("price", "Price per month ($)", 1)}${field("monthly_churn_pct", "% who leave each month", 1)}${field("platform_fee_pct", "Platform fee %", 0.5)}${field("payment_fee_pct", "Payment fee %", 0.5)}${field("production_cost", "Your monthly costs ($)", 10)}${field("tax_provision_pct", "Tax set-aside %", 1)}</div>
      <div class="row"><button class="primary" type="submit">Recalculate</button></div></form>
      <div class="card"><table><thead><tr><th>Case</th><th>Total over ${esc(a.months)} months</th><th>Break-even members</th><th>Members at end</th></tr></thead><tbody>${row("Low", sc.low)}${row("Base", sc.base)}${row("High", sc.high)}</tbody></table>
      <p class="small muted">${esc(sc.method)}</p><details><summary>Sensitivity</summary><table><tbody>${sc.sensitivity.map((s) => `<tr><td>${esc(s.change)}</td><td>${esc(s.total_net)}</td></tr>`).join("")}</tbody></table></details></div>
      <h2>Privacy, honestly</h2><div class="card"><ul>${m.privacy_truths.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`;
    },

    async privacy() {
      const c = await api("/api/consent");
      const b = isCreator() ? await api("/api/boundaries") : null;
      const au = isCreator() ? await api("/api/audit") : null;
      const label = { allow_face: "Show my face", allow_location: "Show locations", allow_real_name: "Use my real name", allow_revealing: "Revealing content", allow_explicit: "Explicit content (locked off)", allow_persona_link: "Link my public and private personas", allow_relationships: "Mention relationships", adult_platform_module: "Adult-platform planning", publish_requires_approval: "Every post needs my approval (locked on)" };
      return `<h1>Your control centre</h1>
      <div class="card"><h3>What we never ask for</h3><p>Passwords · recovery codes · ID documents · face scans · card or bank details. Accounts are always yours, set up by you, with your email and your 2FA.</p></div>
      ${b ? `<h2>Boundaries</h2><div class="card">${Object.entries(b).map(([k, v]) => `<div class="switch"><span>${esc(label[k] || k)}</span><button role="switch" aria-checked="${v}" data-bound="${esc(k)}" ${k === "allow_explicit" || k === "publish_requires_approval" ? "disabled" : ""}>${v ? "On" : "Off"}</button></div>`).join("")}</div>` : ""}
      <h2>Consents</h2>${c.consents.map((x) => `<div class="card"><p><b>${esc(x.purpose)}</b> · ${esc(x.scope)}</p><p class="small muted">Granted ${esc(x.granted_at)} ${x.revoked_at ? "· revoked " + esc(x.revoked_at) : ""}</p>${isCreator() && !x.revoked_at ? `<button data-revc="${esc(x.id)}">Revoke</button>` : ""}</div>`).join("")}
      ${c.members ? `<h2>Who has access</h2><div class="card"><table><thead><tr><th>Who</th><th>Role</th><th></th></tr></thead><tbody>${c.members.map((m) => `<tr><td>${esc(m.actor_id)}</td><td>${esc(m.role)}${m.active ? "" : " (revoked)"}</td><td>${m.role !== "creator" && m.active ? `<button class="ghost" data-revm="${esc(m.actor_id)}">Revoke</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <h2>What we hold and why</h2><div class="card"><table><thead><tr><th>Data</th><th>Source</th><th>Kept</th></tr></thead><tbody>${c.processing_register.map((r) => `<tr><td>${esc(r.data)}</td><td>${esc(r.source)}</td><td>${esc(r.retention)}</td></tr>`).join("")}</tbody></table></div>
      <h2>Export</h2><div class="card row"><button data-exp="weekly.md">Weekly report (.md)</button><button data-exp="metrics.csv">Metrics (.csv)</button></div>
      ${S.role !== "viewer" && !S.static ? `<h2>Try an analytics import</h2><div class="card"><p class="small muted">Paste a CSV you exported yourself. This only checks it; nothing is stored.</p><textarea id="csv" aria-label="CSV to validate">date,impressions,likes,replies,reposts\n2026-10-01,1200,30,4,2</textarea><div class="row"><button data-validate="1">Check file</button></div><pre class="draft" id="csvout" hidden></pre></div>` : ""}
      ${au ? `<h2>Audit trail</h2><div class="card"><p class="small">${au.chain_ok ? tag("CHAIN INTACT", "good") : tag("CHAIN BROKEN", "bad")} ${esc(au.events.length)} events${au.local ? " in this browser session (they vanish when you close the page)" : ""}, each hash-linked to the last.</p><details><summary>Show events</summary><table><tbody>${au.events.slice(-25).reverse().map((e) => `<tr><td class="small">${esc(e.ts)}</td><td class="small">${esc(e.action)}</td><td class="small">${esc(e.actor_id)}</td></tr>`).join("")}</tbody></table></details></div>` : ""}`;
    },
  };

  let current = "home";
  async function show(tab, initial) {
    current = tab;
    document.querySelectorAll(".tabs button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    const v = $("#view");
    try { v.innerHTML = await views[tab](); } catch (e) { v.innerHTML = `<div class="card blocked"><h3>Couldn't load this view</h3><p>${esc(e.message)}</p><p class="small muted">Nothing was changed. Check the link you opened includes your access token.</p></div>`; }
    v.querySelectorAll(".bar i[data-w]").forEach((i) => (i.style.width = Math.max(3, Math.min(100, +i.dataset.w)) + "%"));
    if (!initial) $("#main").focus({ preventScroll: true });
  }

  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    try {
      if (b.dataset.tab) return show(b.dataset.tab);
      if (b.dataset.ev) { const r = await api("/api/analytics/evidence/" + encodeURIComponent(b.dataset.ev)); return toast(`${r.metric_id}: ${r.display_value} · ${r.source_type} · ${r.source_ref} · hash ${r.raw_evidence_hash.slice(0, 10)}…`); }
      if (b.dataset.stage) { await api(`/api/brands/${b.dataset.b}/stage`, { stage: b.dataset.stage }); toast("Updated"); return show("brands"); }
      if (b.dataset.draft) { await api("/api/outreach/draft", { brand_id: b.dataset.draft, length: b.dataset.len }); toast("Draft created. Nothing was sent."); return show("drafts"); }
      if (b.dataset.copy) { const t = b.closest(".card").querySelector("pre").textContent; await navigator.clipboard.writeText(t).catch(() => {}); return toast("Copied. You send it from your own account when you're ready."); }
      if (b.dataset.req) { await api("/api/approvals", { draft_id: b.dataset.req }); toast("Approval requested"); return show("drafts"); }
      if (b.dataset.dec) { await api(`/api/approvals/${b.dataset.a}/decision`, { decision: b.dataset.dec, content_hash: b.dataset.h, nonce: b.dataset.n }); toast(b.dataset.dec === "APPROVED" ? "Approved this exact version" : "Rejected"); return show("drafts"); }
      if (b.dataset.send) {
        try { await api("/api/actions/send", { resource_id: b.dataset.send }); } catch (e) {
          const r = e.data || {}; const box = b.closest(".card").querySelector(".receipt");
          box.innerHTML = `<div class="card blocked"><h3>Blocked, on purpose</h3><ul>${(r.reasons || [e.message]).map((x) => `<li class="small">${esc(x)}</li>`).join("")}</ul><p class="small">${esc(r.safe_alternative || "")}</p></div>`;
        } return;
      }
      if (b.dataset.sent) { const note = prompt("Where and when did you send it? (for your own records)") || ""; await api(`/api/drafts/${b.dataset.sent}/owner-sent`, { note }); return show("drafts"); }
      if (b.dataset.edit) {
        const card = b.closest(".card"); const pre = card.querySelector("pre");
        if (!card.querySelector("textarea")) { const ta = document.createElement("textarea"); ta.value = pre.textContent; ta.setAttribute("aria-label", "Edit draft"); pre.replaceWith(ta); b.textContent = "Save edit"; return; }
        await api(`/api/drafts/${b.dataset.edit}/edit`, { body: card.querySelector("textarea").value, expected_hash: b.dataset.h }); toast("Saved as a new version. Any earlier approval is cancelled."); return show("drafts");
      }
      if (b.dataset.bound) {
        const key = b.dataset.bound, on = b.getAttribute("aria-checked") !== "true"; let opt = "";
        if (key === "adult_platform_module" && on) { opt = prompt('Optional. To add adult-platform planning, type exactly:\nI choose to add adult-platform planning to my workspace') || ""; }
        await api("/api/boundaries", { key, value: on, opt_in_text: opt }); toast("Saved"); return show("privacy");
      }
      if (b.dataset.revc) { await api(`/api/consent/${b.dataset.revc}/revoke`, {}); toast("Consent revoked"); return show("privacy"); }
      if (b.dataset.revm) { await api(`/api/delegations/${encodeURIComponent(b.dataset.revm)}/revoke`, {}); toast("Access revoked immediately"); return show("privacy"); }
      if (b.dataset.exp) { const txt = await api("/api/reports/" + b.dataset.exp, null, true); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" })); a.download = "creatoros-" + b.dataset.exp; a.click(); return toast("Exported. Sample watermark included."); }
      if (b.dataset.validate) { const r = await api("/api/imports/validate", { csv: $("#csv").value }); const o = $("#csvout"); o.hidden = false; o.textContent = JSON.stringify(r, null, 2); return; }
    } catch (e) { toast(e.message); }
  });
  document.addEventListener("submit", (ev) => {
    if (ev.target.id !== "scen") return; ev.preventDefault();
    views._assump = Object.fromEntries([...new FormData(ev.target)].map(([k, v]) => [k, +v])); show("money");
  });

  (async () => {
    try { S = await api("/api/session"); } catch (e) { $("#view").innerHTML = `<div class="card"><h3>This demo needs its private link</h3><p>Open the link printed when the demo server started. No account or password is ever needed.</p></div>`; $("#badge").textContent = "NO ACCESS"; return; }
    $("#badge").textContent = S.data_badge; $("#samplebar").hidden = !S.demo;
    if (S.static) $("#samplebar").textContent += " · this page runs only in your browser: what you click isn't saved or seen by anyone";
    if (S.theme && S.theme.accent && /^#[0-9a-f]{6}$/i.test(S.theme.accent)) document.documentElement.style.setProperty("--accent", S.theme.accent);
    show("home", true);
  })();
})();
