import * as Phaser from 'phaser';
import { MAP_H, MAP_W, TILE as T } from '@/lib/rules';
import { groundUnder, PLAYER_TINTS, TILES } from '@/lib/tiles';
import { CONDITION_TALK, personaFor } from '@/lib/personalities';
import { stepToward, walkGrid } from '@/lib/townLayout';
import {
  buildingIsFlat,
  buildingTexture,
  loadMythril,
  objectFrame,
  paintGround,
  registerMythril,
} from './mythril';
import type {
  AgentSnapshot,
  AgentTask,
  Chatter,
  KeeperPublic,
  Placement,
  TownDetail,
  TownStats,
  TownSummary,
} from '@/lib/types';
import { ATLAS, buildAtlas, charFrame, keeperFrame, tileFrame } from './textures';

// ─────────────────────────────────────────────────────────────────────
// Observer view: the persisted agents, alive. Every sprite corresponds
// to a row of simulation state — its task, target and condition come
// from the server; the scene animates the in-between moments.
// ─────────────────────────────────────────────────────────────────────

export interface ObserverApi {
  applyTown(
    summary: TownSummary,
    placements: Placement[],
    agents: AgentSnapshot[],
    chatter: Chatter[],
    keeper: KeeperPublic | null
  ): void;
  flashWhisper(): void;
  /** Select a citizen and glide the camera to them (roster click). */
  focusAgent(id: number | null): void;
  /** Pop a care glyph above the keeper (🍎 ⚽ 🛁 …). */
  careBurst(glyph: string): void;
}

export interface ObserverBoot {
  town: TownDetail;
  onReady?: (api: ObserverApi) => void;
  onAgentSelect?: (id: number | null) => void;
}

const band = (v: number): 0 | 1 | 2 => (v < 35 ? 0 : v < 70 ? 1 : 2);
const MOOD_COLORS = [0xff6b6b, 0xf5d76e, 0x8fd14f];

/** Role → tunic tint (PLAYER_TINTS index); 'free' wears the town color. */
const ROLE_TINT: Record<string, number> = { farmer: 2, technician: 5, researcher: 6, keeper: 4 };
const TOWN_TINT: Record<string, number> = { openai: 2, claude: 1, gemini: 7, grok: 3, llama: 0, mistral: 5 };

const TASK_GLYPH: Partial<Record<AgentTask, { glyph: string; color: string; period: number }>> = {
  confront: { glyph: '!?', color: '#ff5d8f', period: 1100 },
  farm: { glyph: '✚', color: '#a7f070', period: 3200 },
  maintain: { glyph: '⚡', color: '#ffe87a', period: 3400 },
  research: { glyph: '?', color: '#73eff7', period: 3000 },
  rest: { glyph: 'Z', color: '#9fb3d9', period: 2600 },
  eat: { glyph: '+', color: '#a7f070', period: 2200 },
  social: { glyph: '♪', color: '#f4f4f4', period: 3000 },
  protest: { glyph: '!', color: '#ff6b6b', period: 900 },
  ritual: { glyph: '▲', color: '#c7a6ff', period: 2400 },
  transmit: { glyph: '▓', color: '#c7a6ff', period: 1800 },
};

interface AgentView {
  snap: AgentSnapshot;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text | null;
  tint: number;
  // tile-walker state
  nextX: number; // px of next tile center
  nextY: number;
  dir: 'down' | 'up' | 'side';
  flip: boolean;
  glyphT: number;
  ritualAngle: number;
  // local strolling between simulation ticks (cosmetic life)
  roamX: number | null;
  roamY: number | null;
  roamT: number;
  /** Reached the simulation's destination once — free to wander until it changes. */
  arrived: boolean;
  lastTarget: string;
}

/** Tasks where a little one stays planted at the work site. */
const STATIONARY_TASKS = new Set<AgentTask>(['farm', 'maintain', 'research', 'rest', 'protest', 'ritual', 'transmit', 'confront']);

export class ObserverScene extends Phaser.Scene {
  private town!: TownDetail;
  private grid: boolean[] = [];
  private groundLayers: Phaser.GameObjects.Image[] = [];
  private objectImgs = new Map<number, Phaser.GameObjects.Image>();
  private currentTilemap = '';
  private placementSprites = new Map<string, Phaser.GameObjects.Image>();
  private lastPlacements: Placement[] = [];
  private agents = new Map<number, AgentView>();
  private keeperView: {
    sprite: Phaser.GameObjects.Image;
    shadow: Phaser.GameObjects.Ellipse;
    label: Phaser.GameObjects.Text;
    tx: number;
    ty: number;
    cornered: boolean;
    alt: 0 | 1;
    altT: number;
  } | null = null;
  private showLabels = true;
  private weirdness = 0;
  private stats!: TownStats;
  private statusGfx!: Phaser.GameObjects.Graphics;
  private hoverId: number | null = null;
  private selectedId: number | null = null;
  private bubbleCount = 0;
  private lastChatterTick = -1;
  private chatterPool: Chatter[] = [];
  private replayT = 8000;
  private ambientTalkT = 9000;
  private accentColor = 0x19c37d;
  private downAt = { x: 0, y: 0 };
  private animClock = 0;
  private alt: 0 | 1 = 0;
  private waterTick = false;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private fitZoom = 1;
  private lastInteract = 0;
  private dragging = false;

