# Mandate of the Wheel

A hamster survivors game whose battle is steered by **Squeektoshi's real wheel** on [Squeekchain](https://squeekchain.com).

Pick a hamster, hold the burrow against the predators for ten waves, and transform as you level up. Every ten seconds the game
reads Squeekchain's public API, and what Squeektoshi is doing at that moment changes the fight.

## Hamsters

| Hamster | Breed | Signature skill | Pup squad |
|---|---|---|---|
| Bao | Golden Syrian | **Squeak Roar**: a shockwave that damages, knocks back and stuns | Acorn Guards block and bash |
| Zoom | Roborovski | **Wheel Dash**: rolls through a line of predators in a hamster ball, invulnerable | Ball Rollers charge across the screen |
| Snow | Winter White | **Seed Storm**: sunflower seeds rain on the densest pack | Seed Slingers shoot the nearest predator |
| Ink | Panda Hamster | **Chili Blaze**: lines of chili-fire ground | Seed Crossbows fire rapid husks |

## Transformations

At **Lv 5, 10, 15 and 20** your hamster transforms: its fur changes colour, a crest rises from its hairline, an aura flares up,
and a shockwave clears the space around it. Each form raises damage, then attack speed, move speed, armor and range.

| Level | Form | Look |
|---|---|---|
| 5 | Spark Fur | amber fur, a small tuft |
| 10 | Golden Wheel | golden fur, spiked crest, blue eyes |
| 15 | Crimson Fury | crimson fur, swept flame crest, teal eyes |
| 20 | Azure Ascendant | sky-blue fur, towering crest, crackling aura |

The predators: stray kittens, rat snakes, barn owls and alley-cat matriarchs, with the Warlord Tabby at wave 5 and the Storm Owl
at wave 10. All art is drawn in code (`src/game/animalArt.js`): no image assets.

## Squeektoshi's wheel

| On Squeekchain | In the battle |
|---|---|
| Squeektoshi is running (`coreStatus: ACTIVE`, live `rpmMilli`) | **Mandate of the Wheel**: up to +35% attack speed and +18% move speed, scaled by his real rpm. A golden wheel turns around your hamster at his pace |
| Squeektoshi is resting (`IDLE`) | **Night Watch**: extra armor, +0.6% HP per second, +25% experience. Naps help too |
| No fresh reading (older than 120 s, sensor fault, API unreachable) | **Fog of War**: no bonus, and the panel says *Unknown*. An unknown wheel is never shown as a resting one |
| A settlement completes Squeek blocks on Ethereum (`builder.anchor.blockHeight` rises) | An **Imperial Treasure** drops near you: a free level-up, a heal and a shower of gems |
| A new ten-minute measurement round begins | A **Herald of the Wheel** rides in. Defeat it for another treasure |
| The current round number | **Round Challenge**: the battlefield is seeded with the round, so everyone who plays in the same ten minutes faces the same waves |

A pause only counts as rest after 20 seconds of stillness, so a sprint break doesn't flip the battle. The game never asks for a
wallet, never sends a transaction, and nothing in it rewards waking Squeektoshi or punishes a nap, in line with the
[care policy](https://docs.squeekchain.com/system/squeektoshi/).

## How it reads Squeekchain

All data comes from the public, keyless [Squeekchain API](https://docs.squeekchain.com/developers/api/) on Sepolia:

- `GET /v1/status` every 10 s (with `If-None-Match`): `measurement.coreStatus`, `rpmMilli`, `distanceMm`, `freshness`,
  `receivedAt`, and `builder.anchor` / `builder.projected` for the settled block height and progress to the next Squeek block.
- `GET /v1/core` every 5 min: `configuration.genesisTimestamp` and `roundDuration`, used to compute the current ten-minute round
  in the browser (`round = floor((now - genesis) / 600) + 1`).
- `429` / `503` responses are respected through `Retry-After`.

The Squeekchain layer lives in [`src/squeek/`](src/squeek): `wheel.js` (feed, parsing, round math) and `effects.js` (what each state
does in battle). It is covered by tests run against a real `/v1/status` response.

## Run it

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # Squeekchain layer tests (node:test)
npm run build   # static site in dist/
```

The build is a static site with relative paths; it can be served from any static host.

## Credits

Built by [@PHUOCHAU2403](https://x.com/PHUOCHAU2403), reworking the engine of *Three Kingdoms: Last Stand* (NoahAI Nitro 04,
same author) into a hamster game.
Squeekchain, Squeektoshi and the WHEELY9000 belong to the Squeekchain team; this is an independent community build.
