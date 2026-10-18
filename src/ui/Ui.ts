/** Thin DOM layer — everything the player sees outside the 3D canvas. */

export interface HotbarItem {
  icon: string;
  label: string;
}

function need<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`UI element #${id} is missing from index.html`);
  return el as T;
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class Ui {
  readonly startScreen = need('screen-start');
  readonly pauseScreen = need('screen-pause');
  readonly helpScreen = need('screen-help');
  readonly hud = need('hud');
  readonly hotbar = need('hotbar');
  readonly scoreEl = need('score');
  readonly scoreLine = need('score-line');
  readonly timerEl = need('timer-line');
  readonly bestEl = need('best-line');
  readonly debugEl = need('debug');
  readonly toastBox = need('toasts');
  readonly seedInput = need<HTMLInputElement>('seed-input');
  readonly startNote = need('start-note');
  readonly btnPlay = need<HTMLButtonElement>('btn-play');
  readonly btnNew = need<HTMLButtonElement>('btn-new');
  readonly btnResume = need<HTMLButtonElement>('btn-resume');
  readonly btnHelp = need<HTMLButtonElement>('btn-help');
  readonly btnQuit = need<HTMLButtonElement>('btn-quit');
  readonly btnCloseHelp = need<HTMLButtonElement>('btn-close-help');
  readonly btnMenu = need<HTMLButtonElement>('btn-menu');
  readonly mobileControls = need('mobile-controls');
  readonly hintbar = need('hintbar');

  private flashEl: HTMLDivElement;
  private underwaterEl: HTMLDivElement;
  private consoleEl: HTMLDivElement;
  private consoleLog: HTMLDivElement;
  readonly consoleInput: HTMLInputElement;
  private slots: HTMLDivElement[] = [];

  constructor() {
    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:8;background:#fff;opacity:0;transition:opacity .35s ease;';
    document.body.appendChild(this.flashEl);

    // The water medium you see while your eyes are under the surface: a soft
    // vignette that gets stronger with depth. The scene fog does the distance
    // work; this supplies the "I am inside something" tint.
    this.underwaterEl = document.createElement('div');
    this.underwaterEl.id = 'underwater';
    this.underwaterEl.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:4',
      'opacity:0',
      'transition:opacity .22s linear',
      'background:radial-gradient(ellipse at 50% 42%,rgba(105,190,245,0.55) 0%,rgba(32,104,176,0.78) 45%,rgba(5,28,58,0.96) 100%)',
      'will-change:opacity',
    ].join(';');
    document.body.appendChild(this.underwaterEl);

    // Command console: the "change the rules" entry point. Opened with "/".
    this.consoleEl = document.createElement('div');
    this.consoleEl.id = 'console';
    this.consoleEl.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:15%',
      'transform:translateX(-50%)',
      'width:min(720px,92vw)',
      'z-index:9',
      'display:none',
      'flex-direction:column',
      'gap:6px',
      'padding:10px 12px',
      'background:rgba(8,14,24,0.88)',
      'color:#e6f2ff',
      'border:1px solid rgba(120,190,255,0.35)',
      'border-radius:10px',
      'box-shadow:0 12px 44px rgba(0,0,0,0.55)',
      'font:13px/1.55 ui-monospace,Consolas,"Courier New",monospace',
      'pointer-events:auto',
    ].join(';');

    this.consoleLog = document.createElement('div');
    this.consoleLog.style.cssText = 'max-height:200px;overflow-y:auto;white-space:pre-wrap;';

    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;gap:8px;align-items:center;border-top:1px solid rgba(120,190,255,0.22);padding-top:6px;';
    const prompt = document.createElement('span');
    prompt.textContent = '>';
    prompt.style.cssText = 'color:#7fd1ff;';
    this.consoleInput = document.createElement('input');
    this.consoleInput.type = 'text';
    this.consoleInput.spellcheck = false;
    this.consoleInput.autocomplete = 'off';
    this.consoleInput.setAttribute('autocapitalize', 'off');
    this.consoleInput.style.cssText =
      'flex:1;background:transparent;border:0;outline:0;color:inherit;font:inherit;padding:2px 0;';
    row.append(prompt, this.consoleInput);
    this.consoleEl.append(this.consoleLog, row);
    document.body.appendChild(this.consoleEl);
  }

  get consoleVisible(): boolean {
    return this.consoleEl.style.display !== 'none';
  }

  openConsole(): void {
    this.consoleEl.style.display = 'flex';
  }

  closeConsole(): void {
    this.consoleEl.style.display = 'none';
  }

  clearConsole(): void {
    this.consoleLog.textContent = '';
  }

  consoleLogEmpty(): boolean {
    return this.consoleLog.childElementCount === 0;
  }

  printConsole(line: string, kind: 'info' | 'ok' | 'error' = 'info'): void {
    const el = document.createElement('div');
    el.textContent = line;
    el.style.color = kind === 'error' ? '#ff9a9a' : kind === 'ok' ? '#9df0b8' : '#cfe6ff';
    this.consoleLog.appendChild(el);
    this.consoleLog.scrollTop = this.consoleLog.scrollHeight;
  }

  /** 0 = dry, 1 = fully tinted; the game feeds it depth- and light-aware values. */
  setUnderwater(strength: number): void {
    const v = Math.max(0, Math.min(1, strength));
    this.underwaterEl.style.opacity = v < 0.01 ? '0' : v.toFixed(3);
  }

  // ---------- screens ----------
  private hideScreens(): void {
    this.startScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.helpScreen.classList.add('hidden');
  }

  showStart(note?: string): void {
    this.hideScreens();
    if (note !== undefined) this.startNote.textContent = note;
    this.startScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  showPause(): void {
    this.hideScreens();
    this.pauseScreen.classList.remove('hidden');
  }

  showHelp(): void {
    this.hideScreens();
    this.helpScreen.classList.remove('hidden');
  }

  showHud(mobile: boolean): void {
    this.hideScreens();
    this.hud.classList.remove('hidden');
    this.btnMenu.classList.toggle('hidden', !mobile);
    this.mobileControls.classList.toggle('hidden', !mobile);
    this.hintbar.classList.toggle('hidden', mobile);
  }

  // ---------- hotbar ----------
  buildHotbar(items: HotbarItem[], selected: number): void {
    this.hotbar.innerHTML = '';
    this.slots = items.map((item, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === selected ? ' selected' : '');
      slot.style.backgroundImage = `url(${item.icon})`;
      slot.title = item.label;
      if (i < 9) {
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(i + 1);
        slot.appendChild(num);
      }
      slot.addEventListener('click', () => this.onSlotClick?.(i));
      slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.onSlotClick?.(i);
      });
      this.hotbar.appendChild(slot);
      return slot;
    });
  }

  onSlotClick: ((index: number) => void) | null = null;

  selectSlot(index: number): void {
    this.slots.forEach((el, i) => el.classList.toggle('selected', i === index));
    const el = this.slots[index];
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  // ---------- hud numbers ----------
  setScore(collected: number, total: number, pop = false): void {
    this.scoreEl.textContent = `${collected}/${total}`;
    if (pop) {
      this.scoreLine.classList.remove('pop');
      void this.scoreLine.offsetWidth;
      this.scoreLine.classList.add('pop');
    }
  }

  setTimer(text: string): void {
    this.timerEl.textContent = text;
  }

  setBest(ms: number | null): void {
    this.bestEl.textContent = ms === null ? '' : `best ${formatTime(ms)}`;
  }

  setDebug(text: string | null): void {
    if (text === null) {
      this.debugEl.classList.add('hidden');
      return;
    }
    this.debugEl.classList.remove('hidden');
    this.debugEl.textContent = text;
  }

  // ---------- feedback ----------
  private lastToastText = '';
  private lastToastAt = 0;

  toast(text: string, kind: 'gold' | 'green' | 'boom' | '' = ''): void {
    const now = performance.now();
    // Collapse repeats (a chain of explosions would otherwise stack a wall of
    // identical banners) and never show more than a handful at once.
    if (text === this.lastToastText && now - this.lastToastAt < 900) return;
    this.lastToastText = text;
    this.lastToastAt = now;

    while (this.toastBox.children.length >= 5) this.toastBox.firstElementChild?.remove();

    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ` ${kind}` : '');
    el.textContent = text;
    this.toastBox.appendChild(el);
    window.setTimeout(() => el.remove(), 2100);
  }

  flash(strength = 0.5): void {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = String(Math.min(0.75, strength));
    requestAnimationFrame(() => {
      this.flashEl.style.transition = 'opacity .45s ease';
      this.flashEl.style.opacity = '0';
    });
  }
}
