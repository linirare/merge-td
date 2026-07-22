# Cartoon mobile art refresh

Generated on 2026-07-22 with the built-in `image_gen` tool. New files use versioned names, so the previous art remains available for rollback.

## Shared prompt anchor

```text
Use case: stylized-concept
Primary request: Redesign Dream Water World as a cheerful casual cartoon mobile game.
Style/medium: chunky chibi proportions, bold navy colored outlines, broad flat shapes, exactly 2 to 3 cel-shading tones, very low texture, matte surfaces, soft rounded silhouettes, readable at 48px, turquoise ocean blue with coral orange and sunny yellow accents.
Composition: Minimalist composition, clean simple background. Focus on the main subject. For architecture: simple clean style, no excessive ornamentation or heavy textures.
Constraints: no text, no logo, no watermark.
Avoid: realistic materials, painterly detail, ornate fantasy architecture, glossy 3D toy rendering. No grain, no dirty texture, no random speckles, no messy background, no harsh glow, no checkerboard pattern, no tiling artifacts, no digital ripples.
```

## Asset-specific prompt set

- `water-world-basic-pool-banner-v1.png`: full-width basic gacha key art with a pearl-shell altar and five friendly sea spirits.
- `water-world-elite-pool-banner-v1.png`: full-width elite gacha key art with a shark knight, seahorse mage, and jellyfish guardian.
- `water-world-home-expedition-v1.png`: transparent home-screen expedition platform with three functional team roles and a treasure compass.
- `water-world-nav-icons-v1.png`: transparent five-icon bottom-navigation sprite sheet for market, formation, battle, tide arena, and ranking.
- `water-world-home-v1.png`: portrait shell-house home camp with a large open center for the mascot and UI.
- `water-world-campaign-v2.png`: portrait campaign path with large shell stepping stones and a simple pearl gate.
- `water-world-arena-v2.png`: portrait duel arena with a clean circular shell platform and open matchmaking space.
- `water-world-battlefield-v4.png`: portrait three-zone battlefield; coral enemy board, open aqua field, blue player board.
- `water-world-orbs-v3.png`: exact 5x5 row-major sea-spirit orb atlas on a flat magenta key plate.
- `water-world-units-v3.png`: exact 5x5 row-major chibi troop atlas on a flat magenta key plate.
- `water-world-commanders-v3.png`: exact three-cell horizontal chibi commander atlas on a flat magenta key plate.
- `water-world-bosses-v3.png`: exact four-cell horizontal chibi boss atlas on a flat magenta key plate.

The four sprite atlases were converted to RGBA with the imagegen skill's `remove_chroma_key.py` helper using border auto-key detection, soft matte, and despill. Transparent corners and opaque subject coverage were validated before integration.
