import type { MessageHandler, ProtocolMessage } from './Protocol';

/**
 * Network client stub — single-player mode no-ops all sends.
 * Replace with WebSocket implementation for multiplayer.
 */
export class NetworkClient {
  private connected = false;
  private handlers: MessageHandler[] = [];

  connect(_url: string): Promise<void> {
    this.connected = false;
    return Promise.resolve();
  }

  disconnect(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  send(_msg: ProtocolMessage): void {
    // Stub: in single-player mode, block changes are applied locally only.
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  /** Simulate receiving a remote message (for future testing) */
  simulateReceive(msg: ProtocolMessage): void {
    for (const handler of this.handlers) {
      handler(msg);
    }
  }
}
