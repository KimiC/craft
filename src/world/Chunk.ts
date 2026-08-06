import { CHUNK_HEIGHT, CHUNK_SIZE } from './BlockRegistry';

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(wx: number, wz: number): { cx: number; cz: number } {
  return {
    cx: Math.floor(wx / CHUNK_SIZE),
    cz: Math.floor(wz / CHUNK_SIZE),
  };
}

export function worldToLocal(wx: number, wy: number, wz: number): { lx: number; ly: number; lz: number; cx: number; cz: number } {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cz = Math.floor(wz / CHUNK_SIZE);
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return { lx, ly: wy, lz, cx, cz };
}

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  dirty = true;
  meshKey = 0;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  index(lx: number, ly: number, lz: number): number {
    return lx + lz * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE;
  }

  getBlock(lx: number, ly: number, lz: number): number {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
      return 0;
    }
    return this.blocks[this.index(lx, ly, lz)];
  }

  setBlock(lx: number, ly: number, lz: number, id: number): void {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
      return;
    }
    this.blocks[this.index(lx, ly, lz)] = id;
    this.dirty = true;
  }

  serialize(): ArrayBuffer {
    const header = new Int32Array([this.cx, this.cz]);
    const combined = new Uint8Array(header.byteLength + this.blocks.byteLength);
    combined.set(new Uint8Array(header.buffer), 0);
    combined.set(new Uint8Array(this.blocks.buffer), header.byteLength);
    return combined.buffer;
  }

  static deserialize(data: ArrayBuffer): Chunk {
    const header = new Int32Array(data, 0, 2);
    const chunk = new Chunk(header[0], header[1]);
    chunk.blocks.set(new Uint8Array(data, 8));
    chunk.dirty = true;
    return chunk;
  }
}
