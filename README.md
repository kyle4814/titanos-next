# titanos-next

**Phase 1 complete. NOT yet deployed.**

This is the S++ Next.js rebuild of [titanos.tech](https://titanos.tech). The
live static site at `/home/userland/titanos-tech/` is still serving customers
and is untouched by this project.

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 (PostCSS plugin)
- framer-motion, gsap, lucide-react
- Cinzel + Inter via `next/font/google`

## Status

| Page             | Phase 1            |
| ---------------- | ------------------ |
| `/` (homepage)   | Fully built        |
| `/scan`          | Stub               |
| `/compliance`    | Stub               |
| `/ai-delivery`   | Stub               |
| `/methodology`   | Stub               |
| `/privacy`       | Stub               |
| `/terms`         | Stub               |

Phase 2 will replace the stubs. Phase 3 will deploy to Cloudflare Pages.
