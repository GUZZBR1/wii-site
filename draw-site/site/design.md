# Wii — Design System

This file is the visual source of truth for the Wii website. Keep new pages and changes aligned with these decisions.

## Brand

Wii is a browser arcade arena where the body is the controller: running and tennis played by pose through the webcam. The site should feel thoughtful, precise, calm, and ambitious: editorial typography over a light interface that borrows the Wii’s white and blue (Frutiger Aero, used with restraint on the site and fully in the arena).

## Color and surfaces

### Palette

| Role | Light | Dark | Source |
| --- | --- | --- | --- |
| Canvas | `#f4f8fa` | `#1b1c19` | `--paper` |
| Ink | `#05090c` | `#f2f1ec` | `--ink` |
| Muted text (high contrast, by request) | `#1f2a32` | `#a3a49b` | `--muted` |
| Accent: highlights and interaction feedback, used sparingly | `#ade4f8` | `#8e916e` | `--accent` |
| Wii blue: glass edges, button borders, speed lines | `#34beed` | — | literal |
| Deep blue: focus rings, headings in the arena | `#1a8fc4` | — | literal |
| Blue text on light | `#0b6f9e` | — | literal |
| Wii orange: small details only (title stripe, a few speed lines) | `#f59b3c` | — | literal |
| Ready green: tracking and calibration states | `#4cbf6b` | — | literal |
| Wii grey: wordmark in the arena and the opening | `#8b949c` | — | literal |
| Wii Menu greys: background, empty channel, footer, channel edge and label | `#d5dbe0` `#bcc3ca` `#b4bdc5` `#8f9aa4` `#737e88` | — | literal |

New work uses these colors; do not introduce others without adding them here.

### Surfaces

- Light theme: faint TV scanlines and a soft light-blue fade at the bottom of the canvas; header, product pill and drawing toolbar are glass with a light-blue edge. Dark mode keeps its own look.
- Light-theme shadows are blue-tinted (`rgba(26, 110, 168, …)`), never neutral grey or olive-black.
- Text selection is a translucent blue, so it never hides tightly spaced headline lines.
- Dark mode uses the existing CSS variables; components must inherit them instead of hard-coding light colors.
- Glass surfaces use a translucent paper tint, a fine border, restrained shadow, and backdrop blur. Keep enough tint for text behind a card to become unreadable.
- Prefer rounded pills for compact controls and softly rounded cards for content. Avoid boxed rules and decorative borders that interrupt the editorial page flow.

## Typography

- Sans: Manrope, with the existing system fallbacks. Use it for headlines, body copy, and interface labels where a clean reading voice is needed.
- Mono: DM Mono, with the existing system fallbacks. Use it for navigation, metadata, small status labels, and the Vision page's editorial text.
- Serif italics are reserved for the short editorial accent in the Product headline. Do not apply italics or bold to whole paragraphs.
- Definition card: a restrained medium-weight sans title; small mono part-of-speech label; readable, regular-weight sans definition; muted secondary line. Italicize only the part-of-speech word.
- Do not add a new font family without updating this system and getting an explicit design reason.

## Header and motion

- The compact header wordmark always shows the dot on the last “i”: as the home webcam fades out, the real dot fades in at its place.
- Keep `Wii` centered in the header as the page scrolls. It begins as the large home-page wordmark and settles into the compact header position without jumping.
- The navigation becomes a narrow, light glass surface while scrolling: subtle blur, fine border, soft shadow, and a shorter height.
- The header, centered wordmark, and definition card must remain legible and within the viewport at browser zoom and at 320 px CSS width.
- Hover feedback should be small and clear: a fine underline, slight color change, or a one-pixel lift. Avoid jitter, looping motion, and pointer-driven movement of content. The one exception is the webcam's red recording dot, which blinks only while the pointer or keyboard focus is on the webcam and stops (steady red under reduced motion) when it leaves.
- The definition opens from the Wii wordmark only. It stays open while the pointer moves from the wordmark onto the card and closes when moving to Product or another control.
- The custom page scrubber is a visible, compact glass capsule with a readable track and thumb. Keep pointer dragging and keyboard navigation; do not reduce it to a tiny line.
- Drawing mode (Home sheet): the first stroke slides the header, the compact wordmark and its Product link out of the way. They return when the pointer reaches the top edge, when the page scrolls, or through the "Mostrar menu" button (touch and keyboard).
- Home exceptions to the hover rule above: each Wii letter hops on hover (and the webcam, which is the dot of the final "i", follows it), and the gallery highlights one card at a time every 7 s with the same lift as hover. Both are disabled under reduced motion.
- Papers exceptions: any `Wii` in running text (not the wordmark) shows a short speech bubble on hover. Under reduced motion the bubble animation is off.
- Respect reduced-motion preferences.

## Definition card

