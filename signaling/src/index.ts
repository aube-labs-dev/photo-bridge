// Worker 엔트리: WebSocket 시그널링 라우팅 + TURN credential 발급.
import { RoomDurableObject, Env } from './room';

export { RoomDurableObject };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS 프리플라이트
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // 헬스체크
    if (url.pathname === '/health') {
      return json({ ok: true });
    }

    // TURN credential 발급 (Cloudflare Realtime TURN)
    if (url.pathname === '/turn-credentials') {
      return handleTurnCredentials(env);
    }

    // WebSocket 시그널링: /ws?room=xxxx
    if (url.pathname === '/ws') {
      const room = url.searchParams.get('room');
      if (!room || !room.trim()) {
        return new Response('room required', { status: 400 });
      }
      const id = env.ROOM.idFromName(room.trim());
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('Photo Bridge signaling', { status: 200 });
  },
};

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// Cloudflare Realtime TURN credential 생성.
// TURN_TOKEN_ID / TURN_API_TOKEN 시크릿이 있으면 단기 자격증명 발급, 없으면 STUN만.
async function handleTurnCredentials(env: Env): Promise<Response> {
  if (!env.TURN_TOKEN_ID || !env.TURN_API_TOKEN) {
    return json({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    });
  }
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_TOKEN_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TURN_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );
    if (!res.ok) {
      return json({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      });
    }
    const data = (await res.json()) as { iceServers?: unknown };
    return json(data);
  } catch {
    return json({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    });
  }
}
