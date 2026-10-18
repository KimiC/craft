/**
 * ============================================================
 *  CRAFT — TUNING FILE
 *  Everything the game "feels" like lives here.
 *  Change a number, save, and the game reloads instantly.
 *  Great for experiments: "what if gravity was the moon's?"
 * ============================================================
 */

export const CONFIG = {
  /** Terrain + chunk streaming */
  world: {
    seed: 42,
    renderDistance: 6,
    mobileRenderDistance: 4,
    /** Sea level. Anything below this is flooded. */
    waterLevel: 26,
    /** Peaks above this get snow on top. */
    snowLine: 55,
  },

  /** Movement — the single biggest factor in how a game "feels" */
  player: {
    walkSpeed: 5.5,
    sprintMultiplier: 1.7,
    jumpSpeed: 9,
    gravity: -28,
    flySpeed: 12,
    flySprintMultiplier: 2.2,
    /** How quickly you reach full speed on the ground (m/s²). Higher = snappier. */
    groundAccel: 55,
    /** How quickly you stop on the ground when every key is released (m/s²). */
    groundFriction: 32,
    /** Air steering authority (m/s²). Keep it low so a jump keeps its momentum. */
    airAccel: 14,
    /** Air drag (m/s²). Near zero: you coast through the whole jump. */
    airFriction: 0.6,
    /** Extra drag while swimming (m/s²). */
    waterFriction: 12,
    /** Grace period to still jump after walking off a ledge (seconds) */
    coyoteTime: 0.12,
    /** Press jump slightly before landing and it still counts (seconds) */
    jumpBuffer: 0.15,
    height: 1.7,
    width: 0.6,
    /** Fall this far before the landing thud plays */
    hardLandingSpeed: 18,
  },

  /** Day / night cycle */
  day: {
    /** Real seconds for one full 24h cycle */
    lengthSeconds: 360,
    /** Hour the world starts at (0-24) */
    startHour: 8,
  },

  audio: {
    masterVolume: 0.5,
  },

  /** Rendering knobs */
  video: {
    /** Cap on the internal resolution multiplier (window.devicePixelRatio). */
    pixelRatioCap: 2,
    /** Vertical camera bob while walking, in blocks (0 disables it). */
    cameraBob: 0.02,
  },

  /** How water feels and looks */
  water: {
    /** Gravity multiplier while submerged (1 = normal, 0 = neutral buoyancy) */
    gravityFactor: 0.14,
    /** Fastest you sink (m/s) */
    sinkSpeed: 2.4,
    /** Swim-up speed while holding jump (m/s) */
    swimSpeed: 4.9,
    /** Horizontal speed multiplier in water */
    moveFactor: 0.55,
    /** Fog distances while fully submerged (blocks) */
    fogNear: 1,
    fogFar: 15,
    /** Colour of the underwater medium */
    tint: '#1f5f9e',
    /** Screen tint at the surface, per block of depth, and the cap */
    overlayBase: 0.16,
    overlayPerBlock: 0.015,
    overlayMax: 0.5,
  },

  /** The play loop */
  play: {
    /** How many glow-stars spawn per round */
    starCount: 10,
    starMinRadius: 35,
    starMaxRadius: 120,
    /** Seconds between repeats while holding break/place */
    interactRepeat: 0.16,
    /** How many block edits Ctrl+Z can undo */
    maxUndo: 64,
    /** Reach distance in blocks */
    reach: 8,
  },
} as const;
