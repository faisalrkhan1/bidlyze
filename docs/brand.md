# Bidlyze brand (trust upgrade, November 2026)

Status: direction and Logo A approved by Faisal on 22 Nov 2026. Applied on the preview branch `feat/submission-check-beta`; not in production until a release is approved.

## Direction
Bidlyze should look like the documents bid teams already trust: ink, petrol and paper.
- **Evidence first.** Words quoted from a tender or a proposal are set in a serif, like the printed document. A highlighter stroke marks words Bidlyze found word for word on the cited page.
- **One brand colour.** Petrol is for actions, links and the logo.
- **Colour means status.** Red means needs attention, amber means check manually, green means OK. These three colours are not used for anything else.
- **Quiet chrome.** Sentence case, hairline borders, one panel style. No gradients, glows or capitalised eyebrows.

## Logo A, "Evidence b" (approved 22 Nov 2026, final)
A lowercase b on a petrol tile; its bowl holds a highlighted line of text, because
Bidlyze shows the exact words behind every finding.

### Two drawings of one mark
| Drawing | Use at | Why |
|---|---|---|
| **Master** (64-unit grid) | 24 px and up: sidebar, login, landing, report, app icons | Stem and bowl share one baseline; open counter; highlight sits clear of the strokes |
| **Small** (16-unit grid, pixel-fitted) | 16-20 px: favicon, browser tab, dense lists | Every edge on a whole pixel at 16 and 32 px; the highlight is a single pixel row with petrol above and below, so it still reads as a highlighted line |

`LogoMark` switches to the small drawing automatically at 20 px and below. Both drawings
are generated from `brand_final.py` into `app/components/brandPaths.js` (do not edit by hand).

### Colour versions
| Version | Tile | Letter | Highlight | Use |
|---|---|---|---|---|
| Light | petrol 700 `#0E5A6B` | white | `#FFD84D` | On white and paper backgrounds |
| Dark | petrol 500 `#0F7C8F` | white | `#FFD84D` | On ink/navy backgrounds; also the favicon, because it holds contrast in both light (4.9:1) and dark (3.3:1) browser tabs |
| One colour, ink | ink `#0F1B2D` | white | white | Black-and-white print, fax, stamps |
| One colour, reversed | white | ink | ink | On a dark photo or dark brand panel where petrol is not possible |

White on petrol 500 is 4.9:1 and on petrol 700 is 7.4:1 (WCAG AA for the letter).

### Lockup
- Mark plus wordmark. The gap is 1/4 of the mark, and the wordmark cap height is 45% of the mark.
- The wordmark is Public Sans SemiBold, outlined, ink on light and `#F1F5F9` on dark.
- Use the mark alone below 20 px lockup height, for example in favicons, avatars and narrow mobile headers.
- Clear space: half the tile on every side. Minimum sizes: mark 16 px, lockup 20 px high.

### Files (`public/brand/` and `app/`)
- **Lockups:**
  - `bidlyze-logo-light.svg` and `-dark.svg`;
  - `-mono-ink.svg` and `-mono-white.svg`;
  - PNG versions of the light and dark lockups at 480 px wide.
- **Marks:**
  - `bidlyze-mark.svg`, `-dark.svg`, `-mono.svg`;
  - `-small.svg` (pixel-fitted);
  - `-maskable.svg` (Android: the b sits inside the central 80%);
  - PNG versions at 192 and 512 px.
- **Wordmarks:** `bidlyze-wordmark-ink.svg` and `-white.svg`.
- **Browser and app icons:**
  - `app/icon.svg` (small drawing);
  - `app/favicon.ico` (16 and 32 px small drawing, 48 px master);
  - `app/apple-icon.png` (180 px, full bleed; iOS rounds the corners);
  - `app/manifest.js`.
- **Report:** `lib/submission/reportLogo.js` holds the light lockup PNG, 96 px high, used in the Excel report header.

### Do not
- Recolour the highlight. Yellow is the only accent in the mark and means "verified words".
- Put the mark on a photo, add a shadow or glow, outline the tile, or rotate it.
- Set the wordmark in another font, track it out, or put it in capitals.
- Use the master drawing below 24 px or the small drawing above 32 px.

Directions B ("Matched pages") and C ("Bracketed check") were not chosen. They remain on the design board for reference.

## Tokens (`app/globals.css`)
| Role | Light | Dark |
|---|---|---|
| Ink (text) | `#0F1B2D` | `#E8EDF4` |
| Secondary text | `#475467` | `#A6B1C2` |
| Page | `#F5F7FA` | `#0B111A` |
| Panel | `#FFFFFF` | `#121B28` |
| Line | `#E3E8EF` | `#1D2939` |
| Petrol (actions) | `#0F7C8F` | `#1A8FA2` |
| Needs attention | `#B42318` on `#FEF3F2` | `#FB7A6C` |
| Check manually | `#B54708` on `#FFFAEB` | `#FDB022` |
| OK | `#067647` on `#ECFDF3` | `#47CD89` |
| Highlighter | `#FFE58A` | `rgba(255,216,77,.26)` |

The existing `emerald-*` Tailwind classes are mapped to petrol (`@theme inline`), so the whole app follows the brand colour.

## Type
- **Public Sans** (variable, SIL OFL) for the interface. Scale:
  - page title 26/32 semibold;
  - section 20/28;
  - panel title 16/24;
  - body 14/22;
  - small 13/20;
  - label 12/16.
  - Use tabular figures for counts.
- **Source Serif 4** (variable, SIL OFL) is used only for quoted document text, at 15/24.
- Both are served from `app/fonts/`, so there are no Google Fonts requests.

## Space and shape
- Spacing uses a 4 px base: 4, 8, 12, 16, 20, 24, 32, 40.
- Radius: panels 12, controls 8, labels 6.
- Borders are 1 px hairlines. Shadows appear only on overlays.
- Content width is 1080 px, left aligned.
- Motion only answers an action.

## Not yet updated
- Transactional e-mails (`lib/email.js`) still use the old emerald.
- The tender PDF export (`app/utils/exportPDF.js`) already uses navy and teal.
- The landing page and dashboard use the new fonts, colours and logo. Their layout is unchanged.
