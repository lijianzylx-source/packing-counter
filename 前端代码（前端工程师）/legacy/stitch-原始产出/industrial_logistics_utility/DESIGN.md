---
name: Industrial Logistics Utility
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444653'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3755c3'
  primary: '#00288e'
  on-primary: '#ffffff'
  primary-container: '#1e40af'
  on-primary-container: '#a8b8ff'
  inverse-primary: '#b8c4ff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#532a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#743d00'
  on-tertiary-container: '#ffa85d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#173bab'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  surface-bg: '#F8FAFC'
  surface-card: '#FFFFFF'
  surface-elevated: '#F1F5F9'
  income-amber: '#F59E0B'
  income-amber-deep: '#B45309'
  status-connected: '#10B981'
  status-warning: '#F59E0B'
  status-error: '#EF4444'
  border-subtle: '#E2E8F0'
  border-strong: '#CBD5E1'
  text-display: '#0F172A'
  text-muted: '#64748B'
typography:
  display-income:
    fontFamily: JetBrains Mono
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-income-mobile:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-data-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  label-data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  label-ui:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for industrial pragmatism, optimized for warehouse packers and cross-border ecommerce logistics operators working in high-intensity, repetitive environments. The visual tone balances industrial precision with crisp digital efficiency. It eliminates visual noise, decorative fluff, and distracting modals in favor of immediate affordance, oversized tactile targets, and unambiguous numeric visibility.

The primary design movement is **Modern Industrial Pragmatism** paired with functional minimalism. Core tenets include:
- **Instant Glanceability**: Numeric output (parcel counts, accumulated piece-rate pay) is legible from an arm's length under varying warehouse lighting.
- **Inline Non-Intrusive Workflow**: Critical alerts and row edits happen strictly in place; modal interruptions and screen takeovers are forbidden.
- **Physical-Touch Ergonomics**: Massive tap targets (minimum 48px to 56px heights), robust contrast ratios meeting WCAG AAA for numeric readouts, and haptic-friendly tap states accommodate gloved or single-handed thumb operation.

## Colors

The palette is tuned for high functional differentiation under mobile glare and industrial fluorescent fixtures.

- **Primary Logistics Blue (`#1E40AF`) & Electric Blue (`#2563EB`)**: Anchor operational inputs, primary commit buttons, and verified system states. They communicate reliability, systematic precision, and stability.
- **Accent Settlement Amber (`#F59E0B` / `#D97706`)**: Reserved specifically for transactional figures, piece-rate earnings, and metric milestones. Amber draws instant peripheral attention without communicating critical system failure.
- **Neutral Structure (`#F8FAFC` background, `#FFFFFF` surface, `#0F172A` text)**: Maintains an ultra-clean base. Deep slate text (`#0F172A`) against stark white and slate-50 ensures maximum typographic readability.
- **Semantic Indicators**:
  - `status-connected` (`#10B981`): Hardware/PWA sync online.
  - `status-warning` (`#F59E0B`): Network latency or local-only caching.
  - `status-error` (`#EF4444`): Inline field blocks, validation halts, and inline alert containers.

## Typography

Typography establishes an uncompromising data hierarchy:
- **Display and Numeric Metrics (`JetBrains Mono`)**: All tabular counts, parcel amounts, times, and dynamic remuneration use monospaced glyphs to prevent digit jumping during rapid keystrokes or tally increments.
- **Section Headers and Titles (`Space Grotesk`)**: Provides an authoritative, technical, industrial feel for dates, shift overviews, and module containers.
- **Operational Copy and Controls (`Inter`)**: Delivers neutral, highly legible legibility for inputs, button labels, and system status indicators.

Numeric tokens adapt smoothly between responsive handheld views and desktop packing terminals to protect single-hand ergonomics.

## Layout & Spacing

The layout is built mobile-first around rapid thumb reach and vertical scanning.

