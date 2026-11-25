# Website guidance

Before changing the website, read [`design.md`](design.md). Treat it as the source of truth for the Wii brand, page composition, typography, glass surfaces, and interaction behavior.

## Website implementation

- Website source lives in this directory and uses React, TypeScript, Tailwind CSS v4, React Router, and Motion (`motion/react`). Keep that stack unless the user asks to change it.
- Reuse the existing design tokens and shared header patterns. Do not introduce fonts, colors, page sections, decorative rules, or animations that conflict with `design.md`.
- Keep the Wii definition card in the shared header only. Do not add another definition block to Vision or Product.
- The Product construction artwork is ASCII symbols that reveal once on entry, then stay still.
- Preserve keyboard access, reduced-motion support, dark mode, and responsive behavior when editing interactions.
- Open the definition card from the Wii wordmark only. Moving into the card keeps it open; moving to Product closes it.
- Keep the custom scroll scrubber large enough to read and interact with. Preserve pointer dragging and keyboard control.
- Keep the home archive images still and source-linked. Store archive metadata in `src/data/` and image assets in `public/images/archive/`.
- Keep the small webcam SVG standing in for the dot of the final “i” of the home wordmark (the last letter is a dotless “ı”). Its accessible control opens a matching glass card about live capture; place it right of the wordmark on desktop and below on narrow screens, clear of the scrubber. Keep this separate from the Draw definition card, and fade the webcam away as the wordmark compacts into the header.
- Keep the home doodle pad local to the browser. The canvas is a full-viewport, edge-to-edge sheet with a compact floating glass toolbar for pen, eraser, color, width, and clear-all. Keep pointer drawing out of React render state, cap the canvas pixel ratio, and preserve strokes through resize.
- When checking visual changes, inspect the relevant route at desktop width and narrow widths, including 320 px where the layout allows it.

## Change discipline

- Prefer small, localized changes that preserve the existing page structure.
- If a visual rule needs to change, update `design.md` in the same change so later work remains consistent.
- Keep interface copy concise, natural, and aligned with the product vision in the repository.
