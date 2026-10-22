// RoomDurableObject — 방 1개당 1 인스턴스. WebSocket 시그널링 중계.
// WebSocket Hibernation API 사용 → idle 시 과금 없음.
// 사진은 서버 미경유(P2P). 여기선 offer/answer/ice 중계 + Perfect Negotiation 역할 지정만.

export interface Env {
  ROOM: DurableObjectNamespace;
  TURN_TOKEN_ID?: string;
  TURN_API_TOKEN?: string;
}

const MAX_CLIENTS = 2;

interface ClientMeta {
  id: string; // 서버 부여 clientId
}

export class RoomDurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // 현재 방 인원 확인 (hibernation: getWebSockets로 복원)
    const existing = this.state.getWebSockets();
    if (existing.length >= MAX_CLIENTS) {
      server.accept();
      server.send(JSON.stringify({ type: 'room_full' }));
      server.close(4001, 'room_full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const clientId = crypto.randomUUID();
    // hibernation 대응: 메타를 소켓에 attach
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id: clientId } as ClientMeta);

    // 입장 통지 + Perfect Negotiation 역할 지정
    const others = existing;
    server.send(
      JSON.stringify({
        type: 'room_joined',
        selfId: clientId,
        totalClients: others.length + 1,
      }),
    );

    if (others.length === 1) {
      const peer = others[0];
      const peerMeta = peer.deserializeAttachment() as ClientMeta;
      // 신규(server) = impolite → offer 시작
      server.send(
        JSON.stringify({
          type: 'start_negotiation',
          peerId: peerMeta.id,
          polite: false,
        }),
      );
      // 기존(peer) = polite → 상대 등장 통지
      peer.send(
        JSON.stringify({
          type: 'peer_joined',
          peerId: clientId,
          polite: true,
        }),
      );
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // Hibernation: 메시지 수신
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return;
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const selfMeta = ws.deserializeAttachment() as ClientMeta;
    const selfId = selfMeta?.id;

    switch (msg.type) {
      case 'offer':
      case 'answer':
      case 'ice_candidate': {
        // 1:1 중계: targetId로 지정된 소켓에 전달
        const target = this.findById(msg.targetId);
        if (target) {
          target.send(
            JSON.stringify({
              type: msg.type,
              senderId: selfId,
              sdp: msg.sdp,
              candidate: msg.candidate,
            }),
          );
        }
        break;
      }
      default:
        break;
    }
  }

  // Hibernation: 연결 종료 → 상대에게 peer_left
  async webSocketClose(ws: WebSocket) {
    const selfMeta = ws.deserializeAttachment() as ClientMeta;
    for (const other of this.state.getWebSockets()) {
      if (other === ws) continue;
      try {
        other.send(
          JSON.stringify({ type: 'peer_left', peerId: selfMeta?.id }),
        );
      } catch {
        /* noop */
      }
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  private findById(id: string): WebSocket | null {
    for (const ws of this.state.getWebSockets()) {
      const m = ws.deserializeAttachment() as ClientMeta;
      if (m?.id === id) return ws;
    }
    return null;
  }
}
