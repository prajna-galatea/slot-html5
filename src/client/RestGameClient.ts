import type { GameClient, SessionState, SpinRequest, SpinResult } from "./GameClient";

/** Empty shell — Origin / REST wiring comes later. */
export class RestGameClient implements GameClient {
  async bootstrap(): Promise<SessionState> {
    throw new Error("RestGameClient: not wired");
  }
  async spin(_req: SpinRequest): Promise<SpinResult> {
    throw new Error("RestGameClient: not wired");
  }
  async getState(): Promise<SessionState> {
    throw new Error("RestGameClient: not wired");
  }
  async ackRound(_roundId?: string): Promise<SessionState> {
    throw new Error("RestGameClient: not wired");
  }
}