- The Wii definition appears only when hovering or keyboard-focusing the Wii mark in the shared header, on every route.
- Keep the glass card centered beneath the mark, readable at compact and large viewport sizes, with no scaling tied to the wordmark size.
- The card copy should describe the body-as-controller idea in plain language and retain enough detail to communicate the vision. The card does not belong in the Vision page body.

## Page composition

Use whitespace for hierarchy. Keep the pages minimal and avoid adding sections or labels that were not requested.

### Home

- Home places a still archive of milestones of body and motion as input (from the Vitruvian Man to Kinect) around the centered Wii wordmark. Keep the artifacts static, make each one link to its primary or archival source, and preserve room around the wordmark. Add a small webcam SVG in place of the dot of the final “i” (rendered as a dotless “ı”); fade it as the wordmark settles into the compact header. Hovering or focusing the webcam opens a matching glass card that explains its role in live capture. Place that card to the wordmark’s right on desktop and below it on narrow screens, clear of the page scrubber. Keep the webcam card separate from the Wii definition card. On narrow screens, move the archive below the first-screen mark. On load, trace each archive frame as a stroke in staggered order, then let the frame's paper, artwork, and caption fade in from a blur. Let the Wii wordmark emerge from depth on first load: it starts small, blurred, and pushed back, then settles forward to full size and sharpness over about 1.3 s. On hover or focus, an archive frame grows about 4.5% and gains a soft shadow beneath it (no growth under reduced motion). Reduced-motion users see everything at once.
- Below the home archive, provide a full-viewport, edge-to-edge drawing sheet. Keep a compact floating glass toolbar for pen, eraser, color, stroke width, and one clear-all action. The sheet must remain free of cards, inset margins, and secondary action rows. It stays edge-to-edge but must read as a distinct sheet: its own tone (near-white in light, slightly lifted in dark), a soft inner shadow along its top edge marking where it begins, and a slightly darker tool tray in the last 100 px with its own soft inner shadow marking where the drawable paper ends. No hard rules or lines. Store strokes in normalized coordinates so resize does not distort them, use coalesced pointer events, and cap canvas pixel ratio to keep memory use predictable. Offer four stroke sizes (fine, medium, thick, and a very large one). Show the area the pen or eraser will cover as a round highlighter (`--accent`) preview under the pointer, and flash it briefly at the sheet's center when the size or tool changes.

### Vision

- Vision is an uninterrupted editorial page: a large centered Manrope headline (medium weight, tight tracking, matching the Product headline), readable centered mono paragraphs, and a quiet mono sign-off. A local canvas renders a Sailor Moon inspired portrait as ASCII above the headline; her eyes open on entry, blink, and wink while separate waves move through the twin tails. On entry the portrait is not drawn as a stroke: its symbols appear from the top down, scattered, over about three seconds, and only then do the eyes and hair begin to move. Taper the portrait's lower silhouette so it does not end in a rectangular crop. Type the headline and copy in one measured reading order, with the full copy immediately available to assistive technology and reduced-motion users. If the reader keeps scrolling down (about 260 px of wheel, touch, or key intent, which resets after a brief pause), stop typing and let the remaining copy emerge from a blur with a 640 ms fade, leaving typed text untouched. Reduced-motion users get the full copy immediately. Do not insert a dictionary card, eyebrow, or horizontal rules into the Vision copy.

### Papers

- Papers (`/papers`, the “papers” tab beside “vision” in the header) is a stage with no cards in the page body: a large centered Manrope “papers” headline, one short mono line under it that cycles every ~4.8 s (fades through a blur), and the five research-paper proposals from `docs/research` orbiting on a slow ellipse as small glass cards (number + short name; the ones passing in front are larger and sharper, the ones behind smaller and faint, and the title stays above those behind). The ring keeps turning under the pointer (cards are never stopped by hover, so none slips away from a click) and eases to a stop while a card has keyboard focus or its summary is open; clicking a card opens a glass panel under the headline with the title, one-sentence summary and “fechar” (Escape also closes), and the panel sits above every card. Article pages render the source Markdown with illustrations, captions, and an interactive matrix where available. Readers can download the article as a PDF. The copy must stay honest: the collection is proposals, not validated results (“ainda sem resultados”). Reduced-motion users get a static ring and a static line. The header's `vision`/`papers` links drop to 12 px under 640 px so they clear the centered Wii mark at 320 px.

### Product

- Product uses the shared pill style for its construction status, a centered ASCII illustration that settles still after its entry, a clear headline, and concise explanatory copy.
- The Product construction illustration is rendered as colored ASCII symbols on a canvas, using the same glyph-ranking approach as the Vision portrait. On entry its symbols appear from the top down, scattered, slowly over about 4.6 s, then the artwork stays still. Do not animate or parallax it afterward. Reduced-motion users see it at once.

