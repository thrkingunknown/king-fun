# KING-FUN UI architecture and design system

**Status:** Shared visual system and component architecture implemented in source. Automated browser acceptance is defined in Playwright; run it on the target device/browser matrix before release.

## Product direction

KING-FUN uses a controlled arcade/editorial visual language: high-contrast typography, quiet layered surfaces, restrained lime accent, game-specific secondary accents, crisp component borders, and motion that communicates state. The interface is deliberately more product-like than a generic admin dashboard: strong game identity on the library, structured setup workspaces, calm preference panels, and focused gameplay stages. Icons are Lucide React SVGs accessed through the typed `Icon` registry; visible interface controls do not use emoji or Unicode symbol substitutes.

## Responsive layout contract

- Shared workspaces use a 12-column CSS Grid (`.kf-grid`) with explicit `.kf-span-1` through `.kf-span-12` span utilities.
- The game library uses a 12-column responsive grid, with four equal cards on large screens, two cards per row at mobile/tablet widths where space allows, and a single-column fallback at very narrow widths.
- Game setup uses a 7-column configuration region and 5-column sticky summary on wide screens. At 800px and below, both become full-width rows; the sticky summary is no longer allowed to compress the controls.
- Settings use a 12-column grid with six-column cards on wide screens, then full-width cards on tablet and phone layouts. Provider rows, form fields, and status controls are constrained to their card track to prevent horizontal overflow.
- The layout is tested for horizontal overflow at 320, 360, 390, 620, 768, 1024, and 1440 CSS pixels. Breakpoint behavior is based on available layout width, not device identity.
- Controls respect safe-area insets and retain comfortable touch targets; icon-only controls have accessible names.

## Theme and design tokens

`AppShell` owns the persisted `Save.theme` preference and mirrors it to `document.documentElement.dataset.theme`. `design-system.css` defines the semantic palette and component tokens: background, panel levels, text, muted text, border, accent, radius, shadow, spacing, and motion. The `.app.light` theme overrides surfaces and text tokens instead of applying a global inversion. Theme changes never mutate active game or persisted gameplay state.

Test home, setup, gameplay, history, settings, dialogs, inputs, status banners, and both wheels in dark and light appearance. The header switch and Settings switch must remain synchronized, immediately update `data-theme`/`color-scheme` and browser theme colour, and survive reload through the IndexedDB save.

## Shared component system

| Component | Implementation | Responsibility | State ownership boundary |
|---|---|---|---|
| `Icon` / `GameMark` | `lucide-react` registry | Consistent named SVG and game identity | No navigation or game state |
| `Button` | Base UI + CVA + `clsx`/`tailwind-merge` | Reusable button variants and sizing | Caller owns action and disabled state |
| `ToggleSwitch` | Native button with `role="switch"` | Accessible persistent preference control | Caller owns checked value and update callback |
| `StatusPanel` | First-party semantic surface | Status, warning, error, and recovery feedback | Caller owns status and recovery action |
| `ChoiceButton` | First-party selection control | Single choice in a game/configuration step | Caller owns selection |
| `ProgressBar` / `CountdownDisplay` | First-party semantic indicators | Progress and time feedback | Caller supplies progress/deadline |
| `PromptCard` / reaction controls | First-party gameplay components | Prompt presentation and reactions | Domain owns prompt selection and repeat policy |
| `ConfirmDialog` / `PromptReportDialog` | Native modal dialog | Confirmation and report flows | Caller owns policy and action |
| `SortableProviderRow` | Native HTML drag/drop + accessible Move up / Move down buttons | Pointer and keyboard provider reorder; direct named `role="switch"` grid item | Settings screen owns persisted order and enabled state |
| `SpinWheel` | Shared CSS/conic-gradient renderer | Equal radial sectors, larger labels aligned to each spoke, pointer, hub and spin animation | Caller owns segment data, selected outcome, angle and persistence |
| `CommandPalette` | cmdk inside native dialog | Keyboard-first navigation and game launch | Shell owns navigation and launch actions |

New game modes should compose shared components and add domain behavior in `frontend/src/domain/games/`. Do not copy wheel, prompt, dialog, status, settings-toggle, or player-list implementations into each screen.

## Package adoption policy

The installed ecosystem is a toolkit, not a requirement to import every package into every screen. The active application uses Tailwind CSS 4 via the Vite plugin; shadcn's Base UI component foundation; CVA, `clsx`, and `tailwind-merge`; Lucide React; CSS-owned shell and home transitions; first-party toast feedback; cmdk for the command palette; native HTML drag/drop plus accessible keyboard move buttons for provider ordering; React Hook Form + Zod for player input validation; React Dropzone for custom-pack import; AutoAnimate for setup list changes; TanStack Query for gateway status; date-fns for history formatting; fast-check for property tests; Playwright and axe for browser/a11y tests; and Storybook for component review. Motion, Sonner, and dnd-kit remain in the dependency manifest but are not imported by the current application source; do not reintroduce them into the initial route without a measured need and a regenerated Bun lockfile.

