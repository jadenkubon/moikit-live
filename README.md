# MoiKit

Marketing + kit-builder site for MoiKit — itemized home-essentials kits for new arrivals in
Lappeenranta, Finland. Built with [Astro](https://astro.build) and
[Tailwind CSS v4](https://tailwindcss.com).

## Develop

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the built site
```

## Structure

- `src/data/kits.ts` — single source of truth for kits, prices, comparison rows and FAQs
- `src/pages/index.astro` — home page (hero, kit cards, tier compare, FAQ)
- `src/pages/kits/[slug].astro` — one page per kit with the modular +/− builder
  (quantities persist per kit in `localStorage`)
- `src/components/` — Header, Footer, KitCard
- `src/styles/global.css` — Tailwind theme tokens (colors, fonts, keyframes)

All pages are fully static (`astro build` → `dist/`); the only client JS is the trust-bar
rotator, hero video swap, tier compare, FAQ accordion and the kit builder.
