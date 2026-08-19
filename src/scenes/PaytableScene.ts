import Phaser from "phaser";
import type { PaytableData } from "../domain/Paytable";
import { createPaytablePanel } from "../assets/createSymbolAtlas";
import { unloadSceneAssets } from "../assets/AssetBudget";
import { safeRectInGame } from "../layout/SafeArea";

export class PaytableScene extends Phaser.Scene {
  private open = false;
  private dim!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Image;
  private body!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "PaytableScene", active: false });
  }

  init(): void {
    this.open = false;
  }

  create(): void {
    this.open = true;
    createPaytablePanel(this);
    this.dim = this.add.rectangle(0, 0, 8, 8, 0x000000, 0.72).setOrigin(0);
    this.panel = this.add.image(0, 0, "paytable-ui");
    this.body = this.add
      .text(0, 0, this.buildLines(), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f4f4f8",
        align: "left",
      })
      .setOrigin(0.5);
    this.layout();
    this.dim.setInteractive();
    this.dim.on("pointerup", () => this.close());
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private buildLines(): string {
    const data = this.cache.json.get("paytable") as PaytableData | undefined;
    const lines = ["20 線 / 1 WILD", "押注 = 單線 x 20", ""];
    if (data) {
      lines.push("百搭：" + data.wild);
      for (const s of data.symbols) {
        const p = data.pays[s];
        if (!p) continue;
        lines.push(s + "  3x=" + (p[3] ?? p[2]) + "  4x=" + (p[4] ?? p[3]) + "  5x=" + (p[5] ?? p[4]));
      }
    }
    lines.push("", "點擊關閉");
    return lines.join("\n");
  }

  private layout(): void {
    if (!this.open) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const safe = safeRectInGame(this.scale);
    this.dim.setPosition(0, 0).setSize(w, h);
    this.dim.removeInteractive();
    this.dim.setInteractive();
    const cx = safe.x + safe.w / 2;
    const cy = safe.y + safe.h / 2;
    this.panel.setPosition(cx, cy);
    this.panel.setDisplaySize(Math.min(safe.w - 24, 600), Math.min(safe.h - 24, 680));
    this.body.setPosition(cx, cy);
    this.body.setFontSize(h > w ? "16px" : "14px");
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    this.scale.off("resize", this.layout, this);
    unloadSceneAssets(this, {
      objects: [...this.children.list],
      textures: [],
    });
    this.scene.stop();
  }

  private onShutdown(): void {
    this.scale.off("resize", this.layout, this);
  }
}