- **Grid Architecture**: Mobile view utilizes a single-column fluid card stack bounded by a maximum reading width of 480px centered on screen. On desktop packing stations (`>=1024px`), it shifts to a 12-column layout with a dual-pane distribution (input workstation on the left, daily log and audit analytics on the right).
- **Thumb Zone Optimization**: Primary tally entry points, quick-add buttons (+1, +5, +10, +50), and submission bars stay anchored within the bottom 45% of the mobile viewport.
- **Rhythm**: Element padding enforces comfortable physical contact areas. Touch items never drop below 48px in height, with standard form fields and primary execution actions standardized at 56px.

## Elevation & Depth

This system intentionally departs from float-heavy, layered abstractions to prevent cognitive friction during high-speed warehouse work:

- **Flat Surface Structuring**: Separation of content relies on 1px structural outlines (`#E2E8F0` / `#CBD5E1`) and background shifts (`#F8FAFC` to `#FFFFFF`) rather than multi-layered drop shadows.
- **Zero Modal Policy**: Modals, drawer popovers, and floating toast notifications are avoided. System warnings, field validation, and network status render as structural inline banners or framed error boxes. Editing a past record triggers an inline row expansion directly inside the list.
- **Active State Depth**: Interactive buttons utilize an inset border or micro-translate (1px downward) rather than heavy atmospheric elevation, mimicking the physical response of warehouse scanning hardware.

## Shapes

The interface embraces a compact, semi-rectilinear industrial style (Soft, level `1`):
- **Base Geometry**: Standard inputs, alert blocks, and cards use a disciplined `4px` (`0.25rem`) radius. This retains a rugged, tool-like silhouette while avoiding clinical sharpness.
- **Buttons and Selectors**: Inputs, action triggers, and inline buttons use `6px` to `8px` corner radiuses for tactile comfort.
- **Status Badges & Indicator Dots**: Micro-indicators (e.g. server ping indicators) are strict 8px circles (`full` roundness) positioned inline next to descriptive text labels.

## Components

### Buttons & Quick Tally Controls
- **Primary Action**: Full-width on mobile (56px height), background `#1E40AF`, hover/active `#1E3A8A`, high-contrast white text (`#FFFFFF`, Inter SemiBold 16px).
- **Secondary / Quick-Add Increments**: Segmented touch keys (`+1`, `+5`, `+10`, `+50`) styled with `#FFFFFF` background, 1.5px border `#CBD5E1`, dark text `#0F172A`, font `JetBrains Mono` 16px. Active state toggles to `#F1F5F9`.
- **Inline Row Actions**: Compact 32px height buttons (e.g., "改" / Edit, "存" / Save) placed within list rows, framed in `#E2E8F0` borders.

### Input Fields & Numeric Pad Integration
- **Parcel Count Input**: 56px height minimum, background `#FFFFFF`, border 2px solid `#CBD5E1`. On focus, border transitions to `#2563EB` with zero blur halo. Text is styled in `JetBrains Mono` 28px bold.
- **Keypad Assistance**: Optimized for direct hardware keyboard focus or full-width on-screen keypad triggers with generous 12px internal padding.

### Metric & Settlement Cards
- **Daily Earnings Summary Card**: Background `#FFFFFF`, border 1px solid `#E2E8F0`, 16px padding.
- **Amount Highlight**: Prominent settlement amount in `JetBrains Mono` bold (accent `#D97706`), paired with a dynamic unit suffix (`元`). Real-time computation re-renders with zero perceptible delay.

### Status Indicators & Inline Alert Boxes
- **Server Health Dot**: 8px circular badge placed at the screen base paired with descriptive label ("绿点＝已连接", "黄点＝离线缓存/不可用"). Never relies on color alone; always accompanies text.
- **Error Callouts**: Inline boxes framed with a solid 1.5px border `#EF4444`, background `#FEF2F2`, text `#991B1B`. Positioned directly above the action button without obscuring form fields.

### Log Records & Inline Expandable Rows
- **List Structure**: Dense, high-contrast rows bounded by 1px bottom borders (`#E2E8F0`).
- **Inline Editing Mode**: Tapping "改" expands the row container downward, swapping static text with an inline numeric input and immediate "确认 / 取消" buttons without opening a secondary dialog or route.