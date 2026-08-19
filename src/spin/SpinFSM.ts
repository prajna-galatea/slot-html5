export type SpinState =
  | 'IDLE'
  | 'REQUESTING'
  | 'SPINNING'
  | 'ANTICIPATION'
  | 'STOPPING'
  | 'LANDED'
  | 'PRESENTING_WIN'
  | 'FEATURE'
  | 'RESTORING'
  | 'RECONNECTING'
  | 'ERROR';

export type SpeedMode = 'normal' | 'skip' | 'turbo';
export type ChangeFn = (state: SpinState, prev: SpinState) => void;

/**
 * spin() starts; setResult(grid) locks the accepted grid.
 * skip / turbo only speed playback.
 */
export class SpinFSM {
  private _state: SpinState = 'IDLE';
  private _grid: string[][] | null = null;
  private _locked = false;
  private _skip = false;
  private _turbo = false;
  private readonly listeners: ChangeFn[] = [];

  get state(): SpinState {
    return this._state;
  }
  get current(): SpinState {
    return this._state;
  }
  get result(): string[][] | null {
    return this._grid;
  }
  get resultGrid(): string[][] | null {
    return this._grid;
  }
  get locked(): boolean {
    return this._locked;
  }
  get resultLocked(): boolean {
    return this._locked;
  }
  get wantsSkip(): boolean {
    return this._skip;
  }
  get isTurbo(): boolean {
    return this._turbo;
  }
  get speed(): SpeedMode {
    if (this._skip) return 'skip';
    if (this._turbo) return 'turbo';
    return 'normal';
  }

  getState(): SpinState {
    return this._state;
  }
  getGrid(): string[][] | null {
    return this._grid;
  }
  onChange(fn: ChangeFn): void {
    this.listeners.push(fn);
  }
  canSpin(): boolean {
    return this._state === 'IDLE' || this._state === 'ERROR';
  }

  spin(): boolean {
    if (!this.canSpin()) return false;
    this._grid = null;
    this._locked = false;
    this._skip = false;
    this.set('REQUESTING');
    return true;
  }

  setResult(grid: string[][]): void {
    if (this._state !== 'REQUESTING' && this._state !== 'RESTORING' && this._state !== 'SPINNING') {
      return;
    }
    this._grid = grid.map((col) => col.slice());
    this._locked = true;
    if (this._state === 'REQUESTING') this.set('SPINNING');
  }

  skip(): void {
    this._skip = true;
  }
  turbo(on = true): void {
    this._turbo = on;
  }
  setTurbo(on: boolean): void {
    this._turbo = on;
  }
  isSkip(): boolean {
    return this._skip;
  }
  speedScale(): number {
    if (this._skip) return 0.15;
    if (this._turbo) return 0.45;
    return 1;
  }

  anticipate(): void {
    if (this._state === 'SPINNING') this.set('ANTICIPATION');
  }
  beginStop(): void {
    if (this._state === 'SPINNING' || this._state === 'ANTICIPATION') this.set('STOPPING');
  }
  landed(): void {
    if (this._state === 'STOPPING') this.set('LANDED');
  }
  presentWin(): void {
    if (this._state === 'LANDED' || this._state === 'RESTORING') this.set('PRESENTING_WIN');
  }
  feature(): void {
    if (this._state === 'PRESENTING_WIN' || this._state === 'LANDED') this.set('FEATURE');
  }
  restore(pending?: { grid: string[][] }): void {
    if (pending?.grid) {
      this._grid = pending.grid.map((col) => col.slice());
      this._locked = true;
    }
    this._skip = false;
    this.set('RESTORING');
  }
  reconnect(): void {
    this.set('RECONNECTING');
  }
  ack(): void {
    this._grid = null;
    this._locked = false;
    this._skip = false;
    this.set('IDLE');
  }
  resetIdle(): void {
    this.ack();
  }
  error(): void {
    this.set('ERROR');
  }

  enterIdle(): void {
    this.ack();
  }
  enterError(): void {
    this.error();
  }
  enterRestoring(): void {
    this.set('RESTORING');
  }
  enterSpinning(): void {
    this.set('SPINNING');
  }
  enterAnticipation(): void {
    this.anticipate();
  }
  enterStopping(): void {
    this.beginStop();
  }
  enterLanded(): void {
    this.landed();
  }
  enterPresentingWin(): void {
    this.presentWin();
  }
  enterFeature(): void {
    this.feature();
  }
  enterReconnecting(): void {
    this.reconnect();
  }

  private set(next: SpinState): void {
    const prev = this._state;
    this._state = next;
    for (const fn of this.listeners) fn(next, prev);
  }
}
