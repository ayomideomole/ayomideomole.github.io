# ayoomole.xyz

Personal site for Ayo Omole. Astro + Tailwind v4 + MDX, deployed to Cloudflare Pages.

## Getting started

```bash
npm install
npm run dev
```

## Pending inputs (brief §2)

- [ ] **Substack URL** — required to run migration script for `/writing` archive
- [x] **SEB Baltic year** — 2023
- [ ] **Primary email** — currently `hey@ayoomole.xyz`; confirm
- [ ] **Portrait photo** — `public/portrait.jpg` placeholder in place
- [ ] **Resume PDF** — `public/resume.pdf` placeholder in place
- [ ] **Google Calendar Appointment link** — replace placeholder in `src/components/Letterhead.astro`

Colors: rsms.me palette (literal). Accent = `#0366D6` light / `#9AC9FE` dark.

## Structure

- Single-page home: **Letterhead** (sticky identity, left) + **Ledger** (unified chronological log, right)
- 5 case studies at root slugs: `/ai`, `/threatdown`, `/one-capital`, `/mint-pay`, `/seb-baltic`
- `/writing` index + individual post pages (archive populates via migration script once Substack URL confirmed)
- `/about`, `/404`, `/rss.xml`, `/sitemap-index.xml`

## Content

- Case studies live in `src/content/work/*.mdx` — edit frontmatter + body there
- Writing posts in `src/content/writing/*.mdx`
- Home "Now" block in `src/content/home/now.md`

## Deploy

Connect the private GitHub repo to Cloudflare Pages. Build command: `npm run build`. Output: `dist/`.