Other installed packages remain feature-scoped until there is a specific product requirement: PixiJS / `@pixi/react` for 2D scenes; Three.js / React Three Fiber for 3D scenes; Rapier or Matter for physics; Rive or Lottie for authored motion; GSAP for timeline-heavy sequences; Howler for audio; Embla for carousels; Floating UI for anchored popovers; Dexie for a future IndexedDB abstraction only after the existing storage layer is audited; and Sentry / Web Vitals for a deployment-approved monitoring configuration. These packages must not be imported by the shared app shell merely because they are installed. Keep heavyweight scenes dynamically imported and game-specific. Do not run multiple physics or animation engines on the same element.

Radix UI remains available as a compatible primitive option, but the current shadcn preset is Base UI; do not mix Radix and Base UI versions of the same component. Likewise, Motion and GSAP are complementary only when assigned distinct jobs.

## Ambient scene and interaction

`frontend/src/components/ui/AmbientBackground.tsx` renders a decorative projected-3D wire sculpture on a capped-DPR Canvas 2D surface. Its sphere mesh is rotated in 3D space and perspective-projected; pointer position steers the rotation, nearby nodes brighten, and pointer presses on non-controls emit brief ripples. The E2E-visible interaction counter confirms pointer input reached the scene without making the decorative canvas interactive to assistive technology. The scene is capped at 30fps, suspends when the document is hidden, and does not intercept input. A separate labelled header control pauses/resumes it. The browser's reduced-motion setting and the saved in-app reduced-motion preference both pause the renderer. The scene has no external runtime or dependency and does not own gameplay state.

The visual refresh is layered in `frontend/src/visual-refresh.css` after the shared component tokens. Keep new overrides in this layer rather than growing another conflicting base stylesheet. Verify both theme palettes, narrow viewport header fit, and reduced-motion behavior when changing shared components.

## Gameplay transitions and motion

- CSS owns shell/home transitions and simple interaction states; these remain suppressible by `prefers-reduced-motion` without loading a JS animation runtime.
- AutoAnimate is reserved for setup player/content-pack list insertions and removals.
- `SpinWheel` is the presentation primitive reused by the player and Truth/Dare wheel adapters. It owns no selection or persistence logic; callers provide validated segments and committed angles. Labels follow each sector radius, with responsive sizing and a shared pointer/hub/caption.
- CSS handles wheel rotations and simple component states. The result is committed by domain logic before animation begins.
- The Truth or Dare `spin-wheel` mode intentionally uses two independent outcomes: player selection first, then a challenge wheel with eight equal sectors (four Truth, four Dare). The player and challenge wheels both render through `SpinWheel`.
- `prefers-reduced-motion` and the user-selected reduced-motion preference suppress decorative transitions without changing game outcomes.

## Accessibility and quality gates

- Use semantic landmarks, visible focus, keyboard navigation, descriptive names, and 44px targets where practical.
- Switches expose `role="switch"`, `aria-checked`, and linked labels/descriptions.
- Provider rows use a native draggable handle plus explicit Move up / Move down buttons. The provider identity has its own flexible grid track; the compact enabled switch is a direct grid item with an accessible name referencing visible provider and ON/OFF text.
- The command palette opens with Ctrl/Cmd+K and does not hijack text-entry fields.
- Dialogs use native modal semantics and close predictably via Escape/backdrop.
- Automated browser tests cover responsive overflow, player input, theme switches, command palette, and serious/critical axe violations. Manual screen-reader, reduced-motion, touch, and real-device checks remain required.

## Component documentation standard

Reusable components should briefly document what they render, which state they own, what their caller owns, and their intended reuse boundary. Keep game rules, secure randomness, content selection, and persistence outside presentation components.


## Ambient scene lifecycle (2026-11-07)

`AmbientBackground` keeps React's responsibility limited to the canvas ref and the `paused` prop. Its effect mounts the module-level `mountAmbientScene` imperative renderer, which owns dimensions, pointer/ripple state, animation-frame IDs, and drawing operations in a renderer-local closure outside the component render lifecycle. The 2D context is obtained once, checked for `null`, and then bound to an explicit `CanvasRenderingContext2D` type before nested callbacks use it. Cleanup cancels the pending animation frame and removes all global listeners; it does not maintain a mutable render-lifetime flag or mutate component-owned values. This keeps the renderer within React Compiler's immutability constraints while preserving visibility and reduced-motion suspension.
