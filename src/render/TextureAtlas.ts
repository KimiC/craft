import * as THREE from 'three';

const TILE = 16;
const ATLAS_COLS = 4;
const ATLAS_ROWS = 4;

/** Procedurally generated 16x16 block texture atlas */
export class TextureAtlas {
  readonly texture: THREE.Texture;
  readonly tileSize: number;
  readonly atlasSize: number;

  constructor() {
    this.tileSize = 1 / ATLAS_COLS;
    this.atlasSize = TILE * ATLAS_COLS;
    const canvas = document.createElement('canvas');
    canvas.width = this.atlasSize;
    canvas.height = TILE * ATLAS_ROWS;
    const ctx = canvas.getContext('2d')!;

    const colors: [string, string?, string?][] = [
      ['#5cb85c', '#4a9a4a', '#6ec86e'], // 0 grass top, 1 dirt, 2 grass side
      ['#8B6914'],                       // 1 dirt (unused dup)
      ['#8B6914'],                       // 2 grass side alt
      ['#888888'],                       // 3 stone
      ['#dbc67a'],                       // 4 sand
      ['#3366cc', '#2255aa'],            // 5 water
      ['#6b4226', '#5a3520'],            // 6 wood top, 7 wood side
      ['#5a3520'],                       // 7 wood bark
      ['#2d8a2d', '#267826'],            // 8 leaves
      ['#aaddff', '#88ccee'],            // 9 glass
      ['#666666', '#555555'],            // 10 cobblestone
      ['#c49a6c'],                       // 11 planks
      ['#999999', '#888888'],            // 12 gravel
    ];

    for (let i = 0; i < colors.length; i++) {
      const col = i % ATLAS_COLS;
      const row = Math.floor(i / ATLAS_COLS);
      const x = col * TILE;
      const y = row * TILE;
      const palette = colors[i];
      this.drawTile(ctx, x, y, palette[0], palette[1]);
    }

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  private drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, base: string, accent?: string): void {
    ctx.fillStyle = base;
    ctx.fillRect(x, y, TILE, TILE);
    if (accent) {
      ctx.fillStyle = accent;
      for (let i = 0; i < 8; i++) {
        const px = x + Math.floor(Math.random() * TILE);
        const py = y + Math.floor(Math.random() * TILE);
        ctx.fillRect(px, py, 2, 2);
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 6; i++) {
        const px = x + Math.floor(Math.random() * TILE);
        const py = y + Math.floor(Math.random() * TILE);
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }

  getUV(tileIndex: number): [number, number, number, number] {
    const col = tileIndex % ATLAS_COLS;
    const row = Math.floor(tileIndex / ATLAS_COLS);
    const u0 = col * this.tileSize;
    const v1 = 1 - row * this.tileSize;
    const u1 = u0 + this.tileSize;
    const v0 = v1 - this.tileSize;
    return [u0, v0, u1, v1];
  }
}
