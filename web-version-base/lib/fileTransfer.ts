// File transfer protocol implementation

const CHUNK_SIZE = 16384; // 16KB chunks
const MESSAGE_TYPES = {
  METADATA: 'metadata',
  DATA: 'data',
  ACK: 'ack',
  ERROR: 'error',
} as const;

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  id: string;
  chunks: number;
}

export interface TransferMessage {
  type: typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
  data?: any;
  chunkIndex?: number;
  checksum?: string;
}

export function createFileMetadata(file: File): FileMetadata {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    id: generateTransferId(),
    chunks: Math.ceil(file.size / CHUNK_SIZE),
  };
}

export function generateTransferId(): string {
  return `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function chunkFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer[]> {
  const chunks: ArrayBuffer[] = [];
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    chunks.push(buffer);

    offset += CHUNK_SIZE;
    if (onProgress) {
      onProgress(Math.min((offset / file.size) * 100, 99));
    }
  }

  if (onProgress) {
    onProgress(100);
  }

  return chunks;
}

export function calculateChecksum(buffer: ArrayBuffer): string {
  // Simple checksum - in production use proper crypto
  const bytes = new Uint8Array(buffer);
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xff;
  }
  return sum.toString(16);
}

export async function sendFileChunks(
  dataChannel: RTCDataChannel,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  const metadata = createFileMetadata(file);

  // Send metadata
  const metadataMsg: TransferMessage = {
    type: MESSAGE_TYPES.METADATA,
    data: metadata,
  };
  dataChannel.send(JSON.stringify(metadataMsg));

  // Chunk and send file
  const chunks = await chunkFile(file, onProgress);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const checksum = calculateChecksum(chunk);

    const message: TransferMessage = {
      type: MESSAGE_TYPES.DATA,
      chunkIndex: i,
      checksum: checksum,
    };

    // Send message header
    dataChannel.send(JSON.stringify(message));

    // Send chunk data with backpressure handling
    await sendWithBackpressure(dataChannel, chunk);
  }
}

async function sendWithBackpressure(
  dataChannel: RTCDataChannel,
  data: ArrayBuffer
): Promise<void> {
  return new Promise((resolve) => {
    const send = () => {
      try {
        dataChannel.send(data);
        resolve();
      } catch (error) {
        if (dataChannel.bufferedAmount > CHUNK_SIZE * 4) {
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null;
            send();
          };
        } else {
          resolve();
        }
      }
    };

    send();
  });
}

export interface ReceiveState {
  metadata: FileMetadata | null;
  chunks: Map<number, ArrayBuffer>;
  receivedBytes: number;
  expectedChunks: number;
}

export function createReceiveState(): ReceiveState {
  return {
    metadata: null,
    chunks: new Map(),
    receivedBytes: 0,
    expectedChunks: 0,
  };
}

export function processReceivedMessage(
  message: TransferMessage,
  state: ReceiveState,
  chunkData?: ArrayBuffer
): void {
  if (message.type === MESSAGE_TYPES.METADATA) {
    state.metadata = message.data as FileMetadata;
    state.expectedChunks = state.metadata.chunks;
  } else if (message.type === MESSAGE_TYPES.DATA && chunkData && message.chunkIndex !== undefined) {
    state.chunks.set(message.chunkIndex, chunkData);
    state.receivedBytes += chunkData.byteLength;
  }
}

export function reconstructFile(state: ReceiveState): Blob {
  if (!state.metadata || state.chunks.size === 0) {
    throw new Error('No file data received');
  }

  const chunks: ArrayBuffer[] = [];
  for (let i = 0; i < state.metadata.chunks; i++) {
    const chunk = state.chunks.get(i);
    if (!chunk) {
      throw new Error(`Missing chunk ${i}`);
    }
    chunks.push(chunk);
  }

  return new Blob(chunks, { type: state.metadata.type });
}

export function getTransferProgress(state: ReceiveState): number {
  if (!state.metadata) return 0;
  return Math.round((state.receivedBytes / state.metadata.size) * 100);
}