  constructor() {
    super('observer');
  }

  init() {
    const boot = this.registry.get('boot') as ObserverBoot;
    this.town = boot.town;
  }

  preload() {
    loadMythril(this);
  }

  create() {
    buildAtlas(this);
    registerMythril(this);
    this.accentColor = parseInt((this.town.accent || personaFor(this.town.slug).accent).slice(1), 16);
    this.stats = this.town.stats;
    this.buildSpace();
    this.buildTerrain();
    this.applyPlacements(this.town.placements ?? []);
    this.weirdness = this.town.stats.weirdness;
    this.applyAgents(this.town.agents);
    this.statusGfx = this.add.graphics().setDepth(25000);
    this.setupCamera();
    this.showChatter(this.town.chatter ?? []);

    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        this.waterTick = !this.waterTick;
        this.groundLayers[0]?.setVisible(!this.waterTick);
        this.groundLayers[1]?.setVisible(this.waterTick);
      },
    });

    if (this.town.keeper) this.spawnKeeper(this.town.keeper);

    const boot = this.registry.get('boot') as ObserverBoot;
    boot.onReady?.({
      applyTown: (summary, placements, agents, chatter, keeper) => {
        this.weirdness = summary.stats.weirdness;
        this.stats = summary.stats;
        this.applyTilemap(summary.tilemap);
        this.applyPlacements(placements);
        this.applyAgents(agents);
        this.showChatter(chatter);
        this.applyKeeper(keeper);
      },
      flashWhisper: () => this.flashWhisper(),
      focusAgent: (id) => {
        this.selectedId = id;
        if (id === null) return;
        const view = this.agents.get(id);
        if (view) {
          this.lastInteract = this.time.now;
          this.cameras.main.pan(view.sprite.x, view.sprite.y, 600, 'Sine.easeInOut');
        }
      },
      careBurst: (glyph) => {
        const k = this.keeperView;
        // AI groves: burst above the keeper. Player groves: rain over the little ones.
        const spots = k
          ? [{ x: k.sprite.x, y: k.sprite.y - 28 }]
          : [...this.agents.values()].slice(0, 5).map((v) => ({ x: v.sprite.x, y: v.sprite.y - 26 }));
        spots.forEach((s, i) => {
          const t = this.add.text(s.x, s.y, glyph, { fontSize: '22px' }).setOrigin(0.5).setDepth(30001).setAlpha(0);
          this.tweens.add({
            targets: t,
            alpha: { from: 1, to: 0 },
            y: s.y - 24,
            delay: i * 160,
            duration: 2000,
            ease: 'cubic.out',
            onComplete: () => t.destroy(),
          });
        });
        if (k) this.tweens.add({ targets: k.sprite, y: k.sprite.y - 6, duration: 140, yoyo: true, repeat: 1 });
      },
    });
  }

  // ── The keeper ─────────────────────────────────────────────────────

  private spawnKeeper(k: KeeperPublic) {
    const px = k.x * T + T / 2;
    const py = k.y * T + T / 2;
    const shadow = this.add.ellipse(px, py + 14, 22, 8, 0x04050c, 0.3);
    const sprite = this.add.image(px, py, ATLAS, keeperFrame(this.town.slug, 0));
    sprite.setDepth(py);
    const label = this.add
      .text(px, py - 26, k.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: this.town.accent || '#e8d5a9',
        stroke: '#0a0b16',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(10001)
      .setResolution(3)
      .setScale(1.24);
    this.keeperView = { sprite, shadow, label, tx: px, ty: py, cornered: k.cornered, alt: 0, altT: 0 };
  }

  private applyKeeper(k: KeeperPublic | null) {
    if (!k) return;
    if (!this.keeperView) {
      this.spawnKeeper(k);
      return;
    }
    const px = k.x * T + T / 2;
    const py = k.y * T + T / 2;
    this.keeperView.tx = px;
    this.keeperView.ty = py;
    this.keeperView.cornered = k.cornered;
    if (Phaser.Math.Distance.Between(this.keeperView.sprite.x, this.keeperView.sprite.y, px, py) > 6 * T) {
      this.keeperView.sprite.setPosition(px, py);
    }
  }

  // ── Speech bubbles ─────────────────────────────────────────────────

  private showChatter(chatter: Chatter[]) {
    this.chatterPool = chatter.slice(-16); // kept for ambient replay between polls
    const fresh = chatter.filter((c) => c.tick > this.lastChatterTick);
    for (const c of fresh) this.lastChatterTick = Math.max(this.lastChatterTick, c.tick);
    for (const c of fresh.slice(-2)) {
      const a = this.agents.get(c.a);
      const b = this.agents.get(c.b);
      if (a) this.showBubble(a, c.la, 200);
      if (b) this.showBubble(b, c.lb, 1900);
    }
  }

  private showBubble(view: AgentView, text: string, delay = 0) {
    if (this.bubbleCount >= 4) return;
    this.bubbleCount++;
    this.time.delayedCall(delay, () => {
      if (!view.sprite.active) {
        this.bubbleCount--;
        return;
      }
      const label = this.add
        .text(0, 0, text, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '6px',
          color: '#15182b',
          wordWrap: { width: 112 },
          align: 'center',
          lineSpacing: 3,
        })
        .setOrigin(0.5, 1)
        .setResolution(3)
        .setScale(1.7)
        .setDepth(30001);
      const w = label.width * 1.7 + 18;
      const h = label.height * 1.7 + 14;
      const bx = view.sprite.x;
      const by = view.sprite.y - 30;
      label.setPosition(bx, by - 8);
      const g = this.add.graphics().setDepth(30000);
      g.fillStyle(0x05060c, 0.35); // soft drop shadow
      g.fillRoundedRect(bx - w / 2 + 2, by - h - 2, w, h, 6);
      g.fillStyle(0xf2f3f8, 0.97);
      g.lineStyle(2, 0x2a3045, 1);
      g.fillRoundedRect(bx - w / 2, by - h - 4, w, h, 6);
      g.strokeRoundedRect(bx - w / 2, by - h - 4, w, h, 6);
      g.fillTriangle(bx - 4, by - 4, bx + 4, by - 4, bx, by + 4);
      this.tweens.add({
        targets: [label, g],
        alpha: 0,
        delay: 2400,
        duration: 600,
        onComplete: () => {
          label.destroy();
          g.destroy();
          this.bubbleCount--;
        },
      });
    });
  }

  /** Client-side filler talk between polls, themed by current town state. */
  private ambientLine(): string {
    const p = personaFor(this.town.slug, this.town.name);
    const s = this.stats;
    const pool =
      s.food < s.population * 0.6 ? CONDITION_TALK.hunger
      : s.energy < s.population * 0.5 ? CONDITION_TALK.power
      : s.stability < 35 ? CONDITION_TALK.unrest
      : s.weirdness > 55 ? CONDITION_TALK.weird
      : Math.random() < 0.6 ? p.voices
      : CONDITION_TALK.routine;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Static world ───────────────────────────────────────────────────

  private buildSpace() {
    const rng = new Phaser.Math.RandomDataGenerator([this.town.slug]);
    for (let i = 0; i < 120; i++) {
      const s = rng.frac();
      this.add
        .rectangle(rng.between(-500, MAP_W * T + 500), rng.between(-400, MAP_H * T + 400), s > 0.9 ? 2 : 1, s > 0.9 ? 2 : 1, 0xdce2ff, 0.2 + s * 0.5)
        .setDepth(-100)
        .setScrollFactor(0.45);
    }
    this.add.rectangle(MAP_W * T * 0.5 + 14, MAP_H * T * 0.5 + 20, MAP_W * T, MAP_H * T, 0x04040a, 0.7).setDepth(-50);
    this.add
      .rectangle(MAP_W * T * 0.5, MAP_H * T * 0.5, MAP_W * T + 4, MAP_H * T + 4)
      .setStrokeStyle(2, 0x2a3045, 0.9)
      .setDepth(-40);
  }

  /**
   * Bake the autotiled ground (both water-animation frames) onto two
   * full-map canvas textures shown alternately — shorelines curve,
   * paths blend, exactly like the tileset's own previews.
   */
  private bakeGround(map: string) {
    for (const frame of [0, 1] as const) {
      const key = `groundlayer_${frame}`;
      let tex = this.textures.exists(key)
        ? (this.textures.get(key) as Phaser.Textures.CanvasTexture)
        : this.textures.createCanvas(key, MAP_W * T, MAP_H * T);
      if (!tex) continue;
      tex.context.clearRect(0, 0, MAP_W * T, MAP_H * T);
      paintGround(this, tex.context, map, frame);
      tex.refresh();
      if (!this.groundLayers[frame]) {
        this.groundLayers[frame] = this.add
          .image(MAP_W * T * 0.5, MAP_H * T * 0.5, key)
          .setDepth(0)
          .setVisible(frame === 0);
      }
    }
  }

  /**
   * Standing scenery for one cell — trees, rocks, fences — as a
   * bottom-anchored sprite whose depth equals its feet, so the little
   * ones walk in front of and behind things.
   */
  private setObject(map: string, i: number) {
    const x = i % MAP_W;
    const y = Math.floor(i / MAP_W);
    const ch = map[i] ?? 'g';
    const prev = this.objectImgs.get(i);
    const of = objectFrame(ch, x + y);

    if (of) {
      if (prev) {
        prev.setTexture(of.texture, of.frame);
        prev.setScale(of.scale);
        prev.setOrigin(0.5, 1).setPosition(x * T + T / 2, y * T + T).setDepth(y * T + T - 2);
      } else {
        const o = this.add
          .image(x * T + T / 2, y * T + T, of.texture, of.frame)
          .setOrigin(0.5, 1)
          .setScale(of.scale)
          .setDepth(y * T + T - 2);
        this.objectImgs.set(i, o);
      }
      return;
    }

    // Legacy pattern tiles (pre-migration buildings, resource nodes, toys).
    const def = TILES[ch];
    if (def && !def.walkable && ch !== 'w' && ch !== 'F') {
      const ground = def.base === 'g' ? groundUnder(map, x, y, MAP_W, MAP_H) : 'g';
      const frame = tileFrame(ch, false, ground);
      if (prev) {
        prev.setTexture(ATLAS, frame);
        prev.setScale(1);
        prev.setOrigin(0.5, 1).setPosition(x * T + T / 2, y * T + T).setDepth(y * T + T - 2);
      } else {
        const o = this.add
          .image(x * T + T / 2, y * T + T, ATLAS, frame)
          .setOrigin(0.5, 1)
          .setDepth(y * T + T - 2);
        this.objectImgs.set(i, o);
      }
      return;
    }
    if (ch === 'o') {
      // The play ball still comes from the pattern atlas (it's a cutie).
      const frame = tileFrame('o', false, groundUnder(map, x, y, MAP_W, MAP_H));
      if (prev) {
        prev.setTexture(ATLAS, frame).setScale(1).setOrigin(0.5, 1).setPosition(x * T + T / 2, y * T + T).setDepth(2);
      } else {
        this.objectImgs.set(i, this.add.image(x * T + T / 2, y * T + T, ATLAS, frame).setOrigin(0.5, 1).setDepth(2));
      }
      return;
    }
    if (prev) {
      prev.destroy();
      this.objectImgs.delete(i);
    }
  }

  private buildTerrain() {
    const map = this.town.tilemap;
    this.currentTilemap = map;
    this.bakeGround(map);
    for (let i = 0; i < MAP_W * MAP_H; i++) this.setObject(map, i);
    this.nightOverlay = this.add
      .rectangle(MAP_W * T * 0.5, MAP_H * T * 0.5, MAP_W * T + 4, MAP_H * T + 4, 0x0a1035, 0)
      .setDepth(5000);
  }

  /** The island changes as the society builds: trees fall, paths grow. */
  private applyTilemap(map: string) {
    if (!map || map === this.currentTilemap) return;
    const old = this.currentTilemap;
    this.currentTilemap = map;
    const dirty = new Set<number>();
    for (let i = 0; i < map.length; i++) {
      if (map[i] === old[i]) continue;
      const x = i % MAP_W;
      const y = Math.floor(i / MAP_W);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H) dirty.add(ny * MAP_W + nx);
        }
      }
    }
    if (dirty.size === 0) return;
    this.bakeGround(map);
    for (const i of dirty) this.setObject(map, i);
  }

  private applyPlacements(placements: Placement[]) {
    const isFirst = this.placementSprites.size === 0 && this.lastPlacements.length === 0;
    this.lastPlacements = placements;
    const map = this.currentTilemap || this.town.tilemap;
    const keep = new Set<string>();

    for (const p of placements) {
      const key = `${p.kind}:${p.x}:${p.y}`;
      keep.add(key);
      let img = this.placementSprites.get(key);
      if (!img) {
        // Bottom-anchored hut (or flat farm plot) that depth-sorts with walkers.
        img = this.add.image(p.x * T + T / 2, p.y * T + T, buildingTexture(p.kind, p.x + p.y)).setOrigin(0.5, 1);
        img.setDepth(buildingIsFlat(p.kind) ? 2 : p.y * T + T - 2);
        this.placementSprites.set(key, img);
        if (!isFirst) {
          // Construction day: pop in with a hammer flourish.
          img.setScale(0).setAlpha(0);
          this.tweens.add({ targets: img, scale: 1, alpha: 1, duration: 550, ease: 'back.out' });
          const fx = this.add
            .text(p.x * T + T / 2, p.y * T - 8, '⚒', { fontSize: '20px' })
            .setOrigin(0.5)
            .setDepth(30000);
          this.tweens.add({ targets: fx, y: fx.y - 20, alpha: 0, duration: 1800, onComplete: () => fx.destroy() });
        }
      }
    }

    for (const [key, img] of this.placementSprites) {
      if (keep.has(key)) continue;
      this.placementSprites.delete(key);
      this.tweens.add({ targets: img, alpha: 0, scale: 0.4, duration: 700, onComplete: () => img.destroy() });
    }

    this.grid = walkGrid(map, placements);
  }

  // ── Agents (the real ones) ─────────────────────────────────────────

  private tintOf(snap: AgentSnapshot): number {
    return ROLE_TINT[snap.role] ?? TOWN_TINT[this.town.slug] ?? 0;
  }

  private applyAgents(snaps: AgentSnapshot[]) {
    this.showLabels = snaps.length <= 20;
    const seen = new Set<number>();

    for (const snap of snaps) {
      seen.add(snap.id);
      const existing = this.agents.get(snap.id);
      if (existing) {
        existing.snap = snap;
        const tint = this.tintOf(snap);
        if (tint !== existing.tint) existing.tint = tint;
        // Hard reconcile only when the server moved them far from our animation.
        const px = snap.x * T + T / 2;
        const py = snap.y * T + T / 2;
        if (Phaser.Math.Distance.Between(existing.sprite.x, existing.sprite.y, px, py) > 5 * T) {
          existing.sprite.setPosition(px, py);
          existing.nextX = px;
          existing.nextY = py;
        }
        if (existing.label) {
          existing.label.setVisible(this.showLabels || snap.id === this.hoverId || snap.id === this.selectedId);
        }
        continue;
      }
      this.spawnAgentView(snap);
      // Brand-new little ones (born after the grove's founding) get a welcome.
      if (snap.age <= 2 && this.town.day > 1) {
        const view = this.agents.get(snap.id);
        if (view) this.birthBurst(view);
      }
    }

    for (const [id, view] of this.agents) {
      if (seen.has(id)) continue;
      // Departed (died or culled): fade out and forget.
      if (this.selectedId === id) {
        this.selectedId = null;
        (this.registry.get('boot') as ObserverBoot).onAgentSelect?.(null);
      }
      this.agents.delete(id);
      this.tweens.add({
        targets: [view.sprite, view.shadow, ...(view.label ? [view.label] : [])],
        alpha: 0,
        duration: 900,
        onComplete: () => {
          view.sprite.destroy();
          view.shadow.destroy();
          view.label?.destroy();
        },
      });
    }
  }

  private spawnAgentView(snap: AgentSnapshot) {
    let px = snap.x * T + T / 2;
    let py = snap.y * T + T / 2;
    // Off-duty little ones appear scattered across the whole grove, not
    // piled where the simulation last counted them — workers stay on
    // site, and newborns appear beside their family, not at the fence.
    const scatter = snap.age > 2 && !STATIONARY_TASKS.has(snap.task) && this.grid.length > 0;
    if (scatter) {
      for (let i = 0; i < 14; i++) {
        const wx = 1 + Math.floor(Math.random() * (MAP_W - 2));
        const wy = 1 + Math.floor(Math.random() * (MAP_H - 2));
        if (this.grid[wy * MAP_W + wx]) {
          px = wx * T + T / 2;
          py = wy * T + T / 2;
          break;
        }
      }
    }
    const tint = this.tintOf(snap);
    const shadow = this.add.ellipse(px, py + 14, 20, 8, 0x04050c, 0.28);
    const sprite = this.add.image(px, py, ATLAS, charFrame(tint, 'down', 0)).setAlpha(0);
    this.tweens.add({ targets: sprite, alpha: 1, duration: 700 });
    const label = this.add
      .text(px, py - 20, snap.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '6px',
        color: '#aeb6d0',
        stroke: '#0a0b16',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(10000)
      .setResolution(3)
      .setScale(1.1)
      .setVisible(this.showLabels);

    this.agents.set(snap.id, {
      snap,
      sprite,
      shadow,
      label,
      tint,
      nextX: px,
      nextY: py,
      dir: 'down',
      flip: false,
      glyphT: 800 + Math.random() * 2400,
      ritualAngle: Math.random() * Math.PI * 2,
      roamX: null,
      roamY: null,
      roamT: 400 + Math.random() * 2000,
      // Scattered spawns skip the walk back to their old errand spot —
      // they simply live where they stand and wander on from there.
      arrived: scatter,
      lastTarget: scatter ? `${snap.tx},${snap.ty}` : '',
    });
  }

  /** A new little one arrives: hearts, sparkles, and a smaller body for a while. */
  private birthBurst(view: AgentView) {
    const { sprite } = view;
    sprite.setScale(0.7);
    for (const [glyph, delay] of [['♥', 0], ['✨', 250], ['♥', 500]] as Array<[string, number]>) {
      const t = this.add
        .text(sprite.x + (Math.random() - 0.5) * 16, sprite.y - 20, glyph, { fontSize: '18px' })
        .setOrigin(0.5)
        .setDepth(30001)
        .setAlpha(0);
      this.tweens.add({
        targets: t,
        alpha: { from: 1, to: 0 },
        y: t.y - 24,
        delay,
        duration: 1600,
        ease: 'cubic.out',
        onComplete: () => t.destroy(),
      });
    }
  }

  private floatGlyph(view: AgentView, glyph: string, color: string) {
    const t = this.add
      .text(view.sprite.x, view.sprite.y - 24, glyph, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color,
        stroke: '#0a0b16',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20000)
      .setResolution(3)
      .setScale(1.7);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 1500, ease: 'cubic.out', onComplete: () => t.destroy() });
  }

  // ── Camera & FX ────────────────────────────────────────────────────

  private setupCamera() {
    const cam = this.cameras.main;
    const fit = () => {
      this.fitZoom = Phaser.Math.Clamp(
        Math.min(this.scale.width / (MAP_W * T + 160), this.scale.height / (MAP_H * T + 160)),
        0.3,
        1.5
      );
      if (cam.zoom < this.fitZoom) cam.setZoom(this.fitZoom);
      cam.centerOn((MAP_W * T) / 2, (MAP_H * T) / 2);
    };
    fit();
    cam.setZoom(this.fitZoom);
    this.scale.on('resize', fit);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.lastInteract = this.time.now;
      this.downAt = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.dragging = false;
      // A click (not a drag) selects the nearest agent — or clears.
      if (Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) < 6) {
        const world = cam.getWorldPoint(p.x, p.y);
        const hit = this.agentNear(world.x, world.y, 28);
        this.selectedId = hit?.snap.id ?? null;
        (this.registry.get('boot') as ObserverBoot).onAgentSelect?.(this.selectedId);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging && p.isDown) {
        this.lastInteract = this.time.now;
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
        return;
      }
      const world = cam.getWorldPoint(p.x, p.y);
      this.hoverId = this.agentNear(world.x, world.y, 22)?.snap.id ?? null;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.lastInteract = this.time.now;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * Math.exp(-dy * 0.001), this.fitZoom * 0.85, 2.25));
    });
  }

  private flashWhisper() {
    this.cameras.main.flash(120, 200, 180, 255, true);
    this.cameras.main.shake(160, 0.0016);
  }

  private agentNear(wx: number, wy: number, radius: number): AgentView | null {
    let best: AgentView | null = null;
    let bestD = radius;
    for (const view of this.agents.values()) {
      const d = Phaser.Math.Distance.Between(wx, wy, view.sprite.x, view.sprite.y - 8);
      if (d < bestD) {
        bestD = d;
        best = view;
      }
    }
    return best;
  }

  /** Mood dots, health bars, hover/selection rings — one overlay, redrawn per frame. */
  private drawStatus(time: number) {
    const g = this.statusGfx;
    g.clear();
    for (const view of this.agents.values()) {
      const { snap, sprite } = view;
      const x = sprite.x;
      const y = sprite.y;

      // Mood dot (always visible).
      g.fillStyle(MOOD_COLORS[band(snap.mood)], 0.95);
      g.fillRect(x + 8, y - 26, 4, 4);

      // Health bar (only when degraded — avoids clutter).
      if (snap.health < 70 || snap.id === this.hoverId || snap.id === this.selectedId) {
        const pct = snap.health / 100;
        g.fillStyle(0x10122a, 0.85);
        g.fillRect(x - 12, y - 26, 20, 4);
        g.fillStyle(pct > 0.6 ? 0x8fd14f : pct > 0.3 ? 0xf5d76e : 0xff6b6b, 1);
        g.fillRect(x - 12, y - 26, Math.max(2, 20 * pct), 4);
      }

      // Task feedback ring while working at the destination.
      const cfg = TASK_GLYPH[snap.task];
      if (cfg && Math.abs(sprite.x - (snap.tx * T + T / 2)) < 12 && Math.abs(sprite.y - (snap.ty * T + T / 2)) < 16) {
        const pulse = 0.25 + 0.2 * Math.sin(time * 0.006 + snap.id);
        g.lineStyle(2, parseInt(cfg.color.slice(1), 16), pulse);
        g.strokeCircle(x, y + 10, 12);
      }

      if (snap.id === this.hoverId && snap.id !== this.selectedId) {
        g.lineStyle(2, 0xf4f4f4, 0.6);
        g.strokeCircle(x, y - 4, 18);
      }
      if (snap.id === this.selectedId) {
        const pulse = 0.55 + 0.35 * Math.sin(time * 0.008);
        g.lineStyle(3, this.accentColor, pulse);
        g.strokeCircle(x, y - 4, 20);
      }
    }
  }

  // ── Per-frame ──────────────────────────────────────────────────────

  update(time: number, deltaMs: number) {
    this.animClock += deltaMs;
    if (this.animClock > 170) {
      this.animClock = 0;
      this.alt = this.alt === 0 ? 1 : 0;
    }

    for (const view of this.agents.values()) {
      this.updateAgent(view, time, deltaMs);
    }
    this.updateKeeper(time, deltaMs);
    this.drawStatus(time);

    // Ambient one-liners between polls, themed by current conditions —
    // and sometimes pure personality ("I love the red ball.").
    this.ambientTalkT -= deltaMs;
    if (this.ambientTalkT <= 0) {
      this.ambientTalkT = 5000 + Math.random() * 6000;
      const views = [...this.agents.values()];
      if (views.length) {
        const view = views[Math.floor(Math.random() * views.length)];
        const r = Math.random();
        const line =
          r < 0.16 && view.snap.likes ? `I love ${view.snap.likes}.`
          : r < 0.26 && view.snap.dislikes ? `Ugh. ${view.snap.dislikes}.`
          : this.ambientLine();
        this.showBubble(view, line);
      }
    }

    // Replay overheard conversations from the recent buffer so the grove
    // keeps talking between simulation days, not just when data arrives.
    this.replayT -= deltaMs;
    if (this.replayT <= 0) {
      this.replayT = 9000 + Math.random() * 8000;
      if (this.chatterPool.length) {
        const c = this.chatterPool[Math.floor(Math.random() * this.chatterPool.length)];
        const a = this.agents.get(c.a);
        const b = this.agents.get(c.b);
        if (a && b) {
          this.showBubble(a, c.la, 0);
          this.showBubble(b, c.lb, 1800);
        }
      }
    }

    // Day/night breathing (one cycle per simulated day = 3 real minutes).
    const phase = (Date.now() % (3 * 60 * 1000)) / (3 * 60 * 1000);
    this.nightOverlay.setAlpha(0.14 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)));
    // (No idle camera drift — the view stays exactly where you put it.)
  }

  private updateKeeper(time: number, deltaMs: number) {
    const k = this.keeperView;
    if (!k) return;
    const dt = deltaMs / 1000;
    const dist = Phaser.Math.Distance.Between(k.sprite.x, k.sprite.y, k.tx, k.ty);
    k.altT += deltaMs;
    if (k.altT > 200) {
      k.altT = 0;
      k.alt = k.alt === 0 ? 1 : 0;
    }
    if (dist > 4) {
      const ang = Math.atan2(k.ty - k.sprite.y, k.tx - k.sprite.x);
      const speed = (k.cornered ? 60 : 36) * dt;
      k.sprite.x += Math.cos(ang) * speed;
      k.sprite.y += Math.sin(ang) * speed;
      k.sprite.setFrame(keeperFrame(this.town.slug, k.alt));
      k.sprite.setFlipX(Math.cos(ang) < 0);
    } else if (k.cornered) {
      // Surrounded: nervous shuffling.
      k.sprite.x += (Math.random() - 0.5) * 3.2;
      k.sprite.y += (Math.random() - 0.5) * 2.4;
      k.sprite.setFrame(keeperFrame(this.town.slug, k.alt));
    } else {
      k.sprite.setFrame(keeperFrame(this.town.slug, 0));
      k.sprite.y += Math.sin(time * 0.004) * 0.08; // breathing
    }
    k.sprite.setDepth(k.sprite.y);
    k.shadow.setPosition(k.sprite.x, k.sprite.y + 14).setDepth(k.sprite.y - 0.5);
    k.label.setPosition(k.sprite.x, k.sprite.y - 24);
  }

  private updateAgent(view: AgentView, time: number, deltaMs: number) {
    const { snap, sprite } = view;
    const dt = deltaMs / 1000;
    const targetPx = snap.tx * T + T / 2;
    const targetPy = snap.ty * T + T / 2;
    const sick = band(snap.health) === 0;
    const speed = (sick ? 24 : 48) * dt;

    // New errand from the simulation? Only real ones — work sites, meals,
    // sleep, gatherings — pull a little one across the map. Idle and
    // social days are lived wherever its feet already happen to be,
    // otherwise every sim day would yank the whole grove back into a pile.
    const tgtKey = `${snap.tx},${snap.ty}`;
    if (view.lastTarget !== tgtKey) {
      view.lastTarget = tgtKey;
      const errand = STATIONARY_TASKS.has(snap.task) || snap.task === 'eat';
      view.arrived = !errand;
      view.roamX = null;
      view.roamY = null;
      view.roamT = 0;
    }
    const atDestination = Phaser.Math.Distance.Between(sprite.x, sprite.y, targetPx, targetPy) < 8;
    if (atDestination) view.arrived = true;
    let moving = false;

    // Where the feet are pointed right now: the simulation's errand first;
    // after that, wherever this little one feels like going. They never
    // snap back to the errand spot — the whole grove is theirs.
    let walkX: number | null = null;
    let walkY: number | null = null;
    if (!view.arrived) {
      walkX = targetPx;
      walkY = targetPy;
    } else if (!STATIONARY_TASKS.has(snap.task)) {
      view.roamT -= deltaMs;
      if (view.roamX === null && view.roamT <= 0) {
        const cx = Math.floor(sprite.x / T);
        const cy = Math.floor(sprite.y / T);
        for (let i = 0; i < 12; i++) {
          // Half potter nearby, half trek somewhere new across the map.
          const far = Math.random() < 0.5;
          const wx = far ? 1 + Math.floor(Math.random() * (MAP_W - 2)) : cx + Phaser.Math.Between(-6, 6);
          const wy = far ? 1 + Math.floor(Math.random() * (MAP_H - 2)) : cy + Phaser.Math.Between(-6, 6);
          if (wx >= 0 && wy >= 0 && wx < MAP_W && wy < MAP_H && this.grid[wy * MAP_W + wx]) {
            view.roamX = wx * T + T / 2;
            view.roamY = wy * T + T / 2;
            break;
          }
        }
        if (view.roamX === null) view.roamT = 800;
      }
      if (view.roamX !== null && view.roamY !== null) {
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, view.roamX, view.roamY) < 6) {
          view.roamX = null;
          view.roamY = null;
          view.roamT = 400 + Math.random() * 1600; // brief pause, then off again
        } else {
          walkX = view.roamX;
          walkY = view.roamY;
        }
      }
    }

    if (walkX !== null && walkY !== null) {
      // Tile-walker: head for the next tile center, picked greedily on the shared grid.
      const wtx = Math.floor(walkX / T);
      const wty = Math.floor(walkY / T);
      if (Phaser.Math.Distance.Between(sprite.x, sprite.y, view.nextX, view.nextY) < 3) {
        const cx = Math.floor(sprite.x / T);
        const cy = Math.floor(sprite.y / T);
        const step = stepToward(this.grid, cx, cy, wtx, wty, Math.random);
        if (step.x === cx && step.y === cy) {
          view.nextX = walkX; // stuck — drift straight, it's a terrarium
          view.nextY = walkY;
        } else {
          view.nextX = step.x * T + T / 2;
          view.nextY = step.y * T + T / 2;
        }
      }
      const pace = view.arrived ? speed * 0.75 : speed; // errands brisk, wandering easy
      const ang = Math.atan2(view.nextY - sprite.y, view.nextX - sprite.x);
      sprite.x += Math.cos(ang) * pace;
      sprite.y += Math.sin(ang) * pace;
      moving = true;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      if (Math.abs(dx) > Math.abs(dy)) {
        view.dir = 'side';
        view.flip = dx < 0;
      } else {
        view.dir = dy < 0 ? 'up' : 'down';
      }
    } else if (view.arrived && STATIONARY_TASKS.has(snap.task)) {
      // At work — task-specific body language.
      switch (snap.task) {
        case 'protest':
        case 'confront':
          sprite.x = targetPx + (Math.random() - 0.5) * 6;
          sprite.y = targetPy + (Math.random() - 0.5) * 6;
          break;
        case 'ritual': {
          view.ritualAngle += dt * 0.8;
          sprite.x = targetPx + Math.cos(view.ritualAngle) * 18;
          sprite.y = targetPy + Math.sin(view.ritualAngle) * 12;
          moving = true;
          view.dir = 'side';
          view.flip = Math.cos(view.ritualAngle + Math.PI / 2) < 0;
          break;
        }
        case 'farm':
        case 'maintain':
        case 'research':
          sprite.y = targetPy + Math.sin(time * 0.008 + snap.id) * 2.4; // work bob
          break;
        case 'transmit':
          view.dir = 'up';
          sprite.setPosition(targetPx, targetPy);
          break;
        default:
          sprite.setPosition(targetPx, targetPy);
      }
    }

    sprite.setFrame(charFrame(view.tint, view.dir, moving ? this.alt : 0));
    sprite.setFlipX(view.dir === 'side' && view.flip);
    // Babies are visibly small for their first weeks, growing into full size.
    sprite.setScale(snap.age < 25 ? 0.7 + (snap.age / 25) * 0.3 : 1);
    sprite.setAlpha(snap.task === 'rest' ? 0.75 : sick ? 0.65 : 1);
    sprite.setDepth(sprite.y);
    view.shadow.setPosition(sprite.x, sprite.y + 14).setDepth(sprite.y - 0.5).setAlpha(sprite.alpha * 0.28);
    if (view.label) {
      view.label.setPosition(sprite.x, sprite.y - 26);
      view.label.setVisible(this.showLabels || snap.id === this.hoverId || snap.id === this.selectedId);
    }

    // Task glyphs — the little ones narrate their work.
    view.glyphT -= deltaMs;
    if (view.glyphT <= 0) {
      const cfg = TASK_GLYPH[snap.task];
      if (cfg && atDestination) {
        this.floatGlyph(view, cfg.glyph, cfg.color);
        view.glyphT = cfg.period + Math.random() * 1500;
      } else if (band(snap.mood) === 0 && Math.random() < 0.5) {
        this.floatGlyph(view, '…', '#8b93ad');
        view.glyphT = 4000 + Math.random() * 3000;
      } else if (this.weirdness > 55 && Math.random() < 0.25) {
        const pool = personaFor(this.town.slug, this.town.name).emotes[1];
        this.floatGlyph(view, pool[Math.floor(Math.random() * pool.length)], '#c7a6ff');
        view.glyphT = 5000 + Math.random() * 4000;
      } else {
        view.glyphT = 2500 + Math.random() * 2500;
      }
    }
  }
}
