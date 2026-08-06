import { FPCamera } from './Camera';
import { InputManager } from './InputManager';
import { ChunkManager } from '../world/ChunkManager';
import { raycastVoxel } from '../world/Raycast';
import { BlockId, PLACEABLE_BLOCKS, RENDER_DISTANCE, getBlock } from '../world/BlockRegistry';
import { Renderer } from '../render/Renderer';
import { TextureAtlas } from '../render/TextureAtlas';
import { ChunkMeshManager } from '../render/ChunkMesh';
import { Player } from '../player/Player';
import { SaveManager } from '../save/SaveManager';

export class Game {
  private renderer: Renderer;
  private input: InputManager;
  private fpCamera: FPCamera;
  private world: ChunkManager;
  private meshManager: ChunkMeshManager;
  private player: Player;
  private saveManager: SaveManager;
  private atlas: TextureAtlas;

  private running = false;
  private lastTime = 0;
  private frameCount = 0;
  private fps = 0;
  private fpsTimer = 0;
  private selectedSlot = 0;
  private saveTimer = 0;
  private readonly SAVE_INTERVAL = 30;

  private overlay: HTMLElement;
  private hud: HTMLElement;
  private infoEl: HTMLElement;
  private hotbarEl: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    this.overlay = document.getElementById('overlay')!;
    this.hud = document.getElementById('hud')!;
    this.infoEl = document.getElementById('info')!;
    this.hotbarEl = document.getElementById('hotbar')!;

    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas);
    this.fpCamera = new FPCamera();
    this.world = new ChunkManager();
    this.atlas = new TextureAtlas();
    this.meshManager = new ChunkMeshManager(this.atlas, this.world, this.renderer.scene);
    this.player = new Player(this.world);
    this.saveManager = new SaveManager();

    this.buildHotbar();
    document.getElementById('start-btn')!.addEventListener('click', () => this.start());
  }

  private buildHotbar(): void {
    this.hotbarEl.innerHTML = '';
    PLACEABLE_BLOCKS.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (i === 0 ? ' selected' : '');
      slot.textContent = getBlock(id).name.slice(0, 4);
      slot.style.background = this.getBlockColor(id);
      this.hotbarEl.appendChild(slot);
    });
  }

  private getBlockColor(id: BlockId): string {
    const colors: Partial<Record<BlockId, string>> = {
      [BlockId.Grass]: '#5cb85c',
      [BlockId.Dirt]: '#8B6914',
      [BlockId.Stone]: '#888',
      [BlockId.Sand]: '#dbc67a',
      [BlockId.Wood]: '#6b4226',
      [BlockId.Leaves]: '#2d8a2d',
      [BlockId.Glass]: '#aaddff',
      [BlockId.Cobblestone]: '#666',
      [BlockId.Planks]: '#c49a6c',
    };
    return colors[id] ?? '#555';
  }

  private async start(): Promise<void> {
    await this.saveManager.init();

    const saved = await this.saveManager.load();
    if (saved) {
      this.world.loadFromSaved(saved.chunks);
      this.player.position.set(saved.playerPos.x, saved.playerPos.y, saved.playerPos.z);
    } else {
      this.world.loadChunksAround(8, 8, RENDER_DISTANCE);
    }

    this.rebuildAllMeshes();
    this.overlay.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.input.requestPointerLock();
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private rebuildAllMeshes(): void {
    for (const chunk of this.world.getLoadedChunks()) {
      this.meshManager.updateChunk(chunk);
      this.world.markClean(chunk);
    }
  }

  private loop(now: number): void {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.update(dt);
    this.renderer.render();

    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    if (!this.input.mouseLocked) return;

    const { dx, dy } = this.input.consumeMouseDelta();
    this.fpCamera.applyMouseDelta(dx, dy);

    for (let i = 0; i < 9 && i < PLACEABLE_BLOCKS.length; i++) {
      if (this.input.isDown(`Digit${i + 1}`)) {
        this.selectedSlot = i;
        this.updateHotbarSelection();
      }
    }

    this.player.update(
      {
        forward: this.input.isDown('KeyW'),
        back: this.input.isDown('KeyS'),
        left: this.input.isDown('KeyA'),
        right: this.input.isDown('KeyD'),
        jump: this.input.isDown('Space'),
      },
      dt,
      this.fpCamera.yaw,
    );

    this.world.loadChunksAround(this.player.position.x, this.player.position.z, RENDER_DISTANCE);
    const removed = this.world.unloadDistantChunks(this.player.position.x, this.player.position.z, RENDER_DISTANCE);
    for (const key of removed) {
      this.meshManager.removeChunk(key);
    }

    for (const chunk of this.world.getDirtyChunks()) {
      this.meshManager.updateChunk(chunk);
      this.world.markClean(chunk);
    }

    const eye = this.player.getEyePosition();
    this.fpCamera.applyToCamera(this.renderer.camera, eye);

    this.handleBlockInteraction(eye);

    this.saveTimer += dt;
    if (this.saveTimer >= this.SAVE_INTERVAL) {
      this.saveTimer = 0;
      void this.saveManager.save(this.world.getAllChunks(), {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      });
    }

    this.updateHud();
  }

  private handleBlockInteraction(eye: { x: number; y: number; z: number }): void {
    const dir = this.fpCamera.getForward();
    const hit = raycastVoxel(eye, dir, this.world);

    if (this.input.mouseLeftPressed && hit) {
      this.world.applyBlockChange(hit.x, hit.y, hit.z, BlockId.Air);
    }

    if (this.input.mouseRightPressed && hit) {
      const px = hit.x + hit.nx;
      const py = hit.y + hit.ny;
      const pz = hit.z + hit.nz;
      const block = PLACEABLE_BLOCKS[this.selectedSlot];
      const hw = 0.3;
      const px0 = this.player.position.x;
      const py0 = this.player.position.y;
      const pz0 = this.player.position.z;
      const overlaps =
        px >= Math.floor(px0 - hw) && px <= Math.floor(px0 + hw) &&
        py >= Math.floor(py0) && py <= Math.floor(py0 + 1.6) &&
        pz >= Math.floor(pz0 - hw) && pz <= Math.floor(pz0 + hw);
      if (!overlaps) {
        this.world.applyBlockChange(px, py, pz, block);
      }
    }
  }

  private updateHotbarSelection(): void {
    const slots = this.hotbarEl.querySelectorAll('.hotbar-slot');
    slots.forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedSlot);
    });
  }

  private updateHud(): void {
    const block = getBlock(PLACEABLE_BLOCKS[this.selectedSlot]);
    this.infoEl.innerHTML =
      `FPS: ${this.fps}<br>` +
      `Pos: ${this.player.position.x.toFixed(1)}, ${this.player.position.y.toFixed(1)}, ${this.player.position.z.toFixed(1)}<br>` +
      `Block: ${block.name}<br>` +
      `Chunks: ${this.world.getLoadedChunks().length}`;
  }
}