## Arena (`/app`)

- Opened by the Product “em construção” pill; source in `src/arena/`. Running and tennis played with body pose through the webcam, full screen, with no site header, scrubber or Wii speech bubble, under its own tab title.
- Skin: light Wii-style Frutiger Aero using the palette above (white and light blue, glossy pill buttons with a blue edge, soft gradients and shadows). Arena styles stay nested under `.arena` so they never reach the site.
- Order: white screen, a vivid blue “Wii” (Wii blue to deep blue) rushes forward and the screen splits open; body calibration (camera starts by itself, “Pular” skips it); channel screen: on the first visit the 4×3 grid shows for about 1 s, then “Wii Sports” comes forward and the empty channels fall back into an elliptical ring around it (like Papers, but it only turns on a click: the arrow buttons, or any channel, which then comes to the front); glass highlights on every channel; clicking the front “Wii Sports” grows it in three steps: the ring and footer fade (0.3 s), an empty glass pane grows from the tile to fill the screen (0.65 s), then the title screen content appears; title screen (“Wii Menu” / “Start”); “Menu Principal” (Corrida, Tênis, with a preview); game (“‹ Jogos” returns).
- On “Menu Principal”, the Wii Sports wordmark returns to the channel grid.
- The only site control is “sair”, shown just on the channel grid, in its footer at bottom left, below the blue curve.
- “sair” uses the camera button’s font (the arena’s rounded sans, bold, uppercase); the minimized “Câmera” pill and “sair” share a Frutiger Aero glass finish (top highlight, light-blue body, blue edge and glow).
- The corner camera panel has a minimize button that shrinks it to a “Câmera” pill; calibration still opens it full screen.

### Entering and leaving

- Entering plays a radial warp tunnel (about 2.3 s, `src/lib/warp.ts`): speed lines in the palette blues, with a few orange ones, on the light canvas, accelerating toward the viewer with motion-blur trails and a slight twist, ending in a white flare.
- Then the arena arrives under a white flash that fades over about 1.3 s while it settles from overexposed with a small punch-in.
- Leaving (“sair”) is its own sequence: the arena washes out to white (about 1.1 s), then the Product page returns from far away, shrinking to normal size while the white fades (about 1.5 s).
- Reduced motion: no tunnel, flash or channel zoom.

## Interaction and responsive behavior

- Navigation links and controls need visible hover and keyboard-focus states.
- The language choices opened from the theme control stay inside the viewport on narrow screens.
- The location label is not a link. On hover or keyboard focus, “São Paulo, Brazil” lifts slightly and a hairline divider with “São José dos Campos” fades in beneath it.
- Keep the location label's response restrained on desktop. On narrow layouts, prioritize the centered wordmark and prevent overlap with the theme control.
- Theme changes must work on every route and preserve contrast.
- Test critical header/card layouts at desktop width, 640 px, and 320 px, including while the home wordmark is transitioning on scroll.
- Switching theme cuts the page diagonally: a thin hand-drawn line is written from the top-left corner to the bottom-right corner in the new theme, then opens out on both sides to reveal the whole new theme (about 1.1 s, View Transitions API). Reduced-motion and unsupported browsers switch instantly.

## Opening sequence

- Plays on each page load (not in `/app`) and is always light, in the site’s Wii white and blue (artwork in a blue duotone, grey “Wii”): a documentary title sequence, not a web page. No cards, bubbles, containers, hard-edged light circles, neon or cyberpunk styling.
- One continuous timeline (about 46 s, skippable with “pular” or Escape): the two questions over a faint “Wii”, then the camera travels through the eight milestones in depth, then “Wii” alone and a fade to the site.
- The picture is raw WebGL (`src/lib/introScene.ts`): noise-shaped diffuse light, dust, artwork with dissolved edges, depth of field, restrained bloom, vignette and film grain. Text is bare light typography set directly over the picture.
- Camera drift is autonomous, never pointer-driven. Reduced motion holds the camera and grain still and only crossfades. Without WebGL the artwork shows as plain images.
- Adaptive quality (`src/lib/quality.ts`): Lite, Medium and Ultra change only internal resolution, shader cost, particles, light warp and bloom; layout, timing, vignette and grain stay. A short non-blocking benchmark of the real shaders picks the start level, then frame times adjust it with hysteresis. The profile is stored in `localStorage` (`wii-quality`), measured again after 7 days or a GPU/screen change; the quiet top-right control (or `?quality=`) overrides it. Nothing is sent anywhere.
- Leaving (end or skip) is ordered: the current frame and text freeze and fade (about 0.5 s), the veil dissolves (1 s), and the page entrance, held until then, builds up piece by piece: header, wordmark, then each archive frame’s traced line, paper, artwork and caption in sequence. The automatic card highlight starts only afterwards.
