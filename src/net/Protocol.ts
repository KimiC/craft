/** Network protocol message types — reserved for future multiplayer */

export interface BlockUpdateMessage {
  type: 'block_update';
  x: number;
  y: number;
  z: number;
  blockId: number;
  playerId: string;
}

export interface PlayerMoveMessage {
  type: 'player_move';
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface ChunkRequestMessage {
  type: 'chunk_request';
  cx: number;
  cz: number;
}

export interface ChunkDataMessage {
  type: 'chunk_data';
  cx: number;
  cz: number;
  data: ArrayBuffer;
}

export type ProtocolMessage =
  | BlockUpdateMessage
  | PlayerMoveMessage
  | ChunkRequestMessage
  | ChunkDataMessage;

export type MessageHandler = (msg: ProtocolMessage) => void;
