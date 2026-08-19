import Phaser from 'phaser';
import { createBootLogo } from '../assets/createSymbolAtlas';
import { unloadSceneAssets } from '../assets/AssetBudget';
import { readSafeAreaInsets, safeRectInGame } from '../layout/SafeArea';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    createBootLogo(this);
    const { width, height } = this.scale;
    const insets = readSafeAreaInsets();
    const safe = safeRectInGame(this.scale);
    const cx = safe.x + safe.w / 2;
    const cy = safe.y + safe.h / 2;

    this.add.rectangle(width / 2, height / 2, width, height, 0x12121c);
    this.add.image(cx, cy - 40, 'boot-logo');
    this.add
      .text(cx, cy + 50, 'SLOT', {
        fontFamily: 'sans-serif',
        fontSize: '36px',
        color: '#ffd34e',
      })
      .setOrigin(0.5);
    this.add
      .text(
        cx,
        cy + 100,
        `safe ${insets.top.toFixed(0)}/${insets.right.toFixed(0)}/${insets.bottom.toFixed(0)}/${insets.left.toFixed(0)}  rect ${Math.round(safe.w)}×${Math.round(safe.h)}`,
        { fontFamily: 'sans-serif', fontSize: '14px', color: '#888899' },
      )
      .setOrigin(0.5);

    this.time.delayedCall(450, () => {
      if (!this.sys.isActive()) return;
      const objects = [...this.children.list];
      unloadSceneAssets(this, { objects, textures: ['boot-logo'] });
      this.scene.start('PreloadScene');
    });
  }
}
