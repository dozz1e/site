# Scroll-reveal ease-in per section

## Goal
Every `<section>` on every page fades in (opacity + slide-up) as it enters the viewport while scrolling.

## Scope
All pages: home, categorías, contacto, and all 37 course detail pages. No page or component files are touched individually — the effect is applied globally from `BaseLayout.astro`, which every page route wraps.

## Behavior
- **Trigger**: IntersectionObserver, fires once per section the first time it enters the viewport (threshold ~0.15).
- **Style**: `opacity: 0 → 1` and `transform: translateY(20px) → translateY(0)`, `0.6s ease-out`.
- **Once only**: after a section animates in, it stays visible; scrolling back up and down again does not re-trigger it (observer unobserves after first reveal).
- **Selector**: `main section` — covers `home-hero`, `home-accreditations`, `home-areas`, etc. on the homepage; `catalog-hero`, `filterbar`, each `course-group`, `help` on `/categorias/`; `catalog-hero`/`detail-section` on `/contacto/`; `detail-hero`, `FactsBar`, `IntroSection`, `ScheduleGrid`, `TeacherCard`, `IncludeSection`, `Accreditation`, `Testimonial`, `PriceSection` on course detail pages. `WhatsAppAdvisor` lives outside `<main>` and is unaffected.
- **Accessibility**: `prefers-reduced-motion: reduce` disables the animation entirely — sections render at full opacity/position immediately, no transition.
- **Progressive enhancement**: sections are visible by default in plain CSS/HTML. The "hidden, waiting to reveal" state is only applied via a JS-added class, so if JS fails or is disabled, all content stays visible — nothing is ever hidden by a no-JS user.

## Implementation
- CSS added to `BaseLayout.astro`'s global styles (or existing global stylesheet): `.reveal-init` (pre-reveal state) and `.reveal-in` (revealed state), plus a `prefers-reduced-motion` override.
- A small inline `<script>` in `BaseLayout.astro` (runs on every page since every page uses this layout):
  1. On DOM ready, select `main section`.
  2. If `matchMedia('(prefers-reduced-motion: reduce)').matches`, skip entirely (leave sections as normal, no class added).
  3. Otherwise add `.reveal-init` to each section, then observe each with an `IntersectionObserver`; on intersect, add `.reveal-in` and unobserve.

## Out of scope
- No per-section opt-out mechanism (not requested; can add a `.no-reveal` escape hatch later if a section needs to be excluded).
- No stagger/delay between elements inside a section — the whole section fades as one unit.
- Not applied to the `WhatsAppAdvisor` modal or other elements outside `<main>`.

## Testing
- `astro check` (type check) must stay clean.
- `npm test` must stay green (no test touches layout/CSS/script, so unaffected).
- `npm run build` must complete for all 40 pages.
- Manual verification: open home page and a course page in the browser, scroll, confirm sections fade+slide in once each; confirm no flash-of-hidden-content; confirm reduced-motion setting disables it.
