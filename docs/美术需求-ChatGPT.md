# Art requirements (for ChatGPT image generation)

How to use: run everything in **the same ChatGPT conversation**. First send the "unified style" paragraph, generate the knight, and once the style is approved, generate the rest one at a time, each time adding "same style as the knight above". When an image is done, download the PNG and send it to the Claude session (or drop it in the repo's art/ folder); Claude cuts it out, compresses it, wires it into the game and adds motion (breathing, charging, flashing on hit, falling down, etc.).

## Unified style (send this paragraph first)
2D game character art for a dark-fantasy mobile puzzle game. Hand-painted look, bold dark outlines, rich shading and rim light, slightly stylized but NOT chibi and NOT cute: realistic proportions, menacing and cool. Full body, side view, plain transparent background (PNG), no shadow on the ground, no text, no frame. 1024x1024, character centred and filling about 80% of the height.

## Character list (one image per line)
1. Knight on horse (the hero): A tall dark knight in full plate armour riding an armoured black war horse, facing RIGHT. Closed great helm with a black T-shaped visor; only two glowing red eyes show inside. Tattered dark red cape. Long sword raised. The horse wears a spiked chanfron, red caparison with gold trim, glowing red eye.
   - Make 4 variants, identical except the armour colour: steel grey, emerald green with gold trim, royal blue with gold trim and horns on the helm, purple with gold crown-helm and big horns (gear tiers from common to epic).
2. Toxic slime: a dripping acid-green ooze monster with a half-dissolved skull inside it, glowing yellow-green eyes, a jagged mouth, facing LEFT.
3. Goblin: a hunched hooded goblin rogue with long ears, glowing yellow eyes, curved dagger, ragged dark cloak, facing LEFT.
4. Skeleton soldier: undead skeleton warrior with a rusty half-helm, notched sword and round wooden shield, glowing blue eye sockets, facing LEFT.
5. Vampire bat: a giant vampire bat, wings spread, red glowing eyes, fangs, facing LEFT.
6. Orc brute: broad-shouldered orc with tusks, small head, scars, leather and iron armour, big war axe, red eyes, facing LEFT.
7. Ogre King (boss): huge ogre with an iron crown, spiked club, red cape, scars, red eyes, facing LEFT.
8. Dungeon Dragon (great boss): a red dragon crouched to strike, long neck, horns, wings raised, fire glowing in its mouth, facing LEFT.
9. Princess: a slim young princess with long golden hair, small tiara, rose-pink gown, standing, facing LEFT. Make 2 variants: (a) eyes closed, frozen inside a large purple magic crystal; (b) awake, smiling, arms raised in joy, no crystal.

## Scenes (wide images, no characters)
10. Dungeon room interior side view, stone brick walls, torches, a dark archway in the back wall, stone floor. 1920x1080, horizontal. (3 variants: archway / barred moonlit windows / heavy wooden door between pillars)
11. Throne hall with a stained-glass window and red carpet (ending scene). 1920x1080.
12. Night mountain with a dungeon gate carved in it, a red bull skull above the gate, two red eyes in the dark doorway (opening scene). 1920x1080.

## Not handled by ChatGPT (Claude keeps drawing these in code)
Potion bottles, liquid, corks, shield dome, slashes/sparks/fire effects, buttons, health bars, minimap, card flipping and other UI, because they need to move and change in real time.
