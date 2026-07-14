# Battle 2D art v5

Generated with the built-in `image_gen` tool on 2026-07-14. Project-bound runtime assets are kept in this directory. Chroma-key sources were converted to RGBA with the imagegen skill's `remove_chroma_key.py` helper; intermediate key plates are not shipped.

## `battlefield-flat-2d-v5.png`

```text
Use case: stylized-concept
Asset type: final runtime background plate for a portrait 2D mobile merge-defense battle screen
Primary request: Design a clean premium pure-2D battlefield for a sequel inspired by the information structure of competitive orb-merging tower-defense games. The gameplay loop is orb barracks merge -> barracks deploy troops -> troops fight in five lanes -> break enemy wall. This must be a practical 480×920 gameplay background, not concept art.
Exact layout: portrait 480:920. Top HUD safe band from y=0 to 48. Enemy deployment board band from y=58 to 230. Enemy wall band from y=238 to 258. Central five-lane battlefield from y=270 to 640. Player wall band from y=648 to 668. Player deployment board band from y=676 to 848. Bottom command bar safe band from y=858 to 920. The top enemy board and bottom player board must be EXACTLY the same width and height and visually mirrored. Leave a clean vertical portrait recess at the far right of the enemy board and a matching recess at the far left of the player board for commander character portraits. Keep the center of both board bands empty for a 5-column by 3-row interactive grid.
Composition: perfectly front-on flat 2D screen layout, no camera depth, no foreshortening, no vanishing point, no perspective. Enemy board uses muted warm coral-red; player board uses deep turquoise-blue; central battlefield uses desaturated warm green with five subtle vertical lane stripes. Two slim symmetrical stone-and-wood walls separate the field from the boards. Side borders use simple orchard leaves and flat banners only. Functional symmetry and negative space are more important than decoration.
Style/medium: polished commercial 2D mobile-game background illustration, clean vector-like cel shading, crisp controlled outlines, broad flat color shapes, minimal two-tone shading, restrained highlights, readable at phone size. Original fruit-kingdom theme. It should look authored by one 2D game UI art team, not like AI fantasy painting.
Lighting/mood: cheerful daylight represented through flat color blocks; no realistic lighting, no volumetric effects, no rendered materials.
Constraints: no characters, no units, no balls, no grid cells, no HUD panels, no buttons, no text, no numbers, no logo, no watermark. Minimalist composition, clean simple background. Focus on the main subject. For architecture: simple clean style, no excessive ornamentation or heavy textures.
Avoid: 2.5D, 3D, clay render, painterly rendering, realistic texture, isometric view, deep perspective, castle diorama, giant emblem, glossy plastic, bevel-heavy UI, crowded plants, tiny decorative clutter, collage look.
No grain, no dirty texture, no random speckles, no messy background, no harsh glow, no checkerboard pattern, no tiling artifacts, no digital ripples.
```

## `orb-barracks-v5.png`

```text
Use case: stylized-concept
Asset type: transparent runtime sprite atlas for the five default orb-barracks used on a 3×5 merge board
Primary request: Create exactly five circular 2D orb-barracks icons for a premium mobile merge-defense game. They are buildings represented as magical fruit balls, not humanoid portraits. Left to right: watermelon shield barracks, grape archer barracks, banana raider barracks, pineapple lancer barracks, orange cannon barracks. Each icon is a round fruit orb with one simple class symbol integrated into the front: shield, bow, curved blade, spear, cannon. Give each orb a tiny flat base-ring so it reads as a barracks that deploys troops.
Style/medium: pure 2D game sprite art, clean vector-like cel shading, bold controlled colored outline, broad flat colors, at most two simple shade tones, tiny highlight shape, highly readable at 42-54 pixels. Original cheerful fruit-kingdom design. No 3D render, no painterly volume, no realistic material, no glossy plastic.
Composition: exactly five equal invisible cells in one horizontal row, same orb diameter, same front-facing orthographic camera, same outline weight, each centered with generous separation and padding. No overlap, no symbols crossing cells.
Background: perfectly flat solid pure magenta #FF00FF chroma-key background across the entire image. Absolutely uniform; no gradient, texture, floor, shadow, reflection, scenery or vignette. Do not use magenta or hot pink inside the icons.
Constraints: no text, no labels, no numbers, no stars, no UI frame, no borders, no extra objects, no cast shadow, no watermark. Minimalist composition, clean simple background. Focus on the main subject.
Avoid: character faces, arms, legs, portrait art, 2.5D, 3D, clay, painterly style, beveled collectible coin, realistic fruit texture, sticker border, excessive detail.
No grain, no dirty texture, no random speckles, no messy background, no harsh glow, no checkerboard pattern, no tiling artifacts, no digital ripples.
```

## `fruit-troops-v5.png`

```text
Use case: stylized-concept
Asset type: transparent runtime sprite atlas for troops deployed by five orb-barracks into a vertical five-lane battlefield
Primary request: Create exactly five compact 2D fruit troops matching the same visual language as clean cel-shaded fruit orb icons. Left to right: watermelon shield guard, grape archer, banana curved-blade raider, pineapple spear lancer, orange cannon soldier. These are small field units spawned by the matching orb-barracks.
View and pose: elevated top-down three-quarter 2D game sprite view suitable for a vertical battlefield. The viewer sees the top of each head and shoulders. All five face upward and slightly toward screen center, ready to march toward the enemy wall. Full body visible, feet together on the same invisible ground line. Compact approximately 2.2-head-tall proportions, simple faces, one readable weapon, strong silhouette at 44-64 pixels.
Style/medium: pure 2D mobile-game sprite illustration, clean vector-like cel shading, bold controlled colored outlines, broad flat color shapes, at most two simple shading tones, no realistic lighting and no rendered volume. Match the orb-barracks palette and outline weight exactly. Original cheerful fruit-kingdom design.
Composition: exactly five equal invisible cells in one horizontal row, consistent scale, same camera angle, same body proportions, same outline thickness, generous separation. No overlap and no weapon crossing adjacent cells.
Background: perfectly flat solid pure magenta #FF00FF chroma-key background across the entire image. Absolutely uniform; no gradient, texture, floor, cast shadow, contact shadow, reflection, scenery or vignette. Do not use magenta or hot pink on the characters.
Constraints: no text, no labels, no numbers, no UI, no frames, no extra characters, no duplicate limbs, no cropped weapon, no aura, no watermark. Minimalist composition, clean simple background. Focus on the main subject.
Avoid: 2.5D, 3D, clay, painterly rendering, realistic fruit skin, glossy plastic, portrait pose, giant chibi head, sticker border, isometric diorama, complex costume detail.
No grain, no dirty texture, no random speckles, no messy background, no harsh glow, no checkerboard pattern, no tiling artifacts, no digital ripples.
```

## `commanders-v5.png`

```text
Use case: stylized-concept
Asset type: transparent runtime portrait atlas for the commander system on a portrait 2D mobile battle screen
Primary request: Create exactly two half-body 2D commander portraits for a fruit-kingdom merge-defense game. Left cell: the player commander, a confident young orchard lord in jade-green and warm gold light armor, leaf-shaped shoulder guards, short dark hair, holding a small command baton, body turned slightly right toward the battlefield. Right cell: the rival commander, a clever young crimson orchard general in coral-red and ivory light armor, berry-shaped hair ornament, body turned slightly left toward the battlefield. Both are original characters with friendly competitive expressions, clear silhouette and one free hand suitable for a skill activation pose.
Style/medium: pure 2D commercial mobile-game character illustration, clean vector-like cel shading, bold controlled colored outline, broad flat color shapes, at most two simple shade tones, expressive but not exaggerated face, no realistic lighting, no rendered volume. Match clean flat fruit orb and troop sprites.
Composition: exactly two equal invisible cells in one horizontal row. Half-body from head to waist, same scale and proportions, each centered with generous padding, mirrored inward-facing poses, no overlap. Portraits must remain readable around 48×96 pixels.
Background: perfectly flat solid pure magenta #FF00FF chroma-key background across the entire image. Absolutely uniform; no gradient, texture, floor, cast shadow, contact shadow, reflection, scenery or vignette. Do not use magenta or hot pink in clothing, hair or skin accents.
Constraints: no text, no labels, no numbers, no UI frames, no extra people, no weapons crossing cells, no cropped head or hands, no aura, no watermark. Minimalist composition, clean simple background. Focus on the main subject.
Avoid: 2.5D, 3D, clay, painterly rendering, realistic portrait, glossy plastic, giant chibi head, sticker border, over-detailed costume, photorealism.
No grain, no dirty texture, no random speckles, no messy background, no harsh glow, no checkerboard pattern, no tiling artifacts, no digital ripples.
```
