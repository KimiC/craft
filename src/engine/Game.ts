import * as THREE from 'three';
import { FPCamera } from './Camera';
import { InputManager } from './InputManager';
import { TouchControls } from './TouchControls';
import { ChunkManager } from '../world/ChunkManager';
import { raycastVoxel } from '../world/Raycast';
import { BlockId, CHUNK_HEIGHT, PLACEABLE_BLOCKS, getBlock } from '../world/BlockRegistry';
import { Renderer } from '../render/Renderer';
import { TextureAtlas } from '../render/TextureAtlas';
import { ChunkMeshManager } from '../render/ChunkMesh';
import { Sky } from '../render/Sky';
import { ParticleSystem } from '../render/Particles';
import { Player } from '../player/Player';
import { SaveManager } from '../save/SaveManager';
import { StarField } from '../game/StarField';
import { AudioEngine } from '../audio/AudioEngine';
import { Ui, formatTime } from '../ui/Ui';
import { CONFIG } from '../config';

const BEST_KEY = 'craft.bestTime';

interface UndoEntry {
  x: number;
  y: number;
  z: number;
  prev: number;
}

interface PendingBoom {
  x: number;
  y: number;
  z: number;
  t: number;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

export class Game {
  private renderer: Renderer;
  private sky: Sky;
  private input: InputManager;
  private touch: TouchControls | null = null;
  private fpCamera: FPCamera;
  private world: ChunkManager;
  private meshManager: ChunkMeshManager;
  private player: Player;
  private saveManager: SaveManager;
  private atlas: TextureAtlas;
  private particles: ParticleSystem;
  private stars: StarField;
  private audio = new AudioEngine();
  private ui = new Ui();

  private running = false;
  private active = false;
  private paused = false;
  private lastTime = 0;
  private fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;
  private selectedSlot = 0;
  private renderDistance: number = CONFIG.world.renderDistance;

  private highlight: THREE.LineSegments;
  private saveTimer = 0;
  private editsSinceSave = 0;
  private undoStack: UndoEntry[] = [];
  private booms: PendingBoom[] = [];

  private elapsedMs = 0;
  private round = 1;
  private bestMs: number | null = null;
  private roundDone = false;
  private nextRoundTimer = 0;

  private interactCooldown = 0;
  private stepTimer = 0;
  private shake = 0;
  private showDebug = false;
  /** Command console open: game keys are ignored and the pointer is released. */
  private consoleOpen = false;
  /** Command attached to each command-block position, keyed "x,y,z". */
  private readonly commandBlocks = new Map<string, string>();
  private readonly commandCooldown = new Map<string, number>();
  private consoleMode: 'command' | 'block' = 'command';
  private editingBlock: { x: number; y: number; z: number } | null = null;
  private clock = 0;
  private suppressPause = false;
  private wasInWater = false;
  /** 0 = eyes in air, 1 = eyes fully under water (smoothed). */
  private underwater = 0;
  private baseFogNear = 65;
  private baseFogFar = 125;
  private readonly tintColor = new THREE.Color();
  private readonly clearColor = new THREE.Color();
  /** WebGL renderer string, so F3 can show whether the GPU is really in use. */
  private readonly gpuName: string;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    const fog = this.renderer.scene.fog as THREE.Fog | null;
    if (fog) {
      this.baseFogNear = fog.near;
      this.baseFogFar = fog.far;
    }

