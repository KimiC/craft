import * as THREE from 'three';
import type { ChunkManager } from '../world/ChunkManager';

const GRAVITY = -28;
const JUMP_SPEED = 9;
const MOVE_SPEED = 5.5;
const PLAYER_HEIGHT = 1.7;
const PLAYER_WIDTH = 0.6;

export class Player {
  position = new THREE.Vector3(8, 40, 8);
  velocity = new THREE.Vector3();
  onGround = false;

  constructor(private world: ChunkManager) {}

  update(input: { forward: boolean; back: boolean; left: boolean; right: boolean; jump: boolean }, dt: number, yaw: number): void {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0));
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const move = new THREE.Vector3();
    if (input.forward) move.add(forward);
    if (input.back) move.sub(forward);
    if (input.right) move.add(right);
    if (input.left) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(MOVE_SPEED);

    this.velocity.x = move.x;
    this.velocity.z = move.z;

    if (input.jump && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }

    this.velocity.y += GRAVITY * dt;

    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);
    this.moveAxis('y', this.velocity.y * dt);

    if (this.position.y < -10) {
      this.respawn();
    }
  }

  private moveAxis(axis: 'x' | 'y' | 'z', delta: number): void {
    if (delta === 0) return;
    this.position[axis] += delta;

    const hw = PLAYER_WIDTH / 2;
    const minX = Math.floor(this.position.x - hw);
    const maxX = Math.floor(this.position.x + hw);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + PLAYER_HEIGHT - 0.01);
    const minZ = Math.floor(this.position.z - hw);
    const maxZ = Math.floor(this.position.z + hw);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (!this.world.isBlockSolid(x, y, z)) continue;

          if (axis === 'x') {
            if (delta > 0) this.position.x = x - hw - 0.001;
            else this.position.x = x + 1 + hw + 0.001;
            this.velocity.x = 0;
          } else if (axis === 'y') {
            if (delta > 0) {
              this.position.y = y - PLAYER_HEIGHT - 0.001;
              this.velocity.y = 0;
            } else {
              this.position.y = y + 1 + 0.001;
              this.velocity.y = 0;
              this.onGround = true;
            }
          } else {
            if (delta > 0) this.position.z = z - hw - 0.001;
            else this.position.z = z + 1 + hw + 0.001;
            this.velocity.z = 0;
          }
          return;
        }
      }
    }

    if (axis === 'y' && delta < 0) {
      this.onGround = false;
    }
  }

  respawn(): void {
    this.position.set(8, 50, 8);
    this.velocity.set(0, 0, 0);
  }

  getEyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + PLAYER_HEIGHT - 0.2, this.position.z);
  }
}
