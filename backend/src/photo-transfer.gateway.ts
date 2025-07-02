import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket, // ConnectedSocket은 NestJS @nestjs/websockets에서 옴
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'; // <-- 이 부분을 '@nestjs/websockets'로 변경해야 해.
import { Server, Socket } from 'socket.io';

// RTCSessionDescriptionInit, RTCIceCandidate는 WebRTC 표준 타입 (전역에 정의되어 있다고 가정)
// 또는 '@types/webrtc' 등에서 가져올 수 있음

interface Room {
  id: string;
  clients: string[]; // Socket IDs
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/socket.io/',
})

export class PhotoTransferGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private rooms: Map<string, Room> = new Map(); // 메모리 기반 방 관리

  handleConnection(client: Socket) {
    console.log(`[Socket.IO] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Socket.IO] Client disconnected: ${client.id}`);
    this.rooms.forEach((room) => {
      room.clients = room.clients.filter((id) => id !== client.id);
      if (room.clients.length === 0) {
        this.rooms.delete(room.id);
        console.log(`[Room] Room ${room.id} deleted as it's empty.`);
      } else {
        this.server.to(room.id).emit('room_updated', room.clients);
      }
    });
  }

  @SubscribeMessage('create_or_join_room')
  handleCreateOrJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket, // ConnectedSocket 데코레이터는 여기에 위치해야 함
  ): void {
    let room = this.rooms.get(roomId);

    if (!room) {
      room = { id: roomId, clients: [] };
      this.rooms.set(roomId, room);
      console.log(`[Room] Room ${roomId} created.`);
    }

    if (!room.clients.includes(client.id)) {
      room.clients.push(client.id);
      client.join(roomId);
      console.log(`[Room] Client ${client.id} joined room ${roomId}. Current clients: ${room.clients.length}`);

      this.server.to(roomId).emit('room_joined', {
        clientId: client.id,
        roomId: roomId,
        totalClients: room.clients.length,
      });

      if (room.clients.length > 1) {
        client.emit('ready_to_connect', room.id);
        room.clients.filter(id => id !== client.id).forEach(targetClientId => {
            this.server.to(targetClientId).emit('offer_needed', { newClient: client.id });
        });
      }
    } else {
      console.log(`[Room] Client ${client.id} already in room ${roomId}.`);
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() data: { roomId: string; targetId: string; sdp: RTCSessionDescriptionInit },
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`[WebRTC] Received offer from ${client.id} for ${data.targetId} in room ${data.roomId}`);
    this.server.to(data.targetId).emit('offer', { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: { roomId: string; targetId: string; sdp: RTCSessionDescriptionInit },
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`[WebRTC] Received answer from ${client.id} for ${data.targetId} in room ${data.roomId}`);
    this.server.to(data.targetId).emit('answer', { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage('ice_candidate')
  handleIceCandidate(
    @MessageBody() data: { roomId: string; targetId: string; candidate: RTCIceCandidate },
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`[WebRTC] Received ICE candidate from ${client.id} for ${data.targetId} in room ${data.roomId}`);
    this.server.to(data.targetId).emit('ice_candidate', {
      senderId: client.id,
      candidate: data.candidate,
    });
  }
}