export const COLS = 5;
export const ROWS = 3;

export interface PaytableData {
  gameId?: string;
  reels?: number;
  rows?: number;
  wild: string;
  symbols: string[];
  /** symbol -> [0, 0, c3, c4, c5] (index = count-1) or [0,0,0,c3,c4,c5] (index = count). */
  pays: Record<string, number[]>;
  /** 20 if count, or the 20 patterns themselves. */
  lines: number | number[][];
  linePatterns?: number[][];
}

export interface LineWin {
  line: number;
  symbol: string;
  count: number;
  amount: number;
  positions: Array<{ reel: number; row: number }>;
}

export interface EvaluateResult {
  wins: LineWin[];
  totalWin: number;
}

function patternsOf(data: PaytableData): number[][] {
  if (Array.isArray(data.linePatterns) && data.linePatterns.length) return data.linePatterns;
  if (Array.isArray(data.lines)) return data.lines;
  return [];
}

function creditFor(table: number[] | undefined, count: number): number {
  if (!table) return 0;
  if (table.length >= 6) return table[count] ?? 0;
  return table[count - 1] ?? 0;
}

export function evaluateGrid(data: PaytableData, grid: string[][], lineBet: number): EvaluateResult {
  const wild = data.wild;
  const wins: LineWin[] = [];
  let totalWin = 0;
  const lines = patternsOf(data);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const pattern = lines[lineIndex];
    if (!pattern || pattern.length < 5) continue;
    const cells: string[] = [];
    for (let reel = 0; reel < 5; reel++) {
      cells.push(grid[reel]?.[pattern[reel] ?? 0] ?? "");
    }
    const firstNonWild = cells.find((s) => s !== wild);
    const symbol = firstNonWild ?? wild;
    let count = 0;
    for (const s of cells) {
      if (s === symbol || s === wild) count += 1;
      else break;
    }
    if (count < 3) continue;
    const credits = creditFor(data.pays[symbol], count);
    if (credits <= 0) continue;
    const amount = credits * lineBet;
    const positions = pattern.slice(0, count).map((row, reel) => ({ reel, row }));
    wins.push({ line: lineIndex, symbol, count, amount, positions });
    totalWin += amount;
  }
  return { wins, totalWin };
}

export function shouldAnticipate(data: PaytableData, grid: string[][]): boolean {
  const wild = data.wild;
  return patternsOf(data).some((pattern) => {
    const cells = pattern.slice(0, 4).map((row, reel) => grid[reel]?.[row] ?? "");
    const firstNonWild = cells.find((s) => s !== wild);
    const symbol = firstNonWild ?? wild;
    return cells.every((s) => s === symbol || s === wild);
  });
}

export class Paytable {
  readonly data: PaytableData;

  constructor(data: PaytableData) {
    this.data = data;
  }

  static load(data: PaytableData): Paytable {
    return new Paytable(data);
  }

  static async loadFromUrl(url = "/paytable.json"): Promise<Paytable> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Paytable: failed to load ${url} (${res.status})`);
    return Paytable.load((await res.json()) as PaytableData);
  }

  get wild(): string {
    return this.data.wild;
  }

  evaluate(grid: string[][], lineBet: number): EvaluateResult {
    return evaluateGrid(this.data, grid, lineBet);
  }

  needsAnticipation(grid: string[][]): boolean {
    return shouldAnticipate(this.data, grid);
  }
}
