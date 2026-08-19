import Phaser from "phaser";
import { REEL_STRIPS, window3 } from "../domain/ReelStrip";
import { Reel } from "./Reel";

export interface ReelSetStopOpts {
  turbo?: boolean;
  skip?: boolean;
  anticipate?: boolean;
  anticipateLast?: boolean;
}

/** Five reels. spin() starts motion. setResult(grid) stops left-to-right. No win calc. */
export class ReelSet {
  readonly reels: Reel[] = [];
  private readonly scene: Phaser.Scene;
  private originX: number;
  private originY: number;
  private cellW: number;
  private cellH: number;
  private skipFlag = false;

  constructor(scene: Phaser.Scene, originX = 0, originY = 0, cellW = 96, cellH = 96) {
    this.scene = scene;
    this.originX = originX;
    this.originY = originY;
    this.cellW = cellW;
    this.cellH = cellH;
    for (let i = 0; i < 5; i++) {
      const strip = REEL_STRIPS[i] ?? REEL_STRIPS[0] ?? [];
      this.reels.push(new Reel(scene, i, originX + i * cellW, originY, cellW, cellH, strip));
    }
  }

  spin(): void {
    this.skipFlag = false;
    for (const r of this.reels) r.spinBlur();
  }

  startSpin(): void {
    this.spin();
  }

  update(delta: number): void {
    for (const r of this.reels) r.update(delta);
  }

  requestSkip(): void {
    this.skipFlag = true;
  }

  cellCenter(reel: number, row: number): { x: number; y: number } {
    return {
      x: this.originX + reel * this.cellW,
      y: this.originY + row * this.cellH,
    };
  }

  async setResult(grid: string[][], opts?: ReelSetStopOpts): Promise<void> {
    if (opts) {
      await this.stopTo(grid, opts);
      return;
    }
    for (let i = 0; i < this.reels.length; i++) {
      this.reels[i]?.stopAt(grid[i] ?? []);
    }
  }

  async stopTo(grid: string[][], opts: ReelSetStopOpts = {}): Promise<void> {
    const skip = opts.skip === true;
    const turbo = opts.turbo === true;
    const extraLast = (opts.anticipate || opts.anticipateLast) && !skip;
    const gap = skip ? 0 : turbo ? 40 : 140;
    const land = skip ? 16 : turbo ? 70 : 140;
    for (let i = 0; i < this.reels.length; i++) {
      if (this.skipFlag) {
        for (let j = i; j < this.reels.length; j++) {
          this.reels[j]?.stopAt(grid[j] ?? []);
        }
        return;
      }
      const extra = extraLast && i === 4 ? (turbo ? 220 : 700) : 0;
      if (!skip) await this.wait(gap + extra);
      await this.reels[i]?.land(grid[i] ?? [], land);
    }
  }

  setImmediate(grid: string[][]): void {
    this.setResult(grid);
  }

  showGrid(grid: string[][]): void {
    this.setResult(grid);
  }

  showIdle(): void {
    this.reels.forEach((r, i) => r.setVisible(window3(REEL_STRIPS[i] ?? [], 0)));
  }

  highlight(wins: Array<{ positions?: Array<{ reel: number; row: number }>; cells?: Array<{ col: number; row: number }> }>): void {
    const rowsByReel: number[][] = [[], [], [], [], []];
    for (const w of wins) {
      for (const p of w.positions ?? []) {
        const bucket = rowsByReel[p.reel];
        if (bucket && !bucket.includes(p.row)) bucket.push(p.row);
      }
      for (const c of w.cells ?? []) {
        const bucket = rowsByReel[c.col];
        if (bucket && !bucket.includes(c.row)) bucket.push(c.row);
      }
    }
    this.reels.forEach((r, i) => r.highlightRows(rowsByReel[i] ?? []));
  }

  clearHighlight(): void {
    for (const r of this.reels) r.clearHighlight();
  }

  /** layout(cx, cy, cell) or layout(originX, originY, cellW, cellH) */
  layout(a: number, b: number, c: number, d?: number): void {
    if (d === undefined) {
      this.cellW = c;
      this.cellH = c;
      this.originX = a - c * 2;
      this.originY = b - c;
    } else {
      this.originX = a;
      this.originY = b;
      this.cellW = c;
      this.cellH = d;
    }
    this.reels.forEach((r, i) => r.layout(this.originX + i * this.cellW, this.originY, this.cellW, this.cellH));
  }

  destroy(): void {
    for (const r of this.reels) r.destroy();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(ms, () => resolve());
    });
  }
}