    const gl = this.renderer.renderer.getContext();
    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpuName = dbgInfo
      ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)).slice(0, 70)
      : 'unknown';
    this.sky = new Sky(this.renderer.scene, this.renderer.renderer);
    this.input = new InputManager(canvas);
    this.fpCamera = new FPCamera();
    this.world = new ChunkManager();
    this.atlas = new TextureAtlas();
    this.atlas.setMaxAnisotropy(this.renderer.renderer.capabilities.getMaxAnisotropy());
    this.meshManager = new ChunkMeshManager(this.atlas, this.world, this.renderer.scene);
    this.player = new Player(this.world);
    this.saveManager = new SaveManager();
    this.particles = new ParticleSystem(this.renderer.scene);
    this.stars = new StarField(this.renderer.scene);

    this.highlight = this.makeHighlight();
    this.bestMs = this.readBest();

    if (this.input.mobile) {
      this.renderDistance = CONFIG.world.mobileRenderDistance;
      document.body.classList.add('mobile');
    }

    this.buildHotbar();
    this.wireUi();

    if (this.input.mobile) {
      this.touch = new TouchControls(this.ui.mobileControls, () => this.toggleFly());
      this.touch.setFlying(false);
    }
  }

  private makeHighlight(): THREE.LineSegments {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    const mat = new THREE.LineBasicMaterial({
      color: 0x0b1220,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.visible = false;
    this.renderer.scene.add(lines);
    return lines;
  }

  // ---------------------------------------------------------------- wiring

  private wireUi(): void {
    this.ui.btnPlay.addEventListener('click', () => void this.startGame(false));
    this.ui.btnNew.addEventListener('click', () => void this.startGame(true));
    this.ui.btnResume.addEventListener('click', () => this.setPaused(false));
    this.ui.btnHelp.addEventListener('click', () => this.showHelp());
    this.ui.btnCloseHelp.addEventListener('click', () => this.closeHelp());
    this.ui.btnQuit.addEventListener('click', () => void this.quitToMenu());
    this.ui.btnMenu.addEventListener('click', () => this.setPaused(true));
    this.ui.onSlotClick = (i) => this.selectSlot(i);

    this.ui.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.startGame(false);
    });

    document.addEventListener('pointerlockchange', () => {
      if (this.input.mobile || !this.active) return;
      if (document.pointerLockElement) {
        if (this.paused) this.setPaused(false);
        return;
      }
      if (this.suppressPause || this.paused) return;
      this.setPaused(true);
    });

    document.addEventListener('pointerlockerror', () => {
      if (this.input.mobile || !this.active) return;
      // Re-locking after the console closes can be refused (no user gesture in
      // some browsers); that must not look like the player pressed Esc.
      if (this.suppressPause) return;
      this.setPaused(true);
    });

    this.ui.consoleInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const line = this.ui.consoleInput.value.trim();
        this.ui.consoleInput.value = '';
        if (this.consoleMode === 'block') {
          this.saveBlockCommand(line);
          return;
        }
        if (line === '') {
          this.closeConsole();
          return;
        }
        this.runCommand(line);
      } else if (e.key === 'Escape') {
        this.closeConsole();
      }
    });

    void this.refreshStartScreen();
  }

  private async refreshStartScreen(): Promise<void> {
    try {
      const saved = await this.saveManager.load();
      if (saved && saved.chunks.length > 0) {
        this.ui.seedInput.value = String(saved.seed);
        this.ui.btnPlay.textContent = 'Continue';
        this.ui.startNote.textContent = `Saved world found (seed ${saved.seed}) — Play continues where you left off.`;
      } else {
        this.ui.btnPlay.textContent = 'Play';
        this.ui.startNote.textContent = 'No saved world yet — pick a seed and hit Play.';
      }
    } catch {
      this.ui.startNote.textContent = 'Saving is unavailable in this browser, but you can still play.';
    }
  }

  private buildHotbar(): void {
    const items = PLACEABLE_BLOCKS.map((id) => {
      const def = getBlock(id);
      return { icon: this.atlas.iconDataURL(def.textures[0], 64), label: def.name };
    });
    this.ui.buildHotbar(items, this.selectedSlot);
  }

  private selectSlot(index: number): void {
    const count = PLACEABLE_BLOCKS.length;
    this.selectedSlot = ((index % count) + count) % count;
    this.ui.selectSlot(this.selectedSlot);
  }

  // ---------------------------------------------------------------- lifecycle

  private async startGame(fresh: boolean): Promise<void> {
    if (this.running) return;

    // Pointer lock must be requested inside the click handler, before any await.
    this.audio.unlock();
    this.audio.ui();
    if (!this.input.mobile) this.input.requestPointerLock();

    this.ui.startNote.textContent = 'Shaping the world…';
    await nextFrame();

    const parsed = parseInt(this.ui.seedInput.value.trim(), 10);
    const seed = Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 99999);

    try {
      await this.saveManager.init();
    } catch {
      /* storage may be blocked; play anyway */
    }

    this.editsSinceSave = 0;
    this.undoStack = [];
    this.booms = [];
    this.saveTimer = 0;

    if (fresh) {
      await this.saveManager.clear().catch(() => undefined);
      this.world.reset(seed);
      this.ui.seedInput.value = String(seed);
      this.buildFreshWorld();
    } else {
      const saved = await this.saveManager.load().catch(() => null);
      if (saved && saved.chunks.length > 0) {
        this.world.reset(saved.seed);
        this.world.loadFromSaved(saved.chunks);
        this.player.position.set(saved.playerPos.x, saved.playerPos.y, saved.playerPos.z);
        this.world.loadChunksAround(this.player.position.x, this.player.position.z, this.renderDistance);
        this.player.placeOnGround(this.world);
        this.commandBlocks.clear();
        for (const [key, cmd] of Object.entries(saved.commands ?? {})) {
          this.commandBlocks.set(key, cmd);
        }
      } else {
        this.world.reset(seed);
        this.buildFreshWorld();
      }
    }

    this.rebuildAllMeshes();
    this.stars.spawn(this.world, this.player.position.x, this.player.position.z);

    this.ui.setBest(this.bestMs);
    this.ui.setScore(0, this.stars.total);
    this.ui.setTimer(formatTime(0));

    this.elapsedMs = 0;
    this.round = 1;
    this.roundDone = false;
    this.nextRoundTimer = 0;
    this.clock = 0;
    this.wasInWater = false;

    this.ui.showHud(this.input.mobile);

    this.active = true;
    this.paused = false;
    this.running = true;
    this.lastTime = performance.now();

    if (this.input.mobile) {
      this.input.setMobileActive(true);
    } else if (!this.input.mouseLocked) {
      this.setPaused(true);
    }

    this.ui.toast(`Collect the ${this.stars.total} glow-stars ★`, 'gold');
    requestAnimationFrame((t) => this.loop(t));
  }

  private buildFreshWorld(): void {
    const spawn = this.findSpawn();
    this.player.position.copy(spawn);
    this.world.loadChunksAround(spawn.x, spawn.z, this.renderDistance);
    this.placeOnTerrain();
  }

  /**
   * Walk outwards until we find dry, reasonably flat land. Uses the generator's
   * height field so it works before any chunks are loaded.
   */
  private findSpawn(): THREE.Vector3 {
    const water = CONFIG.world.waterLevel;
    for (let ring = 0; ring < 60; ring++) {
      const radius = ring * 3;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = Math.round(8 + Math.cos(a) * radius);
        const z = Math.round(8 + Math.sin(a) * radius);
        const h = this.world.heightAt(x, z);
        if (h <= water + 2 || h > CONFIG.world.snowLine - 2) continue;
        if (!this.isFlat(x, z, h)) continue;
        if (!this.isAshore(x, z)) continue;
        return new THREE.Vector3(x + 0.5, h + 1.5, z + 0.5);
      }
    }
    return new THREE.Vector3(8.5, 70, 8.5);
  }

  private isFlat(x: number, z: number, h: number): boolean {
    for (let dx = -2; dx <= 2; dx += 2) {
      for (let dz = -2; dz <= 2; dz += 2) {
        if (Math.abs(this.world.heightAt(x + dx, z + dz) - h) > 3) return false;
      }
    }
    return true;
  }

  /** Avoid spawning on a 3x3 sandbar in the middle of the ocean. */
  private isAshore(x: number, z: number): boolean {
    let land = 0;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const h = this.world.heightAt(
        Math.round(x + Math.cos(a) * 14),
        Math.round(z + Math.sin(a) * 14),
      );
      if (h > CONFIG.world.waterLevel + 1) land++;
    }
    return land >= 8;
  }

  /** Make sure the player starts on open grass/sand/snow rather than on top of a tree. */
  private placeOnTerrain(): void {
    const origin = this.player.position;
    for (let r = 0; r < 12; r++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = Math.round(origin.x + Math.cos(a) * r * 2);
        const z = Math.round(origin.z + Math.sin(a) * r * 2);
        const top = this.world.topSolidY(x, z);
        if (top < 0) continue;
        const id = this.world.getBlock(x, top, z);
        if (id !== BlockId.Grass && id !== BlockId.Sand && id !== BlockId.Snow) continue;
        if (!this.hasRoomToStand(x, z, top)) continue;
        this.player.position.set(x + 0.5, top + 1.05, z + 0.5);
        this.player.velocity.set(0, 0, 0);
        this.faceOpenDirection(x, z, top);
        return;
      }
    }
  }

  /** Start the camera looking toward the flattest ground so the first view is inviting. */
  private faceOpenDirection(x: number, z: number, top: number): void {
    let bestYaw = 0;
    let bestScore = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      let score = 0;
      for (const d of [3, 6, 10, 16]) {
        score += Math.abs(this.world.heightAt(Math.round(x + dx * d), Math.round(z + dz * d)) - top);
      }
      if (score < bestScore) {
        bestScore = score;
        bestYaw = Math.atan2(-dx, -dz);
      }
    }
    this.fpCamera.yaw = bestYaw;
    this.fpCamera.pitch = -0.06;
  }

  /** True when the 3x3 around a column is level and has clear air for the body. */
  private hasRoomToStand(x: number, z: number, top: number): boolean {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(this.world.topSolidY(x + dx, z + dz) - top) > 1) return false;
        for (let y = top + 1; y <= top + 2; y++) {
          if (this.world.getBlock(x + dx, y, z + dz) !== BlockId.Air) return false;
        }
      }
    }
    return true;
  }

  private async quitToMenu(): Promise<void> {
    await this.saveNow();
    this.running = false;
    this.active = false;
    this.paused = false;
    if (this.input.mobile) this.input.setMobileActive(false);
    this.input.exitPointerLock();
    await this.refreshStartScreen();
    this.ui.showStart();
  }

  private setPaused(value: boolean): void {
    if (!this.active) return;
    this.paused = value;
    if (value) {
      if (this.input.mobile) this.input.setMobileActive(false);
      this.ui.showPause();
      return;
    }
    this.ui.showHud(this.input.mobile);
    if (this.input.mobile) {
      this.input.setMobileActive(true);
    } else if (!this.input.mouseLocked) {
      this.suppressPause = true;
      this.input.requestPointerLock();
      window.setTimeout(() => {
        this.suppressPause = false;
      }, 600);
    }
  }

  private showHelp(): void {
    if (!this.active) return;
    this.paused = true;
    if (this.input.mobile) this.input.setMobileActive(false);
    this.ui.showHelp();
  }

  private closeHelp(): void {
    this.setPaused(false);
  }

  private toggleFly(): void {
    this.player.toggleFly();
    this.touch?.setFlying(this.player.flying);
    this.ui.toast(this.player.flying ? 'Fly on — Space up, Shift down' : 'Fly off', 'green');
  }

  // ---------------------------------------------------------------- console

  /**
   * The "change the rules" entry point: press "/" to open a small command
   * console. Mouse look is released so the browser can type, and re-acquired
   * when the console closes; the pause-on-pointerlock-loss handler is muted
   * for the duration, otherwise opening the console would look like Esc.
   */
  private openConsole(mode: 'command' | 'block' = 'command'): void {
    if (!this.active || this.paused || this.consoleOpen) return;
    this.consoleMode = mode;
    this.consoleOpen = true;
    this.suppressPause = true;
    this.input.keys.clear();
    this.input.mouseLeft = false;
    this.input.mouseRight = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.openConsole();
    if (mode === 'command' && this.ui.consoleLogEmpty()) {
      this.ui.printConsole('输入 help 查看命令。Enter 执行，空行或 Esc 关闭。', 'info');
    }
    this.ui.consoleInput.focus();
  }

  private closeConsole(): void {
    if (!this.consoleOpen) return;
    this.consoleOpen = false;
    this.consoleMode = 'command';
    this.editingBlock = null;
    this.ui.closeConsole();
    this.ui.consoleInput.blur();
    if (!this.input.mobile) {
      this.suppressPause = true;
      this.input.requestPointerLock();
      window.setTimeout(() => {
        this.suppressPause = false;
      }, 600);
    }
  }

  /** A command block announces itself when you look at it and is edited with E. */
  private openBlockEditor(x: number, y: number, z: number): void {
    this.editingBlock = { x, y, z };
    this.openConsole('block');
    if (!this.consoleOpen) return;
    const key = `${x},${y},${z}`;
    const current = this.commandBlocks.get(key);
    this.ui.printConsole(`命令方块 (${x}, ${y}, ${z})`, 'ok');
    this.ui.printConsole(
      current ? `当前命令：${current}` : '还没有命令。例如：star 3 / time 22 / box 3 / gravity 0',
      'info',
    );
    this.ui.printConsole('Enter 保存，留空或输入 - 清除，Esc 取消。', 'info');
    this.ui.consoleInput.value = current ?? '';
    this.ui.consoleInput.focus();
  }

  private saveBlockCommand(line: string): void {
    const b = this.editingBlock;
    if (!b) {
      this.closeConsole();
      return;
    }
    const key = `${b.x},${b.y},${b.z}`;
    if (line === '' || line === '-' || line === 'remove') {
      this.commandBlocks.delete(key);
      this.commandCooldown.delete(key);
      this.ui.printConsole('已清除这个方块的命令', 'ok');
    } else {
      this.commandBlocks.set(key, line);
      this.ui.printConsole(`保存：${line}`, 'ok');
      this.ui.printConsole('站到这个方块上就会执行。', 'info');
    }
    this.editsSinceSave++;
    this.closeConsole();
  }

  /** Fires the command of the block the player is standing on. */
  private tickCommandBlocks(): void {
    if (this.consoleOpen || this.commandBlocks.size === 0) return;
    const p = this.player.position;
    const bx = Math.floor(p.x);
    const bz = Math.floor(p.z);
    const feet = Math.floor(p.y);
    // Standing on top of the block puts the feet at its upper face, so the
    // block itself is one cell *below* floor(feet); walking through it puts it
    // at feet level. Check both.
    let key: string | null = null;
    for (const by of [feet, feet - 1]) {
      const k = `${bx},${by},${bz}`;
      if (this.commandBlocks.has(k)) {
        key = k;
        break;
      }
    }
    if (!key) return;
    const cmd = this.commandBlocks.get(key);
    if (!cmd) return;
    const next = this.commandCooldown.get(key) ?? 0;
    if (this.clock < next) return;
    this.commandCooldown.set(key, this.clock + 1.6);
    this.runCommand(cmd);
    const [cx, cy, cz] = key.split(',').map(Number);
    this.particles.spawnBurst(cx + 0.5, cy + 1.05, cz + 0.5, 0xf0913c, 10, 3.4, 0.12);
  }

  private runCommand(raw: string): void {
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const num = (i: number, def: number): number => {
      const v = parseFloat(args[i]);
      return Number.isFinite(v) ? v : def;
    };
    const p = this.player.position;
    const where = `位置 ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`;

    switch (cmd) {
      case 'help':
      case '帮助':
      case '?':
        this.ui.printConsole('可用命令：', 'ok');
        this.ui.printConsole('  help / 帮助            显示命令列表');
        this.ui.printConsole('  time <0-24> / 时间     设置时间（0 午夜，12 正午）');
        this.ui.printConsole('  day / 白天   night / 夜晚');
        this.ui.printConsole('  tp <x> <y> <z> / 传送  相对当前位置移动');
        this.ui.printConsole('  where / 坐标           显示位置与种子');
        this.ui.printConsole('  fly / 飞行             开关飞行');
        this.ui.printConsole('  star [数量] / 星星     在周围生成星星');
        this.ui.printConsole('  speed <0.5-4> / 速度   移动速度倍数');
        this.ui.printConsole('  gravity <0-3> / 重力   重力倍数（0 是月球）');
        this.ui.printConsole('  box <半径>             用手里方块搭一个房间');
        this.ui.printConsole('  tnt                    在脚边点燃 TNT');
        this.ui.printConsole('  undo / 撤销            撤销上一次挖或放');
        this.ui.printConsole('  seed / 种子            显示世界种子');
        this.ui.printConsole('  clear                  清空屏幕');
        this.ui.printConsole('命令方块：把橙色方块放在地上，对着它按 E 输入命令，站上去就会执行。', 'info');
        break;
      case 'time':
      case '时间': {
        const h = num(0, NaN);
        if (!Number.isFinite(h)) {
          this.ui.printConsole('用法: time <0-24>', 'error');
          break;
        }
        this.sky.time = ((h % 24) + 24) % 24;
        this.ui.printConsole(`时间设为 ${this.sky.time.toFixed(1)} 点`, 'ok');
        break;
      }
      case 'day':
      case '白天':
        this.sky.time = 12;
        this.ui.printConsole('白天', 'ok');
        break;
      case 'night':
      case '夜晚':
        this.sky.time = 22;
        this.ui.printConsole('夜晚', 'ok');
        break;
      case 'tp':
      case '传送': {
        if (args.length < 3) {
          this.ui.printConsole('用法: tp <x> <y> <z>（相对当前位置）', 'error');
          break;
        }
        p.x += num(0, 0);
        p.y += num(1, 0);
        p.z += num(2, 0);
        p.y = Math.max(1, Math.min(CHUNK_HEIGHT - 2, p.y));
        this.player.velocity.set(0, 0, 0);
        this.ui.printConsole(`传送完成，${where}`, 'ok');
        break;
      }
      case 'where':
      case '坐标':
        this.ui.printConsole(`${where}  种子 ${this.world.seed}`, 'ok');
        break;
      case 'fly':
      case '飞行':
        this.toggleFly();
        this.ui.printConsole(this.player.flying ? '飞行：开' : '飞行：关', 'ok');
        break;
      case 'star':
      case '星星': {
        const n = Math.max(1, Math.min(20, Math.round(num(0, 1))));
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 2 + Math.random() * 4;
          this.stars.spawnAt(p.x + Math.cos(a) * r, p.y + 1.5, p.z + Math.sin(a) * r);
        }
        this.ui.printConsole(`生成了 ${n} 颗星星`, 'ok');
        break;
      }
      case 'seed':
      case '种子':
        this.ui.printConsole(`世界种子 ${this.world.seed}`, 'ok');
        break;
      case 'clear':
        this.ui.clearConsole();
        break;
      case 'speed':
      case '速度': {
        const v = num(0, NaN);
        if (!Number.isFinite(v)) {
          this.ui.printConsole('用法: speed <0.5-4>', 'error');
          break;
        }
        this.player.speedMultiplier = Math.max(0.5, Math.min(4, v));
        this.ui.printConsole(`速度 x${this.player.speedMultiplier}`, 'ok');
        break;
      }
      case 'gravity':
      case '重力': {
        const v = num(0, NaN);
        if (!Number.isFinite(v)) {
          this.ui.printConsole('用法: gravity <0-3>（0 是月球重力）', 'error');
          break;
        }
        this.player.gravityMultiplier = Math.max(0, Math.min(3, v));
        this.ui.printConsole(`重力 x${this.player.gravityMultiplier}`, 'ok');
        break;
      }
      case 'box':
      case '房间': {
        const r = Math.max(2, Math.min(6, Math.round(num(0, 3))));
        const block = PLACEABLE_BLOCKS[this.selectedSlot] ?? BlockId.Glass;
        const bx = Math.floor(p.x);
        const by = Math.floor(p.y + 0.1);
        const bz = Math.floor(p.z);
        let built = 0;
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            for (let dy = -1; dy <= r; dy++) {
              const shell = Math.abs(dx) === r || Math.abs(dz) === r || dy === -1 || dy === r;
              if (!shell) continue;
              if (this.world.applyBlockChange(bx + dx, by + dy, bz + dz, block)) built++;
            }
          }
        }
        this.ui.printConsole(`用手里方块搭了一个半径 ${r} 的房间（${built} 格）`, 'ok');
        break;
      }
      case 'tnt': {
        const bx = Math.floor(p.x) + 1;
        const by = Math.floor(p.y + 0.1);
        const bz = Math.floor(p.z);
        if (this.world.applyBlockChange(bx, by, bz, BlockId.Tnt)) this.igniteTnt(bx, by, bz);
        this.ui.printConsole('TNT 已点燃，快跑！', 'ok');
        break;
      }
      case 'undo':
      case '撤销':
        this.undo();
        this.ui.printConsole('撤销了一步', 'ok');
        break;
      default:
        this.ui.printConsole(`未知命令: ${cmd}，输入 help 查看`, 'error');
    }
  }

  // ---------------------------------------------------------------- loop

  private loop(now: number): void {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.active) this.readKeyboard();
    if (this.active && !this.paused) this.update(dt);

    this.renderer.render();

    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    this.clock += dt;

    let forward = false;
    let back = false;
    let left = false;
    let right = false;
    let jump = false;
    let sneak = false;
    let sprint = false;
    let lookDx = 0;
    let lookDy = 0;
    let breakHeld = false;
    let placeHeld = false;

    if (this.input.mobile && this.touch) {
      const t = this.touch.consume();
      lookDx = t.lookDx;
      lookDy = t.lookDy;
      forward = t.moveZ < -0.2;
      back = t.moveZ > 0.2;
      left = t.moveX < -0.2;
      right = t.moveX > 0.2;
      jump = t.jumpHeld;
      sneak = t.downHeld;
      breakHeld = t.breakHeld;
      placeHeld = t.placeHeld;
    } else {
      const delta = this.input.consumeMouseDelta();
      lookDx = delta.dx;
      lookDy = delta.dy;
      forward = this.input.isDown('KeyW') || this.input.isDown('ArrowUp');
      back = this.input.isDown('KeyS') || this.input.isDown('ArrowDown');
      left = this.input.isDown('KeyA') || this.input.isDown('ArrowLeft');
      right = this.input.isDown('KeyD') || this.input.isDown('ArrowRight');
      jump = this.input.isDown('Space');
      const shift = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
      sprint = shift && !this.player.flying;
      sneak = shift && this.player.flying;
      breakHeld = this.input.mouseLeft;
      placeHeld = this.input.mouseRight;
    }

    this.fpCamera.applyMouseDelta(lookDx, lookDy);

    const wasFlying = this.player.flying;
    this.player.update({ forward, back, left, right, jump, sneak, sprint }, dt, this.fpCamera.yaw);
    if (wasFlying !== this.player.flying) this.touch?.setFlying(this.player.flying);

    if (this.player.justJumped) this.audio.jump();
    if (this.player.landedHard) {
      this.player.landedHard = false;
      this.audio.land(26);
      this.shake = Math.min(0.35, this.shake + 0.16);
    }
    if (this.player.inWater !== this.wasInWater && this.player.inWater) this.audio.splash();
    this.wasInWater = this.player.inWater;

    this.playFootsteps(dt, forward || back || left || right);

    this.streamChunks();
    this.rebuildDirtyMeshes();

    const eye = this.player.getEyePosition();
    if (this.player.onGround && !this.player.flying) {
      eye.y += Math.sin(this.player.bobPhase * 2) * CONFIG.video.cameraBob;
    }
    this.fpCamera.applyToCamera(this.renderer.camera, eye);

    this.sky.update(dt, this.renderer.camera);
    this.updateUnderwater(dt, eye);
    this.handleInteraction(eye, breakHeld, placeHeld, dt);
    this.updateBooms(dt);
    this.stars.update(dt, this.clock);
    this.handleStarPickups();
    this.particles.update(dt);

    if (this.shake > 0.001) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      const s = this.shake * 0.35;
      this.renderer.camera.position.x += (Math.random() - 0.5) * s;
      this.renderer.camera.position.y += (Math.random() - 0.5) * s;
      this.renderer.camera.position.z += (Math.random() - 0.5) * s;
    }

    if (!this.roundDone) {
      this.elapsedMs += dt * 1000;
      this.ui.setTimer(formatTime(this.elapsedMs));
      this.autosave(dt);
    } else {
      this.nextRoundTimer -= dt;
      if (this.nextRoundTimer <= 0) this.beginNextRound();
    }

    this.tickCommandBlocks();
    this.updateHud();
  }

  private readKeyboard(): void {
    if (this.consoleOpen) return;
    if (this.input.wasPressed('Slash')) {
      this.openConsole();
      return;
    }
    for (let i = 0; i < 9 && i < PLACEABLE_BLOCKS.length; i++) {
      if (this.input.wasPressed(`Digit${i + 1}`)) this.selectSlot(i);
    }
    const wheel = this.input.consumeWheel();
    if (wheel !== 0) this.selectSlot(this.selectedSlot + wheel);

    if (this.input.wasPressed('KeyF')) this.toggleFly();
    if (this.input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.ui.toast(muted ? 'Sound off' : 'Sound on');
    }
    if (this.input.wasPressed('KeyP')) this.takePhoto();
    // F3 is the Minecraft muscle memory, but browsers reserve it (find next),
    // so the backquote key is the reliable alias.
    if (this.input.wasPressed('F3') || this.input.wasPressed('Backquote')) {
      this.showDebug = !this.showDebug;
      this.ui.setDebug(this.showDebug ? ' ' : null);
    }
    if (this.input.wasPressed('KeyH')) {
      if (this.paused) this.closeHelp();
      else this.showHelp();
    }
    if ((this.input.isDown('ControlLeft') || this.input.isDown('MetaLeft')) && this.input.wasPressed('KeyZ')) {
      this.undo();
    }
  }

  /**
   * Water as a medium, not just a surface: when the camera sits inside a water
   * block the fog closes in and takes the water colour, the clear colour
   * follows, and a depth-aware tint is laid over the view. Everything eases in
   * and out so crossing the surface is smooth rather than a hard cut.
   */
  private updateUnderwater(dt: number, eye: THREE.Vector3): void {
    const W = CONFIG.water;
    const bx = Math.floor(eye.x);
    const bz = Math.floor(eye.z);
    const by = Math.floor(eye.y);
    const inside = this.world.getBlock(bx, by, bz) === BlockId.Water;

    // How far below the surface the eye is (0 when dry).
    let depth = 0;
    if (inside) {
      let y = by;
      while (y + 1 < CHUNK_HEIGHT && this.world.getBlock(bx, y + 1, bz) === BlockId.Water) y++;
      depth = Math.max(0, y + 1 - eye.y);
    }

    this.underwater += ((inside ? 1 : 0) - this.underwater) * Math.min(1, dt * 10);
    if (this.underwater < 0.004) this.underwater = 0;

    const day = this.sky.daylight;
    this.tintColor.set(W.tint).multiplyScalar(0.35 + 0.75 * day);

    const fog = this.renderer.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = THREE.MathUtils.lerp(this.baseFogNear, W.fogNear, this.underwater);
      fog.far = THREE.MathUtils.lerp(this.baseFogFar, W.fogFar * (0.6 + 0.4 * day), this.underwater);
      // Sky.update has just painted this with the sky colour; pull it to water.
      fog.color.lerp(this.tintColor, this.underwater);
    }

    this.renderer.renderer.getClearColor(this.clearColor);
    this.clearColor.lerp(this.tintColor, this.underwater);
    this.renderer.renderer.setClearColor(this.clearColor);

    // Looking up toward the surface lets more light in, so the tint thins out.
    const upness = Math.max(0, Math.sin(this.fpCamera.pitch));
    const viewFactor = 1 - upness * 0.45;

    const strength =
      this.underwater *
      Math.min(W.overlayMax, W.overlayBase + depth * W.overlayPerBlock) *
      (0.5 + 0.5 * day) *
      viewFactor;
    this.ui.setUnderwater(strength);
  }

  private playFootsteps(dt: number, moving: boolean): void {    if (!moving || !this.player.onGround || this.player.flying) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer += dt;
    if (this.stepTimer > 0.34) {
      this.stepTimer = 0;
      this.audio.step();
    }
  }

  private streamChunks(): void {
    const p = this.player.position;
    this.world.loadChunksAround(p.x, p.z, this.renderDistance);
    const removed = this.world.unloadDistantChunks(p.x, p.z, this.renderDistance);
    for (const key of removed) this.meshManager.removeChunk(key);
  }

  private rebuildDirtyMeshes(): void {
    for (const chunk of this.world.getDirtyChunks()) {
      this.meshManager.updateChunk(chunk);
      this.world.markClean(chunk);
    }
  }

  private rebuildAllMeshes(): void {
    for (const chunk of this.world.getLoadedChunks()) {
      this.meshManager.updateChunk(chunk);
      this.world.markClean(chunk);
    }
  }

  // ---------------------------------------------------------------- world edits

  private handleInteraction(
    eye: THREE.Vector3,
    breakHeld: boolean,
    placeHeld: boolean,
    dt: number,
  ): void {
    this.interactCooldown = Math.max(0, this.interactCooldown - dt);

    const dir = this.fpCamera.getForward();
    const hit = raycastVoxel(eye, dir, this.world);

    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      if (this.input.wasPressed('KeyE') && this.world.getBlock(hit.x, hit.y, hit.z) === BlockId.CommandBlock) {
        this.openBlockEditor(hit.x, hit.y, hit.z);
        return;
      }
    } else {
      this.highlight.visible = false;
    }

    if (!hit || this.interactCooldown > 0) return;

    if (breakHeld) {
      this.breakBlock(hit.x, hit.y, hit.z);
      this.interactCooldown = CONFIG.play.interactRepeat;
    } else if (placeHeld) {
      this.placeBlock(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz);
      this.interactCooldown = CONFIG.play.interactRepeat;
    }
  }

  private breakBlock(x: number, y: number, z: number): void {
    const id = this.world.getBlock(x, y, z);
    if (id === BlockId.Air) return;

    if (id === BlockId.CommandBlock) {
      const key = `${x},${y},${z}`;
      this.commandBlocks.delete(key);
      this.commandCooldown.delete(key);
    }

    if (id === BlockId.Tnt) {
      this.igniteTnt(x, y, z);
      return;
    }

    this.pushUndo(x, y, z, id);
    this.world.applyBlockChange(x, y, z, BlockId.Air);
    this.editsSinceSave++;

    const def = getBlock(id);
    const color = this.atlas.averageColor(def.textures[0]);
    this.particles.spawnBurst(x + 0.5, y + 0.5, z + 0.5, color, 9, 4.2, 0.17);
    this.audio.breakBlock(def.hardness);
  }

  private placeBlock(x: number, y: number, z: number): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    if (this.world.getBlock(x, y, z) !== BlockId.Air) return;

    const hw = CONFIG.player.width / 2;
    const p = this.player.position;
    const overlaps =
      x + 1 > p.x - hw && x < p.x + hw &&
      z + 1 > p.z - hw && z < p.z + hw &&
      y + 1 > p.y && y < p.y + CONFIG.player.height;
    if (overlaps) return;

    const blockId = PLACEABLE_BLOCKS[this.selectedSlot];
    this.pushUndo(x, y, z, BlockId.Air);
    this.world.applyBlockChange(x, y, z, blockId);
    this.editsSinceSave++;

    const def = getBlock(blockId);
    this.particles.spawnBurst(
      x + 0.5, y + 0.9, z + 0.5,
      this.atlas.averageColor(def.textures[0]), 4, 2, 0.12,
    );
    this.audio.placeBlock();
  }

  private pushUndo(x: number, y: number, z: number, prev: number): void {
    this.undoStack.push({ x, y, z, prev });
    if (this.undoStack.length > CONFIG.play.maxUndo) this.undoStack.shift();
  }

  private undo(): void {
    while (this.undoStack.length > 0) {
      const entry = this.undoStack.pop()!;
      const current = this.world.getBlock(entry.x, entry.y, entry.z);
      if (current === entry.prev) continue;
      this.world.applyBlockChange(entry.x, entry.y, entry.z, entry.prev);
      this.editsSinceSave++;
      this.audio.ui();
      this.ui.toast('Undone', 'green');
      return;
    }
    this.ui.toast('Nothing to undo');
  }

  // ---------------------------------------------------------------- TNT

  private igniteTnt(x: number, y: number, z: number): void {
    if (this.booms.some((b) => b.x === x && b.y === y && b.z === z)) return;
    this.booms.push({ x, y, z, t: 0.75 });
    this.audio.fuse();
    this.particles.spawnBurst(x + 0.5, y + 1.1, z + 0.5, 0xff8a5c, 5, 2, 0.12);
  }

  private updateBooms(dt: number): void {
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.booms.splice(i, 1);
        this.explode(b.x, b.y, b.z);
      }
    }
  }

  private explode(cx: number, cy: number, cz: number): void {
    const radius = 3.4;
    const r2 = radius * radius;
    const destroyed: { x: number; y: number; z: number; id: number }[] = [];
    let chain = false;

    // The charge at the centre is consumed by its own blast. Without this the
    // scan below finds that same TNT block and queues the explosion again,
    // forever — which is exactly the runaway "chain reaction" loop.
    if (this.world.getBlock(cx, cy, cz) === BlockId.Tnt) {
      this.world.applyBlockChange(cx, cy, cz, BlockId.Air);
    }

    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dz = -4; dz <= 4; dz++) {
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          const x = cx + dx;
          const y = cy + dy;
          const z = cz + dz;
          const id = this.world.getBlock(x, y, z);
          if (id === BlockId.Air || id === BlockId.Water) continue;
          if (id === BlockId.Tnt) {
            chain = true;
            // Two blasts can reach the same charge; queue it once.
            if (!this.booms.some((b) => b.x === x && b.y === y && b.z === z)) {
              this.booms.push({ x, y, z, t: 0.12 + Math.random() * 0.18 });
            }
            continue;
          }
          this.world.applyBlockChange(x, y, z, BlockId.Air);
          destroyed.push({ x, y, z, id });
        }
      }
    }
    this.editsSinceSave++;

    for (let i = 0; i < Math.min(destroyed.length, 24); i++) {
      const d = destroyed[Math.floor(Math.random() * destroyed.length)];
      const color = this.atlas.averageColor(getBlock(d.id).textures[0]);
      this.particles.spawnBurst(d.x + 0.5, d.y + 0.5, d.z + 0.5, color, 3, 8, 0.22);
    }
    this.particles.spawnBurst(cx + 0.5, cy + 0.5, cz + 0.5, 0xffb347, 12, 10, 0.3);

    const dist = this.player.position.distanceTo(new THREE.Vector3(cx, cy, cz));
    this.shake = Math.min(0.9, this.shake + Math.max(0, 1 - dist / 26) * 0.7);
    this.audio.explode();
    if (dist < 26) this.ui.flash(Math.max(0.1, 0.45 - dist / 70));
    this.ui.toast(chain ? 'BOOM! chain reaction!' : 'BOOM!', 'boom');
  }

  // ---------------------------------------------------------------- stars

  private handleStarPickups(): void {
    const p = this.player.position;
    const picked = this.stars.collectAt(p.x, p.y, p.z);
    if (picked.length === 0) return;

    for (const s of picked) {
      this.particles.spawnBurst(s.x, s.y, s.z, 0xffd85c, 10, 5, 0.16);
      this.audio.collect(this.stars.collected);
    }
    this.ui.setScore(this.stars.collected, this.stars.total, true);

    if (this.stars.remaining === 0) {
      this.completeRound();
    } else if (this.stars.remaining <= 3) {
      const n = this.stars.remaining;
      this.ui.toast(`${n} star${n === 1 ? '' : 's'} left!`, 'gold');
    }
  }

  private completeRound(): void {
    this.roundDone = true;
    this.nextRoundTimer = 4.5;
    this.audio.win();
    this.shake = 0.4;
    this.ui.flash(0.3);
    this.ui.setTimer(formatTime(this.elapsedMs));

    if (this.bestMs === null || this.elapsedMs < this.bestMs) {
      this.bestMs = this.elapsedMs;
      this.writeBest(this.bestMs);
      this.ui.setBest(this.bestMs);
      this.ui.toast(`New best! All stars in ${formatTime(this.elapsedMs)} ★`, 'gold');
    } else {
      this.ui.toast(`All stars in ${formatTime(this.elapsedMs)} ★`, 'gold');
    }
    void this.saveNow();
  }

  private beginNextRound(): void {
    this.round++;
    this.roundDone = false;
    this.elapsedMs = 0;
    const p = this.player.position;
    this.stars.spawn(this.world, p.x, p.z);
    this.ui.setScore(0, this.stars.total);
    this.ui.toast(`Round ${this.round} — 10 more stars!`, 'gold');
  }

  // ---------------------------------------------------------------- save

  private autosave(dt: number): void {
    this.saveTimer += dt;
    if (this.saveTimer < 30) return;
    this.saveTimer = 0;
    if (this.editsSinceSave === 0) return;
    void this.saveNow();
  }

  private async saveNow(): Promise<void> {
    try {
      await this.saveManager.save(
        this.world.getAllChunks(),
        { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        this.world.seed,
        Object.fromEntries(this.commandBlocks),
      );
      this.editsSinceSave = 0;
    } catch {
      /* ignore save failures */
    }
  }

  private readBest(): number | null {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  }

  private writeBest(ms: number): void {
    try {
      localStorage.setItem(BEST_KEY, String(Math.round(ms)));
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------- photo + hud

  private takePhoto(): void {
    this.renderer.render();
    const url = this.renderer.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `craft-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.ui.flash(0.2);
    this.ui.toast('Photo saved to downloads', 'green');
  }

  private updateHud(): void {
    if (!this.showDebug) return;
    const p = this.player.position;
    const near = this.stars.nearest(p.x, p.y, p.z);
    this.ui.setDebug(
      `fps ${this.fps}  chunks ${this.world.getLoadedChunks().length}\n` +
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
        `time ${this.sky.time.toFixed(1)}h  fly ${this.player.flying ? 'on' : 'off'}\n` +
        `gpu ${this.gpuName}\n` +
        (near ? `nearest star ${near.dist.toFixed(0)}m` : 'no stars left'),
    );
  }
}
