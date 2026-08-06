import * as THREE from 'three';
import { BlockId, CHUNK_HEIGHT, CHUNK_SIZE, getBlock } from '../world/BlockRegistry';
import type { Chunk } from '../world/Chunk';
import type { ChunkManager } from '../world/ChunkManager';
import type { TextureAtlas } from './TextureAtlas';

type Face = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

const FACE_NORMALS: Record<Face, [number, number, number]> = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
};

const FACE_VERTS: Record<Face, [number, number, number][]> = {
  top: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]],
  bottom: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]],
  north: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]],
  south: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
  east: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]],
  west: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]],
};

export class ChunkMeshBuilder {
  constructor(
    private atlas: TextureAtlas,
    private world: ChunkManager,
  ) {}

  build(chunk: Chunk): THREE.Mesh {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertOffset = 0;

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = chunk.getBlock(lx, ly, lz);
          if (blockId === BlockId.Air) continue;

          const def = getBlock(blockId);
          const wx = baseX + lx;
          const wz = baseZ + lz;

          const faces: Face[] = ['top', 'bottom', 'north', 'south', 'east', 'west'];
          for (const face of faces) {
            const [nx, ny, nz] = FACE_NORMALS[face];
            if (!this.world.shouldRenderFace(wx + nx, ly + ny, wz + nz, blockId)) continue;

            let tileIndex: number;
            if (face === 'top') tileIndex = def.textures[0];
            else if (face === 'bottom') tileIndex = def.textures[1];
            else tileIndex = def.textures[2];

            const [u0, v0, u1, v1] = this.atlas.getUV(tileIndex);
            const uvCorners = [[u0,v1],[u1,v1],[u1,v0],[u0,v0]];

            for (let vi = 0; vi < 4; vi++) {
              const [vx, vy, vz] = FACE_VERTS[face][vi];
              positions.push(baseX + lx + vx, ly + vy, baseZ + lz + vz);
              uvs.push(uvCorners[vi][0], uvCorners[vi][1]);
            }
            indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
            vertOffset += 4;
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      side: THREE.FrontSide,
      transparent: true,
      alphaTest: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = true;
    return mesh;
  }
}

export class ChunkMeshManager {
  private meshes = new Map<string, THREE.Mesh>();
  private builder: ChunkMeshBuilder;

  constructor(
    atlas: TextureAtlas,
    world: ChunkManager,
    private scene: THREE.Scene,
  ) {
    this.builder = new ChunkMeshBuilder(atlas, world);
  }

  updateChunk(chunk: Chunk): void {
    const key = `${chunk.cx},${chunk.cz}`;
    const existing = this.meshes.get(key);
    if (existing) {
      this.scene.remove(existing);
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
    }

    const mesh = this.builder.build(chunk);
    mesh.userData.chunkKey = key;
    this.meshes.set(key, mesh);
    this.scene.add(mesh);
  }

  removeChunk(key: string): void {
    const mesh = this.meshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.meshes.delete(key);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.clear();
  }
}
