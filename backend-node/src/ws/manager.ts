import { WebSocket } from 'ws';

export class WsManager {
  private readonly clients: Set<WebSocket> = new Set();

  connect(client: WebSocket): void {
    this.clients.add(client);
  }

  disconnect(client: WebSocket): void {
    this.clients.delete(client);
  }

  count(): number {
    return this.clients.size;
  }

  broadcast(message: unknown): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

export const manager = new WsManager();