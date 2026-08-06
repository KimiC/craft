import { BlockId } from './BlockRegistry';
import type { ChunkManager } from './ChunkManager';

export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  /** Normal of the hit face */
  nx: number;
  ny: number;
  nz: number;
  blockId: number;
}

const MAX_DIST = 8;

/** Voxel DDA raycast through the world grid */
export function raycastVoxel(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  world: ChunkManager,
): RaycastHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = direction.x > 0 ? 1 : direction.x < 0 ? -1 : 0;
  const stepY = direction.y > 0 ? 1 : direction.y < 0 ? -1 : 0;
  const stepZ = direction.z > 0 ? 1 : direction.z < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

  const frac = (v: number) => v - Math.floor(v);
  let tMaxX = stepX > 0 ? (1 - frac(origin.x)) * tDeltaX : stepX < 0 ? frac(origin.x) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (1 - frac(origin.y)) * tDeltaY : stepY < 0 ? frac(origin.y) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (1 - frac(origin.z)) * tDeltaZ : stepZ < 0 ? frac(origin.z) * tDeltaZ : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;

  while (dist < MAX_DIST) {
    const blockId = world.getBlock(x, y, z);
    if (blockId !== BlockId.Air && blockId !== BlockId.Water) {
      return { x, y, z, nx, ny, nz, blockId };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY;
        dist = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
  }

  return null;
}
