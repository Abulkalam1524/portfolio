# Abul Kalam Azad — Security Portfolio

A hand-built, zero-dependency portfolio site for a junior penetration tester.
No framework, no build step, no `node_modules`. Open `index.html` and it works.

**Design direction:** professional cybersecurity — dark theme, code-style (mono) typography for all
technical chrome, a real terminal card, a functional severity palette borrowed from VAPT reporting,
and a single restrained glitch on the hero name. Deliberately *not* matrix rain, skulls, or neon green.

---

## Files

```
portfolio/
├── index.html               ← all content lives here
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── css/style.css        ← design tokens + all styling (numbered sections)
│   ├── js/main.js           ← ~4 KB vanilla JS, no dependencies
│   ├── img/favicon.svg
│   ├── img/og.png           ← 1200×630 social preview card
│   └── files/Abul_Kalam_Azad_Resume.pdf
└── .claude/launch.json      ← local preview config
```

---

## Run it locally

```bash
python -m http.server 8899
```

Then open <http://localhost:8899>.

> Open `index.html` directly via `file://` and the CSS/JS will not load — use the server above.

---

## Deploy

### Cloudflare Pages (recommended — fastest, free, free SSL)
1. Push this folder to a GitHub repo.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build command: **leave empty**. Build output directory: **`/`**.
4. Add your custom domain under the project's *Custom domains* tab.

### GitHub Pages
1. Push to a repo named `Abulkalam1524.github.io` (or any repo).
2. Settings → Pages → Source: `main` branch, `/ (root)`.
3. Live at `https://abulkalam1524.github.io`.

### Netlify
Drag the whole `portfolio` folder onto <https://app.netlify.com/drop>.

---

## Before you go live — checklist

- [ ] **Buy a domain** and replace `https://abulkalamazad.dev/` everywhere it appears:
      `index.html` (canonical + 5 `og:`/`twitter:` tags), `robots.txt`, `sitemap.xml`.
      A custom domain reads far more credibly to recruiters than `*.github.io`.
- [ ] **Add certification verification links.** This is the single highest-value credibility upgrade.
      There is a comment in the Certifications section showing exactly how — wrap the `<h3>` text
      in an anchor pointing at the credential's public verify URL.
- [ ] **Update `<lastmod>`** in `sitemap.xml` whenever you make a real content change.
- [ ] **Publish more write-ups.** You have one live (Mr. Robot). The write-ups grid is built to hold
      many — duplicate an `<article class="card wu">` block per post. Getting to 6–10 is the biggest
      single improvement available to this site.
- [ ] Verify the résumé PDF in `assets/files/` is your latest version.

### Deliberately omitted

Your phone number is **not** on the page. It is in the downloadable résumé, but publishing a mobile
number in raw HTML invites scraping and spam. If you want it visible anyway, add it to the contact
links list in `index.html`.

---

## Editing content

Everything is in `index.html`, in plain semantic HTML, in this order:

| # | Section | `id` |
|---|---------|------|
| — | Hero (status, name, terminal, stats) | `#top` |
| 01 | About + quick facts | `#about` |
| 02 | Skills & Tools | `#skills` |
| 03 | Certifications | `#certifications` |
| 04 | Security Projects (featured VAPT + tools) | `#projects` |
| 05 | CTF & Hands-on Labs | `#ctf` |
| 06 | Security Write-ups | `#writeups` |
| 07 | Experience & Education | `#experience` |
| 08 | Achievements & Recognition | `#achievements` |
| 09 | Contact | `#contact` |

**To change the colour scheme**, edit the tokens at the top of `assets/css/style.css` (`:root`).
The accent is `--accent: #45d6c4`. If you swap it, re-check contrast — every text colour currently
meets **WCAG 2.1 AA** (`--text-mute` is the tightest at 4.74:1 on the lightest surface).

**To add a skill/tag chip**, add an `<li>` to any `<ul class="chips">`.

---

## What was built in

- **Performance** — no framework, no bundler, one CSS file, ~4 KB of JS. Fonts load with
  `preconnect` + `display=swap`. Scroll handlers are `requestAnimationFrame`-throttled and passive.
- **Accessibility** — skip link, semantic landmarks, one `<h1>` with no heading-level skips, visible
  `:focus-visible` rings, `aria-expanded`/`aria-label` on the nav toggle, AA contrast throughout,
  and a full `prefers-reduced-motion` block that disables the glitch, typing, pulse and reveals.
- **Resilience** — a `<noscript>` block forces all reveal-on-scroll content visible, so the page is
  fully readable with JavaScript disabled or failing.
- **SEO** — unique title + meta description, canonical URL, Open Graph and Twitter cards with a
  generated 1200×630 image, JSON-LD `Person` schema with `sameAs` profile links, sitemap, robots.txt.
- **Print** — a print stylesheet strips the chrome so the page prints as a clean document.

---

## Migrating to Astro later

If you install Node and want a proper write-ups engine (tags, RSS, per-post pages, static search),
port to [Astro](https://astro.build). The content collection would live at `src/content/writeups/`
as Markdown. `style.css` transfers essentially as-is — it is plain CSS with custom properties.
Nothing here needs to be thrown away.
