# CRAFT — Voxel Sandbox

A browser voxel sandbox in the spirit of Minecraft: TypeScript + Three.js + Vite.
No image files, no audio files, no backend — every texture and every sound effect is
generated in code, so the whole game is one small bundle.

> Originally a demo for [KimiC](https://github.com/KimiC) — play at **https://kimic.cn/craft/**
> (the older demo build is still at http://craft.rafter.com.cn/)

## What you can do

**Collect the stars.** Ten glowing stars are scattered around the world each round.
Walk into one to grab it. The HUD keeps a timer and your best run; clear all ten and
a fresh ring spawns further out.

**Build something.** 20 block types, instant creative-style placing, fly mode and Ctrl+Z.

**Break something.** TNT explodes, and explosions set off other TNT. Chain reactions
are very much encouraged.

**Write the rules.** Press `/` to open a command console: `time 22` makes it night,
`gravity 0.1` makes it the moon, `star 5` drops stars at your feet. Then place a
**command block** (the orange `>` block at the end of the hotbar), press `E` to attach
a command to it, and stand on it to trigger it. That is an *event → action* machine —
the smallest complete piece of programming in the game.

**Explore.** Hills, beaches, oceans, snow caps and mountains are generated from a seed
you can type on the start screen. Underground there are caves and coal / iron / gold veins.

**Swim.** Water is a medium, not a decal: you sink slowly, `Space` swims up, and when
your eyes go under the fog closes in with a depth- and light-aware blue tint.

**Play with the world.** A full day-night cycle (sunrise, stars, moon, drifting clouds),
procedural sound effects, and a photo mode that saves a PNG.

## Features

- 20 blocks: grass, dirt, stone, cobble, planks, logs, leaves, sand, gravel, glass,
  brick, ice, snow, glowstone, coal/iron/gold ore, obsidian, TNT and a command block
- Terrain from layered simplex noise: rolling hills, mountains, ocean basins,
  beaches and a snow line
- Caves carved from two intersecting noise fields (winding tunnels, not hollow blobs)
  plus depth-based ore veins
- Per-chunk face-culled meshing with a mipmapped, anisotropically filtered,
  procedurally painted texture atlas
- Water as a volume: buoyancy, a swim-up key, and an underwater medium (fog pulled
  in to 1–15 blocks, water-coloured clear colour, depth/light/view-angle tint)
- Day/night cycle driving sky colour, fog, sun/moon sprites, stars and lighting
- Crosshair block outline, hold-to-repeat breaking and placing
- Sprint, jump buffering, coyote time, swimming, and a fly mode
- WebAudio sound effects synthesised at runtime (break, place, jump, splash, collect,
  fuse, explosion, win jingle) with an M mute toggle
- Voxel debris particles, explosion flash and camera shake
- Star-collecting challenge loop with timer, best time and round counter
- Undo, photo mode, F3 debug overlay (fps, GPU, position), seed input and new-world button
- In-game command console (`/`) with English + Chinese aliases
- Command blocks: attach a command with `E`, trigger it by standing on it; the
  command text is stored with the world save
- IndexedDB autosave (chunks stored as typed arrays, command blocks alongside)

## Controls

### Desktop

| Key | Action |
|-----|--------|
| W A S D / arrow keys | Move |
| Mouse | Look |
| Space | Jump · fly up |
| Shift | Sprint · fly down |
| F | Toggle fly mode |
| Left click | Break block (hold to repeat) |
| Right click | Place block (hold to repeat) |
| 1–9, mouse wheel, or click a slot | Select block |
| Ctrl+Z (⌘Z on Mac) | Undo last edit |
| `/` | Command console |
| `E` | Edit the command block you are looking at |
| P | Save a screenshot as PNG |
| M | Mute / unmute |
| H | Help |
| F3 or `` ` `` | Debug overlay (fps, GPU renderer, position, nearest star) |
| Esc | Pause |

> F3 is Chrome's "find next", so the game calls `preventDefault()` on it and also
> accepts the backquote key — use `` ` `` if F3 misbehaves in your browser.

### Mobile (phone / tablet)

| Control | Action |
|---------|--------|
| Left joystick | Move |
| Drag right side of screen | Look around |
| Break / Place / Jump / Fly buttons | Actions (Fly shows a Down button when active) |
| Tap hotbar slot | Select block |
| ☰ button | Pause menu |

## Tuning it for a class

Almost everything that changes how the game *feels* lives in one file:
[`src/config.ts`](src/config.ts) — gravity, walk/sprint/fly speed, jump height, day
length, star count, world seed, render distance and so on. Change a number, save, and
the dev server hot-reloads. Great first exercise: "make the moon's gravity real" or
"how fast is too fast?".

Two more groups in the same file are worth showing students:

| Group | Knobs |
|-------|-------|
| `CONFIG.water` | buoyancy (`gravityFactor`), sink and swim speeds, underwater visibility (`fogNear`/`fogFar`), water colour and screen tint |
| `CONFIG.video` | render-resolution cap and the walking camera bob |

The game object is exposed on `window.game`, so students can poke at it from the browser
console:

```js
game.player.flying = true          // start flying
game.player.position.y += 20       // teleport up
game.world.getBlock(10, 40, 10)    // read a block id
game.sky.time = 22                 // jump to night
game.audio.toggleMute()
```

See [IDEAS.md](IDEAS.md) for a prioritised list of ways to make it more playful,
and [CLASSROOM.md](CLASSROOM.md) for a lesson plan and project briefs.

### In-game commands

Press `/` while playing. Commands work in English or Chinese, from the console or
from a command block.

| Command | Chinese | What it does |
|---------|---------|--------------|
| `help` | `帮助` | List every command |
| `time <0-24>` | `时间` | Set the time of day (0 midnight, 12 noon) |
| `day` / `night` | `白天` / `夜晚` | Shortcuts for 12:00 and 22:00 |
| `tp <x> <y> <z>` | `传送` | Move relative to where you stand |
| `where` | `坐标` | Print position and world seed |
| `fly` | `飞行` | Toggle fly mode |
| `star [n]` | `星星` | Drop n stars around you |
| `speed <0.5-4>` | `速度` | Movement speed multiplier |
| `gravity <0-3>` | `重力` | Gravity multiplier (0 = moon) |
| `box <radius>` | — | Build a room around you from the held block |
| `tnt` | — | Light a charge next to you |
| `undo` | `撤销` | Undo the last break or place |
| `seed` | `种子` | Print the world seed |
| `clear` | — | Wipe the console |

Command blocks are edited by looking at one and pressing `E`. The command runs each
time a player stands on the block (1.6 s cooldown), so a block that runs `time 22`
is a working "step here and it turns to night" trap.

## Getting started

```bash
git clone https://github.com/KimiC/craft.git
cd craft
npm install
npm run dev
```

Open http://localhost:5173/.

| | |
|---|---|
| Repository | **https://github.com/KimiC/craft** (fork of `Raft-chen/craft`) |
| Play — primary | **https://kimic.cn/craft/** |
| Play — original demo | https://craft.rafter.com.cn/ |
| Local checkout | whatever path you clone into, e.g. `D:\dsh\games\craft` |

Requires Node.js 20+ and Git. There is no backend, no API key and no build-time
secret: every texture and sound effect is generated in code at runtime.

Remotes:

| Remote | URL | Role |
|---|---|---|
| `origin` | https://github.com/KimiC/craft | all work happens here; this is what gets deployed |
| `upstream` | https://github.com/ai-game-craft/craft | read-only mirror, **not** deployed |

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/ — hot reload, no build step needed.

## Production Build

Two builds, because the two live sites mount the game at different paths:

```bash
# served from the domain root  -> https://craft.rafter.com.cn/
npm run build

# served from /craft/          -> https://kimic.cn/craft/
npm run build:kimic
```

| Command | Output | Used by |
|---|---|---|
| `npm run build` | `dist/` | craft.rafter.com.cn |
| `npm run build:kimic` | `dist-kimic/` | kimic.cn/craft |

`build:kimic` is just `vite build --base=/craft/ --outDir=dist-kimic --emptyOutDir`.
The `--base=/craft/` flag is not optional: without it the asset URLs point at the
domain root and the page loads blank. `dist-kimic/` is gitignored.

## Deploy

### Where the two live sites come from

| Site | URL | Web root on the server | Build |
|---|---|---|---|
| KimiC homepage + game | **https://kimic.cn/craft/** | `/var/www/kimic/craft` | `--base=/craft/` |
| Original demo | https://craft.rafter.com.cn/ | `/var/www/craft.rafter.com.cn` | default base |

Server: Aliyun ECS `47.82.233.199`, user `admin`, nginx 1.20, TLS certificates from
certbot (its timer renews them). The server keeps a git clone at `~/craft` for the
rafter build; the kimic build is produced locally and copied over.

### Every update

**1. Commit and push** (from your checkout):

```bash
git add -A
git commit -m "Describe your change"
git push origin main
```

**2. Deploy to kimic.cn/craft** — build locally, copy the static files:

```bash
npm run deploy:kimic
```

That one script is a shortcut for exactly this:

```bash
npx vite build --base=/craft/ --outDir=dist-kimic
ssh admin@47.82.233.199 "rm -rf /tmp/craft-dist"
scp -r dist-kimic admin@47.82.233.199:/tmp/craft-dist
ssh admin@47.82.233.199 "sudo rm -rf /var/www/kimic/craft && sudo cp -r /tmp/craft-dist /var/www/kimic/craft && sudo chown -R nginx:nginx /var/www/kimic/craft"
```

**3. Optionally also refresh the original demo** — the server builds it from git:

```bash
npm run deploy:rafter
```

which runs `ssh admin@47.82.233.199 "cd ~/craft && git pull && bash deploy/deploy.sh"`.
`deploy/deploy.sh` does `git pull` → `npm ci` → `npm run build` → copies `dist/` to
`/var/www/craft.rafter.com.cn/`.

### One-time server setup

SSH in (`ssh admin@47.82.233.199`), then:

```bash
# Node.js 20 + git (Aliyun Linux / CentOS)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Clone and first deploy
git clone https://github.com/KimiC/craft.git ~/craft
cd ~/craft
chmod +x deploy/setup-server.sh deploy/deploy.sh
bash deploy/setup-server.sh
```

### nginx

| Config file | Serves |
|---|---|
| `/etc/nginx/conf.d/kimic.cn.conf` | `kimic.cn` — the homepage at `/var/www/kimic`, the game under `/craft/` |
| `/etc/nginx/conf.d/craft.rafter.com.cn.conf` | `craft.rafter.com.cn` |

Both set `charset utf-8`. Templates live in `deploy/` (`nginx.craft.conf.example`).

### DNS

| Type | Host | Points at |
|---|---|---|
| A | `kimic.cn` | server public IP `47.82.233.199` |
| A | `craft.rafter.com.cn` | server public IP `47.82.233.199` |

### HTTPS

Certificates for both domains are already issued by certbot and renewed by its
timer. Check them with:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

If a certificate ever needs reissuing, `deploy/setup-https.sh` on the server does it
(`sudo certbot --nginx -d <domain>` is the manual fallback). HTTPS is not cosmetic
here: mobile browsers only allow Pointer Lock on a secure origin, so the game is
unplayable on a phone over plain HTTP.

## Architecture

```
src/
├── config.ts        All the tunable numbers (start here)
├── engine/          Game loop, input, touch controls, first-person camera
├── world/           Chunks, terrain + cave/ore generation, block registry, raycast
├── render/          Renderer, chunk mesher, procedural texture atlas, sky, particles
├── player/          Movement, collision, swimming, flying
├── game/            StarField — the collect-the-stars challenge loop
├── audio/           WebAudio synthesiser (no sound files)
├── ui/              DOM HUD, toasts, menus
├── save/            IndexedDB persistence
└── net/             Protocol stubs for future multiplayer
```

Rendering pipeline in one line: voxel data lives in `Uint8Array` chunks → `ChunkMesh`
walks each chunk and emits only the faces that can be seen → one `Mesh` per chunk,
all sharing a single material and a single 128×128 procedural texture atlas.

## License

Original voxel sandbox — not affiliated with Minecraft.