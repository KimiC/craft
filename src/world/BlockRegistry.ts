export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;
export const RENDER_DISTANCE = 6;
export const WORLD_SEED = 42;

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Water = 5,
  Wood = 6,
  Leaves = 7,
  Glass = 8,
  Cobblestone = 9,
  Planks = 10,
  Gravel = 11,
}

export interface BlockDef {
  id: BlockId;
  name: string;
  solid: boolean;
  transparent: boolean;
  /** Texture index in atlas for each face: [top, bottom, sides] */
  textures: [number, number, number];
}

const T = (n: number): [number, number, number] => [n, n, n];

export const BLOCKS: Record<BlockId, BlockDef> = {
  [BlockId.Air]: { id: BlockId.Air, name: 'Air', solid: false, transparent: true, textures: T(0) },
  [BlockId.Grass]: { id: BlockId.Grass, name: 'Grass', solid: true, transparent: false, textures: [0, 1, 2] },
  [BlockId.Dirt]: { id: BlockId.Dirt, name: 'Dirt', solid: true, transparent: false, textures: T(1) },
  [BlockId.Stone]: { id: BlockId.Stone, name: 'Stone', solid: true, transparent: false, textures: T(3) },
  [BlockId.Sand]: { id: BlockId.Sand, name: 'Sand', solid: true, transparent: false, textures: T(4) },
  [BlockId.Water]: { id: BlockId.Water, name: 'Water', solid: false, transparent: true, textures: T(5) },
  [BlockId.Wood]: { id: BlockId.Wood, name: 'Wood', solid: true, transparent: false, textures: [6, 6, 7] },
  [BlockId.Leaves]: { id: BlockId.Leaves, name: 'Leaves', solid: true, transparent: true, textures: T(8) },
  [BlockId.Glass]: { id: BlockId.Glass, name: 'Glass', solid: true, transparent: true, textures: T(9) },
  [BlockId.Cobblestone]: { id: BlockId.Cobblestone, name: 'Cobblestone', solid: true, transparent: false, textures: T(10) },
  [BlockId.Planks]: { id: BlockId.Planks, name: 'Planks', solid: true, transparent: false, textures: T(11) },
  [BlockId.Gravel]: { id: BlockId.Gravel, name: 'Gravel', solid: true, transparent: false, textures: T(12) },
};

export const PLACEABLE_BLOCKS: BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Sand,
  BlockId.Wood,
  BlockId.Leaves,
  BlockId.Glass,
  BlockId.Cobblestone,
  BlockId.Planks,
];

export function getBlock(id: number): BlockDef {
  return BLOCKS[id as BlockId] ?? BLOCKS[BlockId.Air];
}

export function isSolid(id: number): boolean {
  return getBlock(id).solid;
}

export function isTransparent(id: number): boolean {
  return getBlock(id).transparent;
}
