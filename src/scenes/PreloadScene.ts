import Phaser from 'phaser';
import { createSymbolAtlas } from '../assets/createSymbolAtlas';
import { SFX_URIS } from '../audio/beeps';
import { safeRectInGame } from '../layout/SafeArea';

export class PreloadScene extends Phaser.Scene {
  private readyText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Rectangle;
  private startLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PreloadScene', active: false });
  }

  preload(): void {
    this.load.json('paytable', 'paytable.json');
    this.load.audio('sfx-spin', SFX_URIS.spin);
    this.load.audio('sfx-stop', SFX_URIS.stop);
    this.load.audio('sfx-win', SFX_URIS.win);
    this.load.audio('sfx-click', SFX_URIS.click);

    const { width, height } = this.scale;
    const barBg = this.add.rectangle(width / 2, height / 2, 320, 16, 0x333344);
    const bar = this.add.rectangle(width / 2 - 160, height / 2, 4, 12, 0xffd34e).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => {
      bar.width = Math.max(4, 320 * p);
      void barBg;
    });
  }

  create(): void {
    createSymbolAtlas(this);
    this.readyText = this.add
      .text(0, 0, 'Ready', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.startBtn = this.add.rectangle(0, 0, 220, 64, 0xffd34e).setInteractive({
      useHandCursor: true,
    });
    this.startLabel = this.add
      .text(0, 0, 'START', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#1a1a22',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // pointerup (not pointerdown) unlocks Web Audio on a user gesture.
    this.startBtn.on('pointerup', () => this.unlockAndStart());
    this.startLabel.setInteractive({ useHandCursor: true }).on('pointerup', () => this.unlockAndStart());
    this.layoutStart();
    this.scale.on('resize', this.layoutStart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private layoutStart(): void {
    const safe = safeRectInGame(this.scale);
    const cx = safe.x + safe.w / 2;
    const cy = safe.y + safe.h / 2;
    this.readyText.setPosition(cx, cy - 80);
    this.startBtn.setPosition(cx, cy + 20);
    this.startLabel.setPosition(cx, cy + 20);
  }

  private unlockAndStart(): void {
    this.sound.unlock();
    const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (this.cache.audio.exists('sfx-click')) this.sound.play('sfx-click');
    const boot = this.scene.get('BootScene');
    if (boot && boot.scene.isActive()) {
      this.scene.stop('BootScene');
    }
    this.scene.start('GameScene');
  }

  private onShutdown(): void {
    this.scale.off('resize', this.layoutStart, this);
  }
}
