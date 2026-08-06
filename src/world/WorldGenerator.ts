import { createNoise2D } from 'simplex-noise';
import { BlockId, CHUNK_HEIGHT, CHUNK_SIZE, WORLD_SEED } from './BlockRegistry';
import { Chunk } from './Chunk';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export class WorldGenerator {
  private noise2D: ReturnType<typeof createNoise2D>;
  private rand: () => number;

  constructor(seed = WORLD_SEED) {
    this.rand = seededRandom(seed);
    this.noise2D = createNoise2D(this.rand);
  }

  generateChunk(cx: number, cz: number): Chunk {
    const chunk = new Chunk(cx, cz);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const height = this.getTerrainHeight(wx, wz);

        for (let y = 0; y <= height && y < CHUNK_HEIGHT; y++) {
          let block: BlockId;
          if (y === height) {
            block = height < 30 ? BlockId.Sand : BlockId.Grass;
          } else if (y > height - 4) {
            block = height < 30 ? BlockId.Sand : BlockId.Dirt;
          } else {
            block = BlockId.Stone;
          }
          chunk.setBlock(lx, y, lz, block);
        }

        if (height < 28) {
          for (let y = height + 1; y <= 28 && y < CHUNK_HEIGHT; y++) {
            chunk.setBlock(lx, y, lz, BlockId.Water);
          }
        }
      }
    }

    this.generateTrees(chunk, baseX, baseZ);
    return chunk;
  }

  private getTerrainHeight(wx: number, wz: number): number {
    const n1 = this.noise2D(wx * 0.008, wz * 0.008);
    const n2 = this.noise2D(wx * 0.02, wz * 0.02) * 0.3;
    const n3 = this.noise2D(wx * 0.05, wz * 0.05) * 0.1;
    return Math.floor((n1 + n2 + n3) * 24 + 36);
  }

  private generateTrees(chunk: Chunk, baseX: number, baseZ: number): void {
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const height = this.getTerrainHeight(wx, wz);
        if (height < 30) continue;

        const treeNoise = this.noise2D(wx * 0.5 + 100, wz * 0.5 + 100);
        if (treeNoise < 0.72) continue;

        const surfaceY = height + 1;
        if (surfaceY + 6 >= CHUNK_HEIGHT) continue;

        for (let ty = 0; ty < 4; ty++) {
          chunk.setBlock(lx, surfaceY + ty, lz, BlockId.Wood);
        }
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 3) continue;
              const tx = lx + dx;
              const tz = lz + dz;
              const ty = surfaceY + 3 + dy;
              if (chunk.getBlock(tx, ty, tz) === BlockId.Air) {
                chunk.setBlock(tx, ty, tz, BlockId.Leaves);
              }
            }
          }
        }
      }
    }
  }
}
