# V3 original asset provenance

Date: 2026-11-01  
Project: NightShift Live — The Ward

## Scope

The V3 corridor pass adds original, project-specific raster assets generated for this game. They were prompted against the existing Ward corridor only to preserve the game's established lighting, grime, palette, and material language. They are not stock downloads and do not imitate a named artist, franchise, film, or game.

Every V3 prop and character file was requested as an isolated transparent PNG so it can participate in the live scene graph, parallax, occlusion, Warden phase changes, and the physical door animation instead of acting as a flattened screenshot.

## Manifest

| Asset | Purpose | Production direction | Verification |
| --- | --- | --- | --- |
| `art-source/v3/warden-warning-v1.png` | Distant warning phase | Preserve the established Warden identity; readable, restrained warning silhouette; cold cyan and emergency-red edge light | 32-bit alpha source; public derivative in `dist/assets/v3/` |
| `art-source/v3/warden-approach-v1.png` | Approach and strike phases | Same Warden identity in a reaching, forward-driving pose for staged escalation | 32-bit alpha source; public derivative in `dist/assets/v3/` |
| `art-source/v3/warden-repelled-v1.png` | Successful counter phase | Same Warden identity recoiling under clinical light, suitable for a cyan repel treatment | 32-bit alpha source; public derivative in `dist/assets/v3/` |
| `art-source/v3/gurney-foreground-v1.png` | Near-field corridor occluder and evidence prop | Corroded hospital gurney matching Ward materials, cyan/red scene light, no baked floor or background | 1536×1024 alpha source; public derivative in `dist/assets/v3/` |
| `art-source/v3/curtain-foreground-v1.png` | Foreground depth, stealth cover | Wet, torn surgical privacy curtain and rail matching the corridor, isolated from wall and floor | 1024×1536 alpha source; public derivative in `dist/assets/v3/` |
| `art-source/v3/isolation-door-v1.png` | Multi-phase physical isolation door | Front-elevation, buildable steel door with `ISOLATION 06`, wired glass, magnetic lock, bolt receivers, cyan/red scene light | 1024×1536 alpha source; public derivative in `dist/assets/v3/` |

## Prompt constraints used throughout

- Premium cinematic hospital horror, realistic material detail, restrained rather than campy.
- Match the Ward's dark teal steel, damp grime, cold cyan practical light, and limited emergency red.
- Preserve character identity across Warden phase poses.
- No named-artist or franchise reference.
- No logos, watermarks, UI, extra text, room background, or baked floor shadow.
- Complete silhouette with transparent padding for safe animation and cropping.

## Integration notes

- The Warden sprite is selected from explicit engine phases (`warning`, `approaching`/`striking`, `passing`, and `repelled`).
- Curtain and gurney are independent foreground layers enabled only in Ward 06 and the operating theatre.
- The isolation door is textured onto a CSS 3D panel with linked bolts, a real hinge transform, a connected-room reveal, and reduced-motion support.
- Original PNGs remain under `art-source/` as the lossless source of truth. The public `dist/` uses visually verified WebP derivatives; the expanded post-switch visual matrix passed 28/28 and the browser campaign gate passed 7/7.

This manifest records authorship and intended use; it is not a claim that automated generation alone proves final visual quality. The release screenshots and visual-QA matrix remain the acceptance evidence.
