// RoomDurableObject — 방 1개당 1 인스턴스. WebSocket 시그널링 중계.
// WebSocket Hibernation API 사용 → idle 시 과금 없음.
// 사진은 서버 미경유(P2P). 여기선 offer/answer/ice 중계 + Perfect Negotiation 역할 지정만.

export interface Env {
  ROOM: DurableObjectNamespace;
  TURN_TOKEN_ID?: string;
  TURN_API_TOKEN?: string;
  // 익명 사용량 집계(선택). NODE 원칙: 이벤트 종류별 총 횟수만 기록.
  USAGE?: {
    writeDataPoint: (event: {
      blobs?: string[];
      doubles?: number[];
      indexes?: string[];
    }) => void;
  };
}

const MAX_CLIENTS = 2;

// 익명 이벤트 1건 기록. 방번호/IP/기기/사진 등 식별정보는 절대 넣지 않는다.
// blobs=[이벤트명]만 기록 → 나중에 종류별 COUNT만 집계 가능.
function track(env: Env, event: string): void {
  try {
    env.USAGE?.writeDataPoint({ blobs: [event], doubles: [1], indexes: [event] });
  } catch {
    /* 집계 실패는 서비스에 영향 없음 */
  }
}

interface ClientMeta {
  id: string; // 서버 부여 clientId
  ck?: string; // 탭별 재접속 키 (같은 탭 재접속 시 교체용)
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

    // 재접속 키(ck): 같은 탭이 재접속하면 이전 소켓을 교체한다.
    const ck = new URL(request.url).searchParams.get('ck') || '';

    // 입장 전 좀비 소켓 정리:
    //  1) 같은 ck의 기존 소켓(= 같은 탭의 이전 연결)은 무조건 닫는다
    //     (iOS Safari 백그라운드 복귀 시 freeze된 소켓이 OPEN으로 남아도 교체됨).
    //  2) readyState가 OPEN이 아닌 죽은 소켓도 닫는다.
    for (const ws of this.state.getWebSockets()) {
      const m = ws.deserializeAttachment() as ClientMeta | null;
      const isStale = ws.readyState !== WebSocket.READY_STATE_OPEN;
      const sameTab = !!ck && m?.ck === ck;
      if (isStale || sameTab) {
        try {
          ws.close(4002, sameTab ? 'replaced' : 'stale');
        } catch {
          /* noop */
        }
      }
    }

    // 현재 방 인원 확인 — 살아있고 교체 대상이 아닌 소켓만 카운트
    const existing = this.state.getWebSockets().filter((ws) => {
      if (ws.readyState !== WebSocket.READY_STATE_OPEN) return false;
      const m = ws.deserializeAttachment() as ClientMeta | null;
      if (ck && m?.ck === ck) return false; // 방금 교체한 같은 탭
      return true;
    });
    if (existing.length >= MAX_CLIENTS) {
      track(this.env, 'room_full');
      server.accept();
      server.send(JSON.stringify({ type: 'room_full' }));
      server.close(4001, 'room_full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const clientId = crypto.randomUUID();
    // hibernation 대응: 메타를 소켓에 attach (ck 포함)
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id: clientId, ck } as ClientMeta);

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
      track(this.env, 'paired'); // 2명 연결 = 실제 세션 성립(핵심 지표)
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
    } else if (others.length === 0 && !ck) {
      // 첫 입장(새 ck 없음 = 최초 생성). ck 재접속 복귀는 중복 집계하지 않음.
      track(this.env, 'room_created');
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
  // code 4002(stale/replaced)는 서버가 좀비/중복 소켓을 정리한 것이므로
  // 상대에게 'peer_left'를 보내지 않는다(불필요한 '나갔어요' 깜빡임 방지).
  async webSocketClose(ws: WebSocket, code?: number) {
    if (code === 4002) return;
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
