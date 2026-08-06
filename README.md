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

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Mouse | Look |
| Left click | Break block |
| Right click | Place block |
| 1-9 | Select block type |

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

## Deploy to craft.rafter.com.cn

### 1. DNS

Add an **A record** at your domain registrar:

| Type | Host | Value |
|------|------|-------|
| A | craft | `<your-server-IP>` |

Verify: `ping craft.rafter.com.cn` should resolve to your server IP.

### 2. Server nginx config

Copy [deploy/nginx.craft.conf.example](deploy/nginx.craft.conf.example) to your server:

```bash
sudo cp deploy/nginx.craft.conf.example /etc/nginx/sites-available/craft.rafter.com.cn
sudo ln -sf /etc/nginx/sites-available/craft.rafter.com.cn /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/craft.rafter.com.cn
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Upload build

**PowerShell (Windows):**

```powershell
cd C:\fw\Turin_BIOS_code\rafter-voxel
.\deploy\deploy.ps1 -Server user@your-server
```

**Manual (Linux/macOS):**

```bash
npm run build
rsync -avz --delete dist/ user@your-server:/var/www/craft.rafter.com.cn/
```

### 4. HTTPS (recommended)

Pointer Lock API works best over HTTPS:

```bash
sudo certbot --nginx -d craft.rafter.com.cn
```

Access at: **http://craft.rafter.com.cn/** (or https after certbot)

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