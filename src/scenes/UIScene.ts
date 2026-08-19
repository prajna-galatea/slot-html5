import Phaser from 'phaser';
import { applyDesignSize, attachViewportListeners, hudRect } from '../layout/Layout';

export class UIScene extends Phaser.Scene {
  private built = false;
  private banner = '';
  private lastWin = 0;
  private detachViewport: (() => void) | null = null;
  private balanceText!: Phaser.GameObjects.Text;
  private betText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private spinLabel!: Phaser.GameObjects.Text;
  private turboLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(): void {
    this.built = false;
    this.banner = '';
    this.lastWin = 0;
    this.detachViewport = null;
  }

  create(): void {
    applyDesignSize(this.scale);
    this.scale.on('resize', this.relayout, this);
    this.detachViewport = attachViewportListeners(() => applyDesignSize(this.scale));
    this.game.events.on('slot:hud', this.refresh, this);
    this.game.events.on('slot:fsm', this.refresh, this);
    this.game.events.on('slot:banner', this.onBanner, this);
    this.game.events.on('slot:win', this.onWin, this);
    this.game.events.on('slot:turbo-state', this.refresh, this);
    this.game.events.on('slot:ready', this.refresh, this);
    this.build();
    this.refresh();
  }

  private build(): void {
    this.children.removeAll(true);
    const { width } = this.scale;
    this.balanceText = this.add.text(0, 0, '', this.font(22)).setOrigin(0, 0);
    this.betText = this.add.text(0, 0, '', this.font(22)).setOrigin(0.5, 0);
    this.winText = this.add.text(0, 0, '', this.font(22, '#8f8')).setOrigin(1, 0);
    this.stateText = this.add.text(0, 0, '', this.font(16, '#aaa')).setOrigin(0.5, 0);
    this.bannerText = this.add.text(width / 2, 0, '', this.font(18, '#f0d78c')).setOrigin(0.5, 0);
    this.spinLabel = this.add.text(0, 0, '旋轉', this.font(26, '#1a1a2e')).setOrigin(0.5);
    this.turboLabel = this.add.text(0, 0, '加速', this.font(18, '#1a1a2e')).setOrigin(0.5);
    this.built = true;
    this.relayout();
  }

  private relayout(): void {
    if (!this.built) {
      return;
    }
    const safe = hudRect(this.scale);
    const portrait = this.scale.height > this.scale.width;
    const top = safe.y;
    this.balanceText.setPosition(safe.x, top);
    this.betText.setPosition(safe.x + safe.width / 2, top);
    this.winText.setPosition(safe.x + safe.width, top);
    this.stateText.setPosition(safe.x + safe.width / 2, top + 32);
    this.bannerText.setPosition(safe.x + safe.width / 2, top + 56);

    const by = portrait ? safe.y + safe.height - 78 : safe.y + safe.height - 64;
    this.drawButtons(safe.x, by, safe.width, portrait);
  }

  private drawButtons(x: number, y: number, w: number, portrait: boolean): void {
    const old = this.children.list.filter((go) => go.getData('hudBtn') === true);
    for (const go of old) {
      this.tweens.killTweensOf(go);
      go.destroy();
    }

    const spinW = portrait ? 150 : 130;
    const btnH = 56;
    const mid = x + w / 2;
    this.button(mid, y, spinW, btnH, 0xf0d78c, () => this.game.events.emit('slot:spin'));
    this.spinLabel.setPosition(mid, y).setDepth(10);

    this.button(mid - spinW / 2 - 70, y, 72, 44, 0xc8c8d0, () => this.game.events.emit('slot:bet-down'));
    this.add.text(mid - spinW / 2 - 70, y, '−', this.font(28, '#1a1a2e')).setOrigin(0.5).setData('hudBtn', true);

    this.button(mid + spinW / 2 + 70, y, 72, 44, 0xc8c8d0, () => this.game.events.emit('slot:bet-up'));
    this.add.text(mid + spinW / 2 + 70, y, '+', this.font(28, '#1a1a2e')).setOrigin(0.5).setData('hudBtn', true);

    const row2 = y - (portrait ? 64 : 0);
    const left = portrait ? x + 50 : x + 70;
    const right = portrait ? x + w - 50 : x + w - 80;

    this.button(left, portrait ? row2 : y, 88, 40, 0x88c, () => this.game.events.emit('slot:turbo'));
    this.turboLabel.setPosition(left, portrait ? row2 : y).setDepth(10);

    this.button(left + 100, portrait ? row2 : y, 88, 40, 0x6a8, () => this.game.events.emit('slot:skip'));
    this.add.text(left + 100, portrait ? row2 : y, '略過', this.font(18, '#fff')).setOrigin(0.5).setData('hudBtn', true);

    this.button(right - 100, portrait ? row2 : y, 96, 40, 0x456, () => this.game.events.emit('slot:paytable'));
    this.add.text(right - 100, portrait ? row2 : y, '賠付表', this.font(16, '#fff')).setOrigin(0.5).setData('hudBtn', true);

    this.button(right, portrait ? row2 : y, 96, 40, 0xa44, () => this.game.events.emit('slot:fake-dc'));
    this.add.text(right, portrait ? row2 : y, '模擬斷線', this.font(14, '#fff')).setOrigin(0.5).setData('hudBtn', true);

  }

  private button(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    onUp: () => void,
  ): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(x, y, w, h, color, 1);
    r.setInteractive({ useHandCursor: true });
    r.on('pointerup', onUp);
    r.setData('hudBtn', true);
    return r;
  }

  private refresh(): void {
    if (!this.built) {
      return;
    }
    const balance = Number(this.registry.get('balance') ?? 0);
    const bet = Number(this.registry.get('bet') ?? 20);
    const lineBet = Number(this.registry.get('lineBet') ?? 1);
    const state = String(this.registry.get('fsmState') ?? 'IDLE');
    const turbo = Boolean(this.registry.get('turbo'));
    this.balanceText.setText(`餘額 ${balance}`);
    this.betText.setText(`押注 ${bet}（線 ${lineBet}×20）`);
    this.winText.setText(`贏分 ${this.lastWin}`);
    this.stateText.setText(`狀態 ${state}`);
    this.bannerText.setText(this.banner);
    this.turboLabel.setText(turbo ? '加速ON' : '加速');
    const can = state === 'IDLE' && balance >= bet;
    this.spinLabel.setText(can ? '旋轉' : state === 'IDLE' ? '餘額不足' : '…');
  }

  private onBanner(msg: string): void {
    this.banner = msg || '';
    this.refresh();
  }

  private onWin(amount: number): void {
    this.lastWin = amount;
    this.refresh();
  }

  private font(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'sans-serif', fontSize: `${size}px`, color };
  }

  shutdown(): void {
    this.scale.off('resize', this.relayout, this);
    this.detachViewport?.();
    this.game.events.off('slot:hud', this.refresh, this);
    this.game.events.off('slot:fsm', this.refresh, this);
    this.game.events.off('slot:banner', this.onBanner, this);
    this.game.events.off('slot:win', this.onWin, this);
    this.game.events.off('slot:turbo-state', this.refresh, this);
    this.game.events.off('slot:ready', this.refresh, this);
    this.tweens.killAll();
    this.children.removeAll(true);
  }
}
