export class InputManager {
  keys = new Set<string>();
  mouseLocked = false;
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  mouseLeft = false;
  mouseRight = false;
  mouseLeftPressed = false;
  mouseRightPressed = false;
  readonly mobile: boolean;
  mobileActive = false;

  private canvas: HTMLCanvasElement;
  private prevMouseLeft = false;
  private prevMouseRight = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.mobile = 'ontouchstart' in window &&
      (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('mousemove', (e) => {
      if (this.mouseLocked) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.mouseLocked) return;
      if (e.button === 0) this.mouseLeft = true;
      if (e.button === 2) this.mouseRight = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) this.mouseRight = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === this.canvas;
    });
  }

  requestPointerLock(): void {
    if (!this.mobile) {
      this.canvas.requestPointerLock();
    }
  }

  /** Desktop needs pointer lock; mobile uses touch controls */
  isGameActive(): boolean {
    return this.mobile ? this.mobileActive : this.mouseLocked;
  }

  setMobileActive(active: boolean): void {
    this.mobileActive = active;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Call once per frame after processing */
  endFrame(): void {
    this.mouseLeftPressed = this.mouseLeft && !this.prevMouseLeft;
    this.mouseRightPressed = this.mouseRight && !this.prevMouseRight;
    this.prevMouseLeft = this.mouseLeft;
    this.prevMouseRight = this.mouseRight;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }
}
