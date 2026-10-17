# CarbonLedger Design System Specification (Frontend)

CarbonLedger is an industrial carbon accounting platform for Indian steel (induction furnace route) manufacturers preparing EU Carbon Border Adjustment Mechanism (CBAM) embedded emissions filings.

This document details the visual direction, design tokens, component patterns, page maps, future backend API integration, accessibility criteria, and design dos/don'ts.

---

## 1. Visual Direction & Principles

- **Visual Inspiration**: Clean, editorial green aesthetic inspired by Cartilyzer.
- **Tone**: Authoritative, industrial-grade, auditable, high-clarity.
- **Layout Architecture**: White backdrop canvas, inset dark-green gradient hero panels with rounded corners (~28px), floating product dashboard mockups, horizontal icon process flow with arrows, pill-shaped controls, and mint-tinted data cards.
- **Hero Number Priority**: The specific embedded emissions ($t\text{CO}_2e$ per metric tonne of steel) is the single most vital metric EU buyers require under CBAM Regulation 2023/956; it is treated as the primary hero figure throughout the UI.

---

## 2. Design Tokens (`:root` in `index.css`)

### Color Palette

| Token | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `--forest-900` | `#08281D` | Deep forest green. Hero background top/base, header branding, primary pill buttons, dark panels. |
| `--forest-700` | `#0F5A3F` | Mid forest green. Gradient midpoint, button hover states, emphasis borders. |
| `--green-500` | `#1F8A5B` | Vibrant emerald green. Hero glowing bottom center, active focus rings, positive callouts. |
| `--mint-100` | `#D7F2E3` | Fresh mint accent. Icon tiles, status pills, table tags, active progress fills. |
| `--mint-50` | `#EEF9F3` | Soft mint tint. Live preview cards, active step highlights, table hover states. |
| `--ink` | `#0C1F17` | Near-black with subtle forest undertone. Primary high-contrast text. |
| `--muted` | `#5F6F66` | Neutral olive-slate. Subtitles, labels, descriptions, helper hints. |
| `--line` | `#E3EAE5` | Soft structural borders, divider lines, table row dividers. |
| `--surface` | `#FFFFFF` | Pure white background for page cards, mock dashboard window, input fields. |
| `--canvas` | `#F4F7F5` | Off-white neutral background for setup page canvas, metric cards, drag & drop zones. |

### Supporting Status Colors
- Warning / Scope 1: `#EAB308` (amber) & `#FEF3C7` / `#92400E` (pending/sample badge).
- Critical / Flagged: `#FEE2E2` / `#991B1B` (discrepancy pill).
- Success / Live factor: `#4ADE80` (pulsing indicator).

---

## 3. Typography Scale

- **Heading Font**: `"Bricolage Grotesque"`, weights `700`, `800`.
  - Loaded via Google Fonts.
  - Used for titles, section headers, hero titles, big metric values.
  - Sentence case everywhere across all pages **except** the hero headline on Landing, which is set in bold uppercase as per reference specification.
- **Body Font**: `"Instrument Sans"`, weights `400`, `500`, `600`, `700`.
  - High readability for technical specifications, form labels, and table cells.
- **Monospace Font**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`.
  - Applied to emission coefficients, hash IDs, kWh values, and metric numbers.

### Type Scale

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| Hero Headline | `clamp(2.1rem, 4.8vw, 3.8rem)` | 800 | 1.06 | Landing page hero (`UPPERCASE`) |
| Hero Metric Number | `clamp(3.2rem, 6vw, 4.8rem)` | 800 | 1.0 | Results page hero number |
| Section Title (`h2`) | `clamp(1.75rem, 3.2vw, 2.5rem)` | 800 | 1.15 | Section 2 & 3 titles |
| Card Title (`h3`) | `1.25rem - 1.5rem` | 800 | 1.2 | Step cards, form cards |
| Subtitle / Lead Body | `1.0625rem - 1.1875rem` | 400 / 500 | 1.55 | Hero subtext, section intro |
| Regular Body | `0.9375rem` (15px) | 400 / 500 | 1.5 | General UI body text |
| Form Labels / Headers | `0.84375rem` (13.5px) | 600 | 1.4 | Form pill labels, step titles |
| Small / Captions | `0.6875rem - 0.75rem` | 600 / 700 | 1.4 | Badges, footnotes, table metadata |

---

## 4. Spacing, Radii & Shadows

### Radii
- **Pills**: `999px` (`--radius-pill`) — All buttons, status chips, search/filter badges, stepper navigation tags.
- **Cards**: `20px` (`--radius-card`) — Content panels, preview cards, glossary tiles.
- **Hero & Feature Panels**: `28px` (`--radius-panel`) — Inset rounded dark-green hero containers.
- **Micro Radii**: `8px` - `14px` — Table containers, icon backgrounds, small status chips.

### Shadows (Soft Green-Tinted)
- `--shadow-sm`: `0 2px 6px -1px rgba(8, 40, 29, 0.05), 0 1px 3px -1px rgba(8, 40, 29, 0.03)`
- `--shadow-md`: `0 10px 25px -4px rgba(8, 40, 29, 0.07), 0 4px 10px -2px rgba(8, 40, 29, 0.04)`
- `--shadow-lg`: `0 20px 40px -8px rgba(8, 40, 29, 0.12), 0 6px 16px -4px rgba(8, 40, 29, 0.06)`

---

## 5. UI Component Patterns

### Buttons
1. **Solid Primary Pill**:
   - Class: `.pill-button.pill-button-primary`
   - Background: `--forest-900`, text: `--surface`, hover: `--forest-700`.
   - Used for main calls to action ("Start your audit", "Save company details").
2. **Solid White Pill (Hero Context)**:
   - Class: `.pill-button.pill-button-white`
   - Background: `#FFFFFF`, text: `--forest-900`, hover: `--mint-50`.
