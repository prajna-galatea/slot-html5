import Phaser from "phaser";
import { wrapIndex } from "../domain/ReelStrip";

const VISIBLE = 3;
const BUFFER = 2;
const CELL_COUNT = VISIBLE + BUFFER;

const SYMBOL_COLORS: Record<string, number> = {
  A: 0xe74c3c,
  K: 0xe67e22,
  Q: 0xf1c40f,
  J: 0x2ecc71,
  T: 0x3498db,
  N9: 0x9b59b6,
  N8: 0x1abc9c,
  STAR: 0xf39c12,
  WILD: 0xffffff,
};

export function colorForSymbol(id: string): number {
  return SYMBOL_COLORS[id] ?? 0x444444;
}

export interface ReelStopOpts {
  duration?: number;
  symbols: string[];
  above?: string;
  below?: string;
}

function atlasHas(scene: Phaser.Scene, frame: string): boolean {
  if (!scene.textures.exists("symbols")) return false;
  return scene.textures.get("symbols").has(frame);
}

/** One reel: 3 visible + 1–2 buffer. Atlas frames when present; color blocks otherwise. */
export class Reel {
  readonly view: Phaser.GameObjects.Container;
  readonly container: Phaser.GameObjects.Container;
  readonly index: number;
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private readonly blocks: Phaser.GameObjects.Rectangle[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly strokes: Phaser.GameObjects.Rectangle[] = [];
  private readonly scene: Phaser.Scene;
  private readonly strip: readonly string[];
  private readonly useAtlas: boolean;
  private cellW: number;
  private cellH: number;
  private windowX: number;
  private windowY: number;
  private maskGfx: Phaser.GameObjects.Graphics | null = null;
  private spinning = false;
  private cursor = 0;

  constructor(
    scene: Phaser.Scene,
    indexOrX: number,
    xOrY?: number,
    yOrW?: number,
    cellW = 96,
    cellH = 96,
    strip: readonly string[] = ["A", "K", "Q", "J", "T"],
  ) {
    this.scene = scene;
    const hasIndex = typeof xOrY === "number" && typeof yOrW === "number" && arguments.length >= 6;
    if (hasIndex) {
      this.index = indexOrX;
      this.windowX = xOrY ?? 0;
      this.windowY = yOrW ?? 0;
      this.cellW = cellW;
      this.cellH = cellH;
      this.strip = strip;
    } else {
      this.index = 0;
      this.windowX = indexOrX;
      this.windowY = xOrY ?? 0;
      this.cellW = yOrW ?? 96;
      this.cellH = cellW;
      this.strip = strip;
    }
    this.useAtlas = atlasHas(scene, this.strip[0] ?? "A");
    this.container = scene.add.container(this.windowX, this.windowY);
    this.view = this.container;
    for (let i = 0; i < CELL_COUNT; i++) {
      const cy = (i - 1) * this.cellH;
      const id = this.strip[i % this.strip.length] ?? "";
      if (this.useAtlas) {
        const tile = scene.add.image(0, cy, "symbols", id);
        tile.setDisplaySize(this.cellW - 6, this.cellH - 6);
        this.container.add(tile);
        this.tiles.push(tile);
      } else {
        const block = scene.add.rectangle(0, cy, this.cellW - 6, this.cellH - 6, colorForSymbol(id));
        const label = scene.add.text(0, cy, id, { fontFamily: "sans-serif", fontSize: "20px", color: "#111" }).setOrigin(0.5);
        this.container.add([block, label]);
        this.blocks.push(block);
        this.labels.push(label);
      }
      const stroke = scene.add.rectangle(0, cy, this.cellW - 6, this.cellH - 6, 0x000000, 0);
      stroke.setStrokeStyle(0);
      this.container.add(stroke);
      this.strokes.push(stroke);
    }
    this.applyMask();
  }

  spin(): void {
    this.spinBlur();
  }

  startSpin(): void {
    this.spinBlur();
  }

  spinBlur(): void {
    this.spinning = true;
    this.paintStrip(true);
  }

  update(_delta: number): void {
    if (!this.spinning) return;
    this.cursor += 1;
    this.paintStrip(true);
  }

  stopAt(symbolsOrOpts: string[] | ReelStopOpts): void {
    const opts = Array.isArray(symbolsOrOpts) ? { symbols: symbolsOrOpts } : symbolsOrOpts;
    const symbols = opts.symbols;
    this.spinning = false;
    const aboveBuffer = opts.above ?? this.strip[wrapIndex(this.cursor, this.strip.length)] ?? "";
    const belowBuffer = opts.below ?? this.strip[wrapIndex(this.cursor + CELL_COUNT - 1, this.strip.length)] ?? "";
    const ids = [aboveBuffer, symbols[0], symbols[1], symbols[2], belowBuffer];
    for (let i = 0; i < CELL_COUNT; i++) {
      this.paintCell(i, ids[i] ?? "", false);
    }
  }

  async land(col: string[], _duration: number): Promise<void> {
    this.stopAt(col);
  }

  forceLand(col: string[]): void {
    this.stopAt(col);
  }

  setVisible(col: string[]): void {
    this.stopAt(col);
  }

  setWindow(_above: string, visible: string[], _below: string): void {
    this.stopAt(visible);
  }

  layout(x: number, y: number, cellW: number, cellH: number): void {
    this.windowX = x;
    this.windowY = y;
    this.cellW = cellW;
    this.cellH = cellH;
    this.container.setPosition(x, y);
    const place = (obj: Phaser.GameObjects.GameObject & { setPosition: (x: number, y: number) => unknown }, i: number): void => {
      obj.setPosition(0, (i - 1) * cellH);
    };
    this.tiles.forEach((t, i) => {
      place(t, i);
      t.setDisplaySize(cellW - 6, cellH - 6);
    });
    this.blocks.forEach((b, i) => {
      place(b, i);
      b.setSize(cellW - 6, cellH - 6);
    });
    this.labels.forEach((t, i) => place(t, i));
    this.strokes.forEach((s, i) => {
      place(s, i);
      s.setSize(cellW - 6, cellH - 6);
    });
    this.applyMask();
  }

  highlight(rows: number[], on: boolean): void {
    this.highlightRows(on ? rows : []);
  }

  highlightRows(rows: number[]): void {
    this.strokes.forEach((s, i) => {
      if (i < VISIBLE && rows.includes(i)) s.setStrokeStyle(3, 0xfff3a0);
      else s.setStrokeStyle(0);
    });
  }

  clearHighlight(): void {
    for (const s of this.strokes) s.setStrokeStyle(0);
  }

  destroy(): void {
    this.maskGfx?.destroy();
    this.maskGfx = null;
    this.scene.tweens.killTweensOf(this.container);
    for (const t of this.tiles) this.scene.tweens.killTweensOf(t);
    this.container.destroy(true);
  }

  private applyMask(): void {
    if (!this.maskGfx) {
      this.maskGfx = this.scene.make.graphics({ x: 0, y: 0 });
    }
    this.maskGfx.clear();
    this.maskGfx.fillStyle(0xffffff, 1);
    this.maskGfx.fillRect(this.windowX - this.cellW / 2, this.windowY - this.cellH / 2, this.cellW, 3 * this.cellH);
    this.container.setMask(this.maskGfx.createGeometryMask());
  }

  private paintStrip(blur: boolean): void {
    for (let i = 0; i < CELL_COUNT; i++) {
      const id = this.strip[wrapIndex(this.cursor + i, this.strip.length)] ?? "";
      this.paintCell(i, id, blur);
    }
  }

  private paintCell(i: number, id: string, blur: boolean): void {
    const tile = this.tiles[i];
    if (tile) {
      const blurName = `${id}_blur`;
      const frame = blur && atlasHas(this.scene, blurName) ? blurName : id;
      if (atlasHas(this.scene, frame)) tile.setFrame(frame);
      tile.setAlpha(1);
    }
    const block = this.blocks[i];
    if (block) {
      block.setFillStyle(colorForSymbol(id));
      block.setAlpha(blur ? 0.45 : 1);
    }
    const label = this.labels[i];
    if (label) {
      label.setText(id);
      label.setAlpha(blur ? 0.35 : 1);
    }
  }
}
