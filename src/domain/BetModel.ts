export const LINES = 20;
export const FIXED_LINES = LINES;
export const LINE_BET_STEPS = [1, 2, 5, 10, 20];

export class BetModel {
  lineBet: number;
  readonly lines: number;

  constructor(lineBet = 1, lines = LINES) {
    this.lineBet = lineBet;
    this.lines = lines;
  }

  totalBet(): number {
    return this.lineBet * this.lines;
  }

  get total(): number {
    return this.totalBet();
  }

  canSpin(balance: number): boolean {
    return this.lineBet > 0 && balance >= this.totalBet();
  }

  setLineBet(n: number): void {
    this.lineBet = n;
  }

  cycle(dir: 1 | -1): number {
    const i = LINE_BET_STEPS.indexOf(this.lineBet);
    const idx = Math.max(0, Math.min(LINE_BET_STEPS.length - 1, (i < 0 ? 0 : i) + dir));
    this.lineBet = LINE_BET_STEPS[idx] ?? this.lineBet;
    return this.lineBet;
  }

  nextLineBet(): number {
    return this.cycle(1);
  }

  prevLineBet(): number {
    return this.cycle(-1);
  }
}
