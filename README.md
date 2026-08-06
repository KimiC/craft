# Rafter Voxel Sandbox

Browser-based voxel sandbox game built with TypeScript, Three.js, and Vite.

> Demo for [KimiC](https://github.com/KimiC) — play at http://craft.rafter.com.cn/

## Features (MVP)
- First-person movement (WASD + jump)
- Pointer Lock mouse look
- Procedural terrain (Simplex noise)
- Chunk system with face culling
- Place/break blocks (left/right click)
- 9 placeable block types
- IndexedDB auto-save every 30 seconds
- Multiplayer-ready protocol stubs

## Controls

### Desktop

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Mouse | Look |
| Left click | Break block |
| Right click | Place block |
| 1-9 | Select block type |

### Mobile (phone / tablet)

| Control | Action |
|---------|--------|
| Left joystick | Move |
| Drag right side of screen | Look around |
| Break / Place / Jump buttons | Actions |
| Tap hotbar slot | Select block |

Play on phone: http://craft.rafter.com.cn/

## Getting started for KimiC

1. Accept the GitHub collaborator invite (email from GitHub)
2. Install [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/)
3. Clone and run:

```bash
git clone https://github.com/Raft-chen/craft.git
cd craft
npm install
npm run dev
```

4. Open http://localhost:5173/ in your browser
5. Live game: http://craft.rafter.com.cn/
6. After changes: `git add .` → `git commit -m "message"` → `git push`

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/

## Production Build

```bash
npm run build
```

Output in `dist/` — deploy to web server root.

## Deploy to craft.rafter.com.cn (Git)

### One-time server setup

SSH into ECS (web terminal or `ssh admin@47.82.233.199`), then:

```bash
# Install Node.js 20 if needed (Aliyun Linux / CentOS)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Clone and first deploy
git clone https://github.com/Raft-chen/craft.git ~/craft
cd ~/craft
chmod +x deploy/setup-server.sh deploy/deploy.sh
bash deploy/setup-server.sh
```

Ensure nginx is configured — see [deploy/nginx.craft.conf.example](deploy/nginx.craft.conf.example)  
(Aliyun Linux uses `/etc/nginx/conf.d/craft.rafter.com.cn.conf`)

### Every update (your workflow)

**On your PC** — commit and push:

```powershell
cd C:\fw\Turin_BIOS_code\rafter-voxel
git add .
git commit -m "Describe your change"
git push
```

**Deploy to server** — either:

```powershell
# Option A: from PC, trigger remote build
npm run deploy
# or
.\deploy\deploy.ps1
```

```bash
# Option B: on the server directly
cd ~/craft
git pull origin main
bash deploy/deploy.sh
```

The script pulls git, runs `npm ci`, `npm run build`, and copies `dist/` to `/var/www/craft.rafter.com.cn/`.

### DNS

| Type | Host | Value |
|------|------|-------|
| A | craft | your server public IP |

Access: **http://craft.rafter.com.cn/**

### HTTPS (optional)

```bash
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d craft.rafter.com.cn
```

## Architecture

```
src/
├── engine/     Game loop, input, camera
├── world/      Chunks, terrain, raycast
├── render/     Three.js renderer, mesh builder
├── player/     Physics & collision
├── save/       IndexedDB persistence
└── net/        Protocol stubs for future multiplayer
```

## License

Original voxel sandbox — not affiliated with Minecraft.