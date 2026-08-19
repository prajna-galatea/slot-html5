import Phaser from 'phaser';
import { createGameClient } from '../client/createClient';
import { LocalGameClient } from '../client/LocalGameClient';
import type { GameClient, PaytableData, SessionState, SpinResult } from '../client/GameClient';
import { BetModel, LINES } from '../domain/BetModel';
import { shouldAnticipate } from '../domain/Paytable';
import { ReelSet } from '../reels/ReelSet';
import { SpinFSM } from '../spin/SpinFSM';
import { safeRectInGame } from '../layout/SafeArea';
import { isPortrait } from '../layout/Layout';
import { unloadSceneAssets } from '../assets/AssetBudget';

export class GameScene extends Phaser.Scene {
  private client: GameClient = createGameClient('local');
  private fsm = new SpinFSM();
  private reels!: ReelSet;
  private bet = new BetModel(1);
  private balance = 0;
  private table: PaytableData | null = null;

  private balanceText!: Phaser.GameObjects.Text;
  private betText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private spinLabel!: Phaser.GameObjects.Text;
  private spinBtn!: Phaser.GameObjects.Rectangle;
  private turboBtn!: Phaser.GameObjects.Rectangle;
  private turboLabel!: Phaser.GameObjects.Text;
  private payBtn!: Phaser.GameObjects.Rectangle;
  private minusBtn!: Phaser.GameObjects.Rectangle;
  private plusBtn!: Phaser.GameObjects.Rectangle;
  private winGfx!: Phaser.GameObjects.Graphics;
  private bg!: Phaser.GameObjects.Rectangle;

  private ready = false;
  private dcBtn!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'GameScene', active: false });
  }

  init(): void {
    this.ready = false;
    this.balance = 0;
  }

  create(): void {
    this.table = this.cache.json.get('paytable') as PaytableData;
    this.bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x1a1430).setOrigin(0);
    this.reels = new ReelSet(this, 120, 220, 110, 120);
    this.winGfx = this.add.graphics();
    this.buildHud();
    this.layoutAll();

    this.scale.on('resize', this.layoutAll, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.spinBtn.on('pointerup', () => this.onSpinPointer());
    this.turboBtn.on('pointerup', () => this.toggleTurbo());
    this.payBtn.on('pointerup', () => this.openPaytable());
    this.minusBtn.on('pointerup', () => this.nudgeBet(-1));
    this.plusBtn.on('pointerup', () => this.nudgeBet(1));
    this.dcBtn.on('pointerup', () => this.armFakeDisconnect());
    this.input.keyboard?.on('keydown-SPACE', () => this.onSpinPointer());

    this.ready = true;
    void this.bootSession();
  }

  update(_time: number, delta: number): void {
    if (!this.ready) return;
    this.reels.update(delta);
  }

  private async bootSession(): Promise<void> {
    const state = await this.client.bootstrap();
    this.applyState(state);
    if (state.pendingRound) {
      await this.playLockedRound(state.pendingRound, true);
    }
  }

  private applyState(state: SessionState): void {
    this.balance = state.balance;
    this.bet.lineBet = state.bet.lineBet;
    this.registry.set('balance', state.balance);
    this.registry.set('bet', { ...state.bet });
    this.registry.set('pendingRound', state.pendingRound);
    this.refreshHud();
  }

  private onSpinPointer(): void {
    const s = this.fsm.current;
    if (s === 'REQUESTING') return;
    if (
      s === 'SPINNING' ||
      s === 'ANTICIPATION' ||
      s === 'STOPPING' ||
      s === 'PRESENTING_WIN' ||
      s === 'RESTORING'
    ) {
      if (this.fsm.resultLocked) {
        this.fsm.skip();
        this.reels.requestSkip();
      }
      return;
    }
    if (s !== 'IDLE') return;
    void this.runSpin();
  }

  private async runSpin(): Promise<void> {
    if (!this.bet.canSpin(this.balance)) {
      this.statusText.setText('餘額不足');
      return;
    }
    this.winGfx.clear();
    this.reels.clearHighlight();
    this.winText.setText('');
    this.fsm.spin();
    this.reels.spin();
    this.playSfx('sfx-spin');
    this.refreshHud();
    try {
      const result = await this.client.spin({
        gameId: this.table?.gameId ?? 'slot-v1',
        bet: { lineBet: this.bet.lineBet, lines: LINES },
        clientSpinId: this.newClientSpinId(),
      });
      if (!this.sys.isActive()) return;
      this.registry.set('pendingRound', result);
      if (result.alreadyApplied) this.balance = result.balance;
      this.refreshHud();
      await this.playLockedRound(result, false);
    } catch (err) {
      if (!this.sys.isActive()) return;
      const msg = err instanceof Error ? err.message : 'ERROR';
      this.fsm.error();
      this.reels.showIdle();
      if (msg === 'FAKE_DISCONNECT') {
        this.fsm.reconnect();
        this.statusText.setText('斷線（已落盤，重整後恢復）');
        this.refreshHud();
        return;
      }
      this.statusText.setText(msg);
      this.fsm.resetIdle();
      this.refreshHud();
    }
  }

  private async playLockedRound(result: SpinResult, restoring: boolean): Promise<void> {
    if (restoring) {
      this.fsm.restore();
      this.reels.spin();
      this.statusText.setText('RESTORING');
    }
    this.fsm.setResult(result.grid);
    this.refreshHud();
    const tease = this.table ? shouldAnticipate(this.table, result.grid) : false;
    if (tease) this.fsm.anticipate();
    this.fsm.beginStop();
    await this.reels.setResult(result.grid, {
      turbo: this.fsm.isTurbo,
      skip: this.fsm.wantsSkip,
      anticipateLast: tease,
    });
    if (!this.sys.isActive()) return;
    this.playSfx('sfx-stop');
    this.fsm.landed();
    if (result.totalWin > 0) {
      this.fsm.presentWin();
      this.presentWins(result);
      this.playSfx('sfx-win');
      await this.waitMs(this.fsm.isTurbo || this.fsm.wantsSkip ? 350 : 1100);
    }
    if (result.feature) {
      this.fsm.feature();
      this.statusText.setText(`FEATURE ${result.feature.type}`);
      await this.waitMs(this.fsm.isTurbo || this.fsm.wantsSkip ? 120 : 500);
    }
    if (!this.sys.isActive()) return;
    const next = await this.client.ackRound(result.roundId);
    if (!this.sys.isActive()) return;
    this.applyState(next);
    this.winGfx.clear();
    this.reels.clearHighlight();
    this.fsm.ack();
    this.refreshHud();
  }

  private presentWins(result: SpinResult): void {
    this.winText.setText(`WIN ${result.totalWin}`);
    this.reels.highlight(result.wins);
    this.winGfx.clear();
    this.winGfx.lineStyle(4, 0xffe566, 0.9);
    for (const w of result.wins) {
      if (!w.positions.length) continue;
      const first = this.reels.cellCenter(w.positions[0].reel, w.positions[0].row);
      this.winGfx.beginPath();
      this.winGfx.moveTo(first.x, first.y);
      for (let i = 1; i < w.positions.length; i += 1) {
        const p = this.reels.cellCenter(w.positions[i].reel, w.positions[i].row);
        this.winGfx.lineTo(p.x, p.y);
      }
      this.winGfx.strokePath();
    }
  }

  private toggleTurbo(): void {
    this.fsm.turbo(!this.fsm.isTurbo);
    this.playSfx('sfx-click');
    this.refreshHud();
  }

  private armFakeDisconnect(): void {
    if (this.client instanceof LocalGameClient) {
      this.client.armFakeDisconnect();
      this.statusText.setText('下一手會模擬斷線');
    }
  }

  private openPaytable(): void {
    if (this.fsm.current !== 'IDLE') return;
    const paytableScene = this.scene.get('PaytableScene');
    if (paytableScene && paytableScene.scene.isActive()) {
      this.scene.stop('PaytableScene');
      return;
    }
    this.playSfx('sfx-click');
    this.scene.launch('PaytableScene');
  }

  private nudgeBet(dir: 1 | -1): void {
    if (this.fsm.current !== 'IDLE') return;
    this.bet.cycle(dir);
    this.registry.set('bet', { lineBet: this.bet.lineBet, lines: LINES });
    this.playSfx('sfx-click');
    this.refreshHud();
  }

  private buildHud(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f2f2f7',
    };
    this.balanceText = this.add.text(0, 0, '', style).setDepth(10);
    this.betText = this.add.text(0, 0, '', style).setDepth(10);
    this.winText = this.add
      .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '36px', color: '#ffd34e', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(10);
    this.statusText = this.add
      .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '16px', color: '#9aa' })
      .setOrigin(0.5)
      .setDepth(10);

    this.spinBtn = this.rectBtn(0xffd34e);
    this.spinLabel = this.add
      .text(0, 0, 'SPIN', { fontFamily: 'sans-serif', fontSize: '26px', color: '#1a1a22', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(11);
    this.turboBtn = this.rectBtn(0x3d3d55);
    this.turboLabel = this.add
      .text(0, 0, 'TURBO', { fontFamily: 'sans-serif', fontSize: '16px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(11);
    this.payBtn = this.rectBtn(0x3d3d55);
    this.minusBtn = this.rectBtn(0x3d3d55);
    this.plusBtn = this.rectBtn(0x3d3d55);
    this.dcBtn = this.rectBtn(0xa44);
  }

  private rectBtn(color: number): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(0, 0, 140, 56, color).setInteractive({ useHandCursor: true }).setDepth(10);
  }

  private layoutAll(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const safe = safeRectInGame(this.scale);
    this.bg.setSize(w, h);

    const portrait = isPortrait(this.scale);
    let cellW: number;
    let cellH: number;
    let ox: number;
    let oy: number;
    if (portrait) {
      cellW = Math.min(120, (safe.w - 24) / 5);
      cellH = cellW * 1.05;
      ox = safe.x + safe.w / 2 - cellW * 2;
      oy = safe.y + Math.min(280, safe.h * 0.28);
      this.spinBtn.setSize(180, 64).setPosition(safe.x + safe.w / 2, safe.y + safe.h - 70);
      this.turboBtn.setSize(110, 48).setPosition(safe.x + 70, safe.y + safe.h - 70);
      this.payBtn.setSize(110, 48).setPosition(safe.x + safe.w - 70, safe.y + safe.h - 70);
      this.minusBtn.setSize(48, 40).setPosition(safe.x + 40, safe.y + 88);
      this.plusBtn.setSize(48, 40).setPosition(safe.x + 200, safe.y + 88);
      this.dcBtn.setSize(96, 40).setPosition(safe.x + safe.w - 80, safe.y + 88);
    } else {
      cellW = Math.min(118, (safe.w * 0.58) / 5);
      cellH = Math.min(cellW * 1.05, (safe.h - 40) / 3);
      ox = safe.x + 36 + cellW / 2;
      oy = safe.y + safe.h / 2 - cellH;
      const rx = safe.x + safe.w - 110;
      this.spinBtn.setSize(160, 64).setPosition(rx, safe.y + safe.h / 2);
      this.turboBtn.setSize(120, 44).setPosition(rx, safe.y + safe.h / 2 + 70);
      this.payBtn.setSize(120, 44).setPosition(rx, safe.y + safe.h / 2 + 124);
      this.minusBtn.setSize(44, 40).setPosition(rx - 50, safe.y + 90);
      this.plusBtn.setSize(44, 40).setPosition(rx + 50, safe.y + 90);
      this.dcBtn.setSize(96, 40).setPosition(rx, safe.y + 160);
    }

    this.reels.layout(ox, oy, cellW, cellH);
    this.balanceText.setPosition(safe.x + 16, safe.y + 12);
    this.betText.setPosition(safe.x + 16, safe.y + 42);
    this.winText.setPosition(ox + cellW * 2, oy + cellH * 3 + 36);
    this.statusText.setPosition(ox + cellW * 2, oy - 36);
    this.spinLabel.setPosition(this.spinBtn.x, this.spinBtn.y);
    this.turboLabel.setPosition(this.turboBtn.x, this.turboBtn.y);
    this.placeCaption(this.payBtn, 'PAYS');
    this.placeCaption(this.minusBtn, '−');
    this.placeCaption(this.plusBtn, '+');
    this.placeCaption(this.dcBtn, '斷線');
    this.refreshHud();
  }

  private captions = new Map<Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text>();

  private placeCaption(btn: Phaser.GameObjects.Rectangle, text: string): void {
    let t = this.captions.get(btn);
    if (!t) {
      t = this.add
        .text(btn.x, btn.y, text, { fontFamily: 'sans-serif', fontSize: '18px', color: '#fff' })
        .setOrigin(0.5)
        .setDepth(11);
      this.captions.set(btn, t);
    }
    t.setPosition(btn.x, btn.y);
    t.setText(text);
  }

  private refreshHud(): void {
    this.balanceText.setText(`BAL  ${this.balance}`);
    this.betText.setText(`BET  ${this.bet.totalBet()}  (${this.bet.lineBet}×${LINES})`);
    this.turboLabel.setText(this.fsm.isTurbo ? 'TURBO ON' : 'TURBO');
    this.turboBtn.setFillStyle(this.fsm.isTurbo ? 0xc0392b : 0x3d3d55);
    const busy = this.fsm.current !== 'IDLE';
    this.spinLabel.setText(busy ? (this.fsm.resultLocked ? 'SKIP' : '...') : 'SPIN');
    const can = this.bet.canSpin(this.balance) || busy;
    this.spinBtn.setFillStyle(can ? 0xffd34e : 0x666670);
    if (this.fsm.current === 'IDLE') this.statusText.setText('');
    else this.statusText.setText(this.fsm.current);
  }

  private playSfx(key: string): void {
    if (this.sound.get(key) || this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: 0.45 });
    }
  }

  private newClientSpinId(): string {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return `c-${buf[0].toString(16)}${buf[1].toString(16)}`;
  }

  private waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private onShutdown(): void {
    this.scale.off('resize', this.layoutAll, this);
    this.reels.destroy();
    unloadSceneAssets(this, {
      objects: [],
      textures: [],
      audio: [],
      json: [],
    });
  }
}