3. **Translucent Hero Pill**:
   - Class: `.pill-button.pill-button-translucent`
   - Background: `rgba(255, 255, 255, 0.12)`, border: `1px solid rgba(255, 255, 255, 0.24)`.
4. **Secondary Mint Pill**:
   - Class: `.pill-button.pill-button-secondary`
   - Background: `--mint-50`, text: `--forest-900`, border: `--mint-100`.
5. **Disabled Pill**:
   - Class: `.pill-button-disabled`
   - Background: `--line`, color: `--muted`, cursor: `not-allowed`, `pointer-events: none`.

### Form Inputs & Dropzones
- **Pill Inputs**:
  - Class: `.pill-input`
  - Border radius: `999px`, border: `1.5px solid var(--line)`, background: `--surface`.
  - Focus state: border `--forest-700` with `3px` ring of `--mint-100`.
- **Drag & Drop File Field**:
  - Class: `.pill-upload-dropzone`
  - Rounded `20px` card with `2px dashed var(--line)`, hover state turns `--mint-50` with `--green-500` border.

### Live Preview Mint Card
- Class: `.mint-preview-card`
- Background: `--mint-50`, border: `1px solid var(--mint-100)`, radius: `20px`.
- Renders company legal title, state, declared production, electricity usage, and verification state in real time.

### Tables & Data Grids
- Class: `.source-table` within `.table-responsive-wrapper`.
- Clean uppercase table headers with subtle bottom border.
- Hover row state with soft mint highlight (`--mint-50`).
- Monospace styling for all raw figures and factors.

---

## 6. Page Map & Backend Integration Roadmap

The application utilizes a lightweight hash router (`#/`, `#/setup`, `#/results`). The table below outlines how each view connects to the backend API services:

| Page / Route | Primary Actions / Features | Backend Endpoint | Method | Payload / Response |
| :--- | :--- | :--- | :--- | :--- |
| **Landing (`#/`)** | Overview, flow explanation, sample data demonstration, glossary | None (Static) | — | Client-side render |
| **Setup (`#/setup`) - Step 1** | Save plant profile (name, state, roof area, demand MVA, tariff) | `/api/firms` | `POST` | `{"name": str, "state": str, "roof_area_sqm": float, "contracted_demand_mva": float, "tariff_category": str}` |
| **Setup (`#/setup`) - Step 2** | Define reporting window & production tonnage | `/api/reporting-periods` | `POST` | `{"firm_id": str, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "production_tonnes": float}` |
| **Setup (`#/setup`) - Step 3** | Upload electricity DISCOM bill / diesel invoice | `/api/documents/upload` | `POST` (multipart) | `FormData: { file: File, document_type: "electricity_bill" }` |
| **Setup (`#/setup`) - Step 3** | Human sign-off / confirm extracted kWh data | `/api/activity/{activity_id}/verify` | `PUT` | `{"status": "confirmed", "corrected_value": float, "verified_by": str}` |
| **Setup (`#/setup`) - Step 4** | Sync CEA Regional Grid Factor baseline | `/api/evidence/sync` | `POST` | `{"state": str, "grid_region": "Northern/Western/Eastern", "baseline_version": "v20"}` |
| **Setup / Results** | Calculate emissions & specific embedded value | `/api/reports/calculate/{period_id}` | `POST` | Computes Scope 1, Scope 2, Precursor, and $t\text{CO}_2e/t$ steel |
| **Results (`#/results`)** | Download CBAM XML / PDF declaration sheet | `/api/reports/export/{period_id}` | `POST` | Returns official CBAM communication package |

---

## 7. Accessibility & Usability Standards

1. **Semantic HTML**: Proper `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<aside>`, and `<table scope="col">` landmark elements.
2. **Accessible Labels**: Every `<input>`, `<select>`, and file input is tied to a corresponding `<label htmlFor="...">`.
3. **Keyboard Focus**: Prominent `:focus-visible` styling (`outline: 2px solid var(--green-500); outline-offset: 3px`).
4. **Color Contrast**: All primary text maintains WCAG AAA/AA compliance (white on `--forest-900`, `--ink` on white/canvas).
5. **Reduced Motion**: Wrapped with `@media (prefers-reduced-motion: reduce)` to disable transitions and smooth scrolling for sensitive users.
6. **Mobile Adaptability**: Responsive down to 360px viewport width using CSS grid wrapping, stacking panels, and dynamic typography clamping (`clamp()`).

---

## 8. Design Dos and Don'ts

### Dos
- ✅ **DO** clearly mark all demonstration numbers as sample data using the badge `"Sample data, not your figures"`.
- ✅ **DO** keep the specific embedded emissions ($t\text{CO}_2e/t$) as the most prominent metric.
- ✅ **DO** use pill buttons (`border-radius: 999px`) for all action triggers.
- ✅ **DO** keep the hero headline strictly uppercase on the Landing page hero as specified in the Cartilyzer reference design.
- ✅ **DO** ensure the What-If renewable slider recalculates Scope 2 and specific emissions live without page reloads.

### Don'ts
- ❌ **DON'T** invent fake emission factors or claim data is officially verified by an external verifier without user confirmation.
- ❌ **DON'T** add heavy external dependencies like Tailwind, Bootstrap, or Material UI.
- ❌ **DON'T** modify or delete any existing logic, state variables, or validation handlers in the Setup workflow.
- ❌ **DON'T** make the hero background flat black or grey; always maintain the deep forest-to-glowing-green radial gradient.
- ❌ **DON'T** enable the "Download draft report" button until the backend export endpoint is formally connected.
