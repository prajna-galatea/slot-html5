import type { LineWin, PaytableData } from "../domain/Paytable";

export type { LineWin, PaytableData };

export const GAME_ID = "slot-v1";

export interface SpinRequest {
  gameId: string;
  bet: { lineBet: number; lines: number };
  clientSpinId: string;
}

export interface SpinResult {
  roundId: string;
  grid: string[][];
  wins: LineWin[];
  totalWin: number;
  balance: number;
  feature?: { type: string };
  alreadyApplied: boolean;
}

export interface SessionState {
  balance: number;
  bet: { lineBet: number; lines: number };
  pendingRound: SpinResult | null;
  feature?: { type: string };
}

export interface GameClient {
  bootstrap(): Promise<SessionState>;
  spin(req: SpinRequest): Promise<SpinResult>;
  getState(): Promise<SessionState>;
  ackRound(roundId?: string): Promise<SessionState>;
}
