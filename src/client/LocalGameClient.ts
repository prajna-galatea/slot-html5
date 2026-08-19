import type { GameClient, PaytableData, SessionState, SpinRequest, SpinResult } from "./GameClient";
import { BetModel, LINES } from "../domain/BetModel";
import { Paytable, evaluateGrid } from "../domain/Paytable";
import { REEL_STRIPS, window3 } from "../domain/ReelStrip";
import fallbackTable from "../data/paytable.json";

export const SESSION_STORAGE_KEY = "slot-v1-session";
const STORAGE_KEY = SESSION_STORAGE_KEY;

/**
 * Local / demo client.
 * Real-money RNG must leave the client — never ship this path for cash play.
 */
export class LocalGameClient implements GameClient {
  private state: SessionState;
  private readonly table: PaytableData;
  private readonly paytable: Paytable;
  private dropNextResponse = false;

  armFakeDisconnect(): void {
    this.dropNextResponse = true;
  }

  constructor(data?: PaytableData) {
    this.table = data ?? (fallbackTable as PaytableData);
    this.paytable = Paytable.load(this.table);
    this.state = this.read() ?? {
      balance: 10_000,
      bet: { lineBet: 1, lines: LINES },
      pendingRound: null,
    };
  }

  async bootstrap(): Promise<SessionState> {
    // If pendingRound exists, return it for RESTORING — do not create a new spin.
    return this.snapshot();
  }

  async getState(): Promise<SessionState> {
    return this.snapshot();
  }

  async spin(req: SpinRequest): Promise<SpinResult> {
    if (this.state.pendingRound) {
      return this.cloneResult(this.state.pendingRound);
    }
    const bet = new BetModel(req.bet.lineBet, LINES);
    if (!bet.canSpin(this.state.balance)) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    this.state.bet = { lineBet: bet.lineBet, lines: LINES };
    this.state.balance -= bet.totalBet();

    const grid = REEL_STRIPS.map((strip) => window3(strip, randInt(strip.length)));
    const { wins, totalWin } = evaluateGrid(this.table, grid, bet.lineBet);
    void this.paytable;

    const wilds = grid.reduce((n, col) => n + col.filter((s) => s === this.table.wild).length, 0);
    const result: SpinResult = {
      roundId: req.clientSpinId,
      grid: grid.map((col) => [...col]),
      wins,
      totalWin,
      balance: this.state.balance,
      feature: wilds >= 3 ? { type: "wild-banner" } : undefined,
      alreadyApplied: false,
    };

    // Persist pendingRound FIRST so a refresh can RESTORE this exact result.
    this.state.pendingRound = result;
    this.write();
    if (this.dropNextResponse) {
      this.dropNextResponse = false;
      throw new Error("FAKE_DISCONNECT");
    }

    await sleep(200 + randInt(201));
    return this.cloneResult(result);
  }

  async ackRound(roundId?: string): Promise<SessionState> {
    const pending = this.state.pendingRound;
    if (pending && (roundId === undefined || pending.roundId === roundId)) {
      if (!pending.alreadyApplied) {
        this.state.balance += pending.totalWin;
        pending.alreadyApplied = true;
        pending.balance = this.state.balance;
      }
      this.state.pendingRound = null;
      if (pending.feature) this.state.feature = pending.feature;
      this.write();
    }
    return this.snapshot();
  }

  private cloneResult(p: SpinResult): SpinResult {
    return {
      ...p,
      grid: p.grid.map((c) => [...c]),
      wins: p.wins.map((w) => ({ ...w, positions: (w.positions ?? []).map((x) => ({ ...x })) })),
    };
  }

  private snapshot(): SessionState {
    return {
      balance: this.state.balance,
      bet: { ...this.state.bet },
      pendingRound: this.state.pendingRound ? this.cloneResult(this.state.pendingRound) : null,
      feature: this.state.feature,
    };
  }

  private read(): SessionState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SessionState;
    } catch {
      return null;
    }
  }

  private write(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}

function randInt(max: number): number {
  // Real-money RNG must move off the client.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) % Math.max(1, max);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
