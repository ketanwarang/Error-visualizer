# ShelfWatch Error Annotation Portal — Next.js + Supabase

Visually inspect ShelfWatch recognition errors overlaid on shelf images.
Upload a `df_out` CSV once — it's parsed in the browser and persisted to
Supabase, so the whole team can open the same dataset by URL, no re-uploads.

## What it shows

- Only `annotation_type = SKU` rows where `wrong_group = 1` OR `wrong_class = 1`
- Bounding boxes color-coded:
  - 🟣 Purple — wrong group + wrong class (WG+WC)
  - 🟠 Amber — wrong group only (WG)
  - 🔴 Red — wrong class only (WC)
- Full pan/zoom canvas stage with hover zoom lens + annotation detail panel
- SKU reference images per annotation (optional class info CSV)
- Annotation table, direct ShelfWatch viewer link per image

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `s` (or `←`) | Previous image |
| `d` (or double-click) | Reset zoom to 100% (animated) |
| `f` (or `→`) | Next image |
| `1` | Triage pinned annotation: Model error |
| `2` | Triage pinned annotation: Bad GT |
| `3` | Triage pinned annotation: Ambiguous |

Shortcuts are ignored while typing in any filter field. Pressing the same
triage key again clears the status.

## Review workflow features

- **Sticky detail panel** — hovering a box pins its details on the right;
  they stay until you hover a different box (not until the cursor leaves).
- **Triage + remarks** — mark each annotation Model error / Bad GT /
  Ambiguous and add free-text remarks (auto-saved to Supabase). Triaged
  boxes get a colored ✓ badge on the canvas; fully-triaged images get a
  ✓ in the filmstrip and meta pills.
- **Export** — download the currently filtered rows as CSV or Excel,
  including `triage_status` and `remarks` columns.
- **Session resume** — the portal remembers your position per dataset per
  device (a random ID in localStorage — no login). Up to 3 sessions per
  device appear as "Resume where you left off" cards on the home page,
  and reopening a dataset jumps straight back with a toast.
- **Filmstrip** — thumbnails of ±8 surrounding images below the stage;
  click to jump. Doubles as a preloader since thumbs share the cached
  proxied URL with the main stage.
- **Preloading** — the next 3 / previous 2 shelf images and the pinned
  annotation's SKU reference images are prefetched in the background.

## Setup

### 1. Supabase (once)

1. Create a project at https://supabase.com (free tier is fine)
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, run it
   (fresh installs get everything; if you already ran the v1 schema, run
   `supabase/migration_v2.sql` instead — both are safe to re-run)
3. Grab **Project Settings → API → URL** and **anon public key**

### 2. Local run

```bash
cp .env.local.example .env.local   # paste your URL + anon key
npm install
npm run dev                        # http://localhost:3000
```

### 3. Deploy to Vercel

1. Push this folder to a GitHub repo
2. Import the repo at https://vercel.com/new
3. Add the two `NEXT_PUBLIC_SUPABASE_*` env vars in project settings
4. Deploy — done

## Architecture notes

- **CSV parsing is client-side** (PapaParse). Only SKU error rows are
  persisted (`sw_annotations`); the full CSV never leaves the browser.
- **Images are proxied** through `/api/img?u=` server-side — same reason the
  Streamlit version fetched with `requests`: GCS/CDN hosts often block CORS
  or want a browser User-Agent. Responses are cached for 24 h.
- **RLS is open to the anon key** (internal tool). To lock it behind
  Supabase magic-link auth, see the comment at the bottom of
  `supabase/schema.sql`.

## Folder structure

```
shelfwatch-error-portal/
├── app/
│   ├── page.tsx              # dataset library + upload pipeline
│   ├── dataset/[id]/page.tsx # viewer: filters, nav, shortcuts, table
│   ├── api/img/route.ts      # server-side image proxy
│   ├── layout.tsx            # top bar + legend
│   └── globals.css
├── components/
│   ├── CanvasViewer.tsx      # pan/zoom stage, hover lens, animated reset
│   └── InfoPanel.tsx         # annotation details + SKU reference images
├── lib/
│   ├── parse.ts              # df_out / class-info CSV parsing
│   ├── supabase.ts
│   └── types.ts
└── supabase/schema.sql       # run once in Supabase SQL Editor
```
