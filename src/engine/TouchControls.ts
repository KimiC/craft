/** Virtual joystick + touch look for mobile */

export interface TouchInputState {
  moveX: number;
  moveZ: number;
  lookDx: number;
  lookDy: number;
  breakPressed: boolean;
  placePressed: boolean;
  jumpPressed: boolean;
}

export function isMobileDevice(): boolean {
  return (
    'ontouchstart' in window &&
    (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900)
  );
}

export class TouchControls {
  private moveX = 0;
  private moveZ = 0;
  private lookDx = 0;
  private lookDy = 0;
  private breakPressed = false;
  private placePressed = false;
  private jumpPressed = false;

  private joystickTouchId: number | null = null;
  private joystickOrigin = { x: 0, y: 0 };
  private lookTouchId: number | null = null;
  private lastLook = { x: 0, y: 0 };

  private joystickEl: HTMLElement;
  private stickEl: HTMLElement;
  private readonly maxRadius = 50;

  constructor(
    private container: HTMLElement,
    onBlockSelect: (index: number) => void,
  ) {
    this.joystickEl = document.getElementById('joystick')!;
    this.stickEl = document.getElementById('joystick-stick')!;

    document.getElementById('btn-break')!.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.breakPressed = true;
    });
    document.getElementById('btn-place')!.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.placePressed = true;
    });
    document.getElementById('btn-jump')!.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.jumpPressed = true;
    });

    const hotbar = document.getElementById('hotbar')!;
    hotbar.querySelectorAll('.hotbar-slot').forEach((slot, i) => {
      slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onBlockSelect(i);
      });
    });

    this.container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.container.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.container.addEventListener('touchend', (e) => this.onTouchEnd(e));
    this.container.addEventListener('touchcancel', (e) => this.onTouchEnd(e));
  }

  private isJoystickZone(x: number, y: number): boolean {
    return x < window.innerWidth * 0.45 && y > window.innerHeight * 0.45;
  }

  private isLookZone(x: number, y: number): boolean {
    return x > window.innerWidth * 0.4 && y < window.innerHeight * 0.72;
  }

  private onTouchStart(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      const { clientX: x, clientY: y } = touch;
      if (this.joystickTouchId === null && this.isJoystickZone(x, y)) {
        this.joystickTouchId = touch.identifier;
        this.joystickOrigin = { x, y };
        this.joystickEl.classList.add('active');
        this.updateStick(x, y);
        e.preventDefault();
      } else if (this.lookTouchId === null && this.isLookZone(x, y)) {
        this.lookTouchId = touch.identifier;
        this.lastLook = { x, y };
        e.preventDefault();
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.joystickTouchId) {
        this.updateStick(touch.clientX, touch.clientY);
        e.preventDefault();
      } else if (touch.identifier === this.lookTouchId) {
        this.lookDx += touch.clientX - this.lastLook.x;
        this.lookDy += touch.clientY - this.lastLook.y;
        this.lastLook = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
      }
    }
  }

  private updateStick(x: number, y: number): void {
    let dx = x - this.joystickOrigin.x;
    let dy = y - this.joystickOrigin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.maxRadius) {
      dx = (dx / dist) * this.maxRadius;
      dy = (dy / dist) * this.maxRadius;
    }
    this.stickEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.moveX = dx / this.maxRadius;
    this.moveZ = dy / this.maxRadius;
  }

  private onTouchEnd(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.moveX = 0;
        this.moveZ = 0;
        this.joystickEl.classList.remove('active');
        this.stickEl.style.transform = 'translate(-50%, -50%)';
      }
      if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
      }
    }
  }

  consume(): TouchInputState {
    const state: TouchInputState = {
      moveX: this.moveX,
      moveZ: this.moveZ,
      lookDx: this.lookDx,
      lookDy: this.lookDy,
      breakPressed: this.breakPressed,
      placePressed: this.placePressed,
      jumpPressed: this.jumpPressed,
    };
    this.lookDx = 0;
    this.lookDy = 0;
    this.breakPressed = false;
    this.placePressed = false;
    this.jumpPressed = false;
    return state;
  }
}
