# PocketLedger design system

Fallback design direction from the ui-ux-pro-max checklist (the local search script requires Python, which was unavailable).

- Product: trustworthy personal-finance dashboard; clean, calm, Thai-first.
- Color: warm neutral canvas, deep brown text, emerald primary, amber warning, red destructive. Never use color without text or an icon.
- Type: Noto Sans Thai, 16px base, tabular figures where useful, 1.5 body line-height.
- Shape: 14px controls and 16px cards; light borders rather than heavy shadows.
- Interaction: minimum 44×44px touch target, visible focus, keyboard-operable controls, reduced clutter on mobile.
- Layout: mobile-first; bottom navigation on small screens, fixed sidebar on desktop, no horizontal page scrolling (tables scroll inside their container).
- Data: totals distinguish current balance from selected-period statistics; every computed amount explains its formula nearby.
- Motion: functional transitions only; respect `prefers-reduced-motion`.
