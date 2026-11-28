"use client";

/**
 * HomeNav: the homepage-only header for the redesign. The global Nav (components/Nav.tsx) renders nothing on "/" and keeps serving every other route.
 * Desktop: logo, Platform and Products disclosure menus, Proof, Case Studies, Contact, gold CTA.
 * Mobile: burger opens a full-height panel (Escape closes, scroll locked, focus moved in and returned). The panel also lists every page in
 * lib/navLinks.ts so no route becomes undiscoverable.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X, ArrowRight } from "lucide-react";
import PhiWordmark from "@/components/hero/PhiWordmark";
import { LINKS } from "@/lib/navLinks";

type L = { label: string; href: string; blurb?: string };

const PLATFORM: L[] = [
  { label: "How it works", href: "/how-it-works", blurb: "From first message to a running system" },
  { label: "Engineering record", href: "/engineering", blurb: "Lines, repositories and method" },
  { label: "Methodology", href: "/methodology", blurb: "How every figure is sourced" },
  { label: "Live HUD", href: "/hud", blurb: "Build counter and receipt feed" },
  { label: "Trust and safety", href: "/trust", blurb: "What we scan, what we never do" },
];
const PRODUCTS: L[] = [
  { label: "All offers", href: "/offers", blurb: "Every door, free to enterprise" },
  { label: "AI Partnership", href: "/ai-delivery", blurb: "Retainers that build the system" },
  { label: "Compliance Monitor", href: "/monitor", blurb: "Ongoing compliance checks" },
  { label: "Verified leads", href: "/leads", blurb: "Public business information only" },
  { label: "Free scan", href: "/scan", blurb: "Free email security check" },
  { label: "Products and courses", href: "/products", blurb: "Guides, templates, short courses" },
];

function Dropdown({ id, label, items, open, setOpen, btnRef }: { id: string; label: string; items: L[]; open: boolean; setOpen: (v: boolean) => void; btnRef: (el: HTMLButtonElement | null) => void }) {
  const menuId = useId();
  return (
    <li className="pe-nav__item" data-open={open ? "true" : "false"} onMouseEnter={() => matchMedia("(hover: hover)").matches && setOpen(true)} onMouseLeave={() => matchMedia("(hover: hover)").matches && setOpen(false)}>
      <button
        type="button" ref={btnRef} className="pe-nav__link pe-nav__btn" aria-expanded={open} aria-controls={menuId} data-menu={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${CSS.escape(menuId)} a`)?.focus()); } }}
      >
        {label} <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <ul id={menuId} className="pe-nav__menu" hidden={!open}>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} onClick={() => setOpen(false)}>
              <span>{it.label}</span>
              {it.blurb && <small>{it.blurb}</small>}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function HomeNav() {
  const [menu, setMenu] = useState<null | "platform" | "products">(null);
  const [drawer, setDrawer] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const btns = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelId = useId();

  const closeAll = useCallback(() => { setMenu(null); setDrawer(false); }, []);

  // Escape closes any open menu or the drawer and returns focus to what opened it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawer) { setDrawer(false); burger.current?.focus(); }
      else if (menu) { const b = btns.current[menu]; setMenu(null); b?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, menu]);

  // Click or focus leaving the menu closes it.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: Event) => { if (!(e.target as HTMLElement).closest?.(".pe-nav__item")) setMenu(null); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("focusin", onDown);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("focusin", onDown); };
  }, [menu]);

  // Drawer: lock scroll, move focus in, trap Tab inside the panel and the burger.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel.current) return;
      const f = [burger.current, ...Array.from(panel.current.querySelectorAll<HTMLElement>("a[href]"))].filter(Boolean) as HTMLElement[];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    const mq = matchMedia("(min-width: 981px)");
    const onMq = () => mq.matches && setDrawer(false);
    mq.addEventListener("change", onMq);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", trap); mq.removeEventListener("change", onMq); };
  }, [drawer]);

  const shown = new Set([...PLATFORM, ...PRODUCTS].map((l) => l.href).concat(["/proof", "/case-studies", "/contact", "/app"]));
  const rest = LINKS.filter((l) => !shown.has(l.href));

  return (
    <header className="pe-nav">
      <div className="pe-nav__bar">
        <Link href="/" className="pe-brand" aria-label="TITANOS home">
          <picture>
            <source type="image/webp" srcSet="/site-redesign/t-mark.webp" />
            <img src="/site-redesign/t-mark.png" alt="" width={40} height={40} className="pe-brand__mark" />
          </picture>
          <PhiWordmark height={18} title="TITANOS" />
        </Link>
        <span className="pe-nav__rule" aria-hidden="true" />
        <nav aria-label="Main" className="pe-nav__main">
          <ul className="pe-nav__list">
            <Dropdown id="platform" label="Platform" items={PLATFORM} open={menu === "platform"} setOpen={(v) => setMenu(v ? "platform" : null)} btnRef={(el) => { btns.current.platform = el; }} />
            <li><Link className="pe-nav__link" href="/proof">Proof</Link></li>
            <li><Link className="pe-nav__link" href="/case-studies">Case Studies</Link></li>
            <Dropdown id="products" label="Products" items={PRODUCTS} open={menu === "products"} setOpen={(v) => setMenu(v ? "products" : null)} btnRef={(el) => { btns.current.products = el; }} />
            <li><Link className="pe-nav__link" href="/contact">Contact</Link></li>
          </ul>
        </nav>
        <Link href="/app" className="pe-btn pe-btn--gold pe-nav__cta">Enter TitanOS <ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
        <button ref={burger} type="button" className="pe-nav__burger" aria-expanded={drawer} aria-controls={panelId} aria-label={drawer ? "Close menu" : "Open menu"} onClick={() => setDrawer((d) => !d)}>
          {drawer ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>
      <div ref={panel} id={panelId} className="pe-drawer" hidden={!drawer}>
        <nav aria-label="Menu">
          <p className="pe-drawer__h">Platform</p>
          <ul>{PLATFORM.map((l) => <li key={l.href}><Link href={l.href} onClick={closeAll}>{l.label}</Link></li>)}</ul>
          <p className="pe-drawer__h">Products</p>
          <ul>{PRODUCTS.map((l) => <li key={l.href}><Link href={l.href} onClick={closeAll}>{l.label}</Link></li>)}</ul>
          <p className="pe-drawer__h">Evidence</p>
          <ul>
            <li><Link href="/proof" onClick={closeAll}>Proof</Link></li>
            <li><Link href="/case-studies" onClick={closeAll}>Case Studies</Link></li>
            <li><Link href="/contact" onClick={closeAll}>Contact</Link></li>
          </ul>
          <p className="pe-drawer__h">All other pages</p>
          <ul className="pe-drawer__more">{rest.map((l) => <li key={l.href}><Link href={l.href} onClick={closeAll}>{l.label}</Link></li>)}</ul>
          <Link href="/app" className="pe-btn pe-btn--gold pe-drawer__cta" onClick={closeAll}>Enter TitanOS <ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
        </nav>
      </div>
    </header>
  );
}
