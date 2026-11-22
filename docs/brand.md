# Bidlyze brand (trust upgrade, November 2026)

Status: proposed and applied on the preview branch `feat/submission-check-beta`. Not in production until approved.

## Direction
Bidlyze should look like the documents bid teams already trust: ink, petrol and paper.
- **Evidence first.** Words quoted from a tender or a proposal are set in a serif, like the printed document. A highlighter stroke marks words Bidlyze found word for word on the cited page.
- **One brand colour.** Petrol is for actions, links and the logo.
- **Colour means status.** Red means needs attention, amber means check manually, green means OK. These three colours are not used for anything else.
- **Quiet chrome.** Sentence case, hairline borders, one panel style. No gradients, glows or capitalised eyebrows.

## Logo: direction A, "Evidence b"
A lowercase b on a petrol tile; its bowl holds a highlighted line of text.
- **Components:** `app/components/Logo.js` provides `LogoMark`, `LogoWordmark` and `LogoFull`. The wordmark is outlined Public Sans SemiBold, generated into `brandPaths.js`.
- **Files:** `public/brand/`
  - `bidlyze-logo-light.svg` and `-dark.svg`
  - `bidlyze-mark.svg` and `-dark.svg`
  - `bidlyze-wordmark-ink.svg` and `-white.svg`
  - PNG marks at 192 and 512 px
- **Favicon and app icon:** `app/icon.svg` and `app/apple-icon.png`.
- **Excel report header:** `lib/submission/reportLogo.js`.
- **Tile colour:**
  - petrol 700 `#0E5A6B` on light backgrounds;
  - petrol 500 `#0F7C8F` on dark backgrounds (the CSS variable `--logo-tile`);
  - highlight `#FFD84D`.
- Clear space is half the tile on every side. Minimum size is 16 px for the mark and 20 px high for the lockup.
- Do not recolour the highlight, put the mark on a photo, or set the wordmark in another font.
- Directions B ("Matched pages") and C ("Bracketed check") are on the design board as alternatives.

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
