import { Peer, DataConnection } from 'peerjs';

export interface FileTransferProgress {
  fileName: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface ConnectedPeer {
  id: string;
  name: string;
  isOnline: boolean;
  connection?: DataConnection;
}

export class WebRTCService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private connectedPeers: Map<string, ConnectedPeer> = new Map();
  private deviceName: string = '';
  private onPeerConnectedCallback?: (peer: ConnectedPeer) => void;
  private onPeerDisconnectedCallback?: (peerId: string) => void;
  private onFileReceivedCallback?: (file: File, sender: string) => void;
  private onProgressCallback?: (progress: FileTransferProgress) => void;

  async initialize(deviceId: string, deviceName: string): Promise<void> {
    this.deviceName = deviceName;
    
    return new Promise((resolve, reject) => {
      this.peer = new Peer(deviceId, {
        host: 'localhost',
        port: 9000,
        path: '/myapp',
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('Peer initialized with ID:', id);
        this.setupPeerEventHandlers();
        resolve();
      });

      this.peer.on('error', (error) => {
        console.error('Peer error:', error);
        reject(error);
      });
    });
  }

  private setupPeerEventHandlers(): void {
    if (!this.peer) return;

    this.peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
      this.handleIncomingConnection(conn);
    });

    this.peer.on('disconnected', () => {
      console.log('Peer disconnected from server');
      // Attempt to reconnect
      setTimeout(() => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      }, 3000);
    });
  }

  private handleIncomingConnection(conn: DataConnection): void {
    conn.on('open', () => {
      console.log('Connection opened with:', conn.peer);
      this.connections.set(conn.peer, conn);
      
      // Send device info
      conn.send({
        type: 'device-info',
        name: this.deviceName,
        id: this.peer?.id
      });

      this.setupConnectionHandlers(conn);
    });

    conn.on('error', (error) => {
      console.error('Connection error:', error);
      this.handlePeerDisconnect(conn.peer);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.handlePeerDisconnect(conn.peer);
    });
  }

  private setupConnectionHandlers(conn: DataConnection): void {
    conn.on('data', (data: any) => {
      this.handleIncomingData(conn, data);
    });
  }

  private handleIncomingData(conn: DataConnection, data: any): void {
    switch (data.type) {
      case 'device-info':
        this.handleDeviceInfo(conn.peer, data);
        break;
      case 'file-offer':
        this.handleFileOffer(conn, data);
        break;
      case 'file-chunk':
        this.handleFileChunk(conn, data);
        break;
      case 'file-complete':
        this.handleFileComplete(conn, data);
        break;
      default:
        console.log('Unknown data type:', data.type);
    }
  }

  private handleDeviceInfo(peerId: string, data: any): void {
    const peerInfo: ConnectedPeer = {
      id: peerId,
      name: data.name || peerId,
      isOnline: true,
      connection: this.connections.get(peerId)
    };

    this.connectedPeers.set(peerId, peerInfo);
    
    if (this.onPeerConnectedCallback) {
      this.onPeerConnectedCallback(peerInfo);
    }
  }

  private receivingFiles: Map<string, {
    fileName: string;
    fileType: string;
    totalSize: number;
    receivedSize: number;
    chunks: ArrayBuffer[];
  }> = new Map();

  private handleFileOffer(conn: DataConnection, data: any): void {
    console.log('Receiving file offer:', data.fileName);
    
    const fileId = `${conn.peer}-${data.fileName}`;
    this.receivingFiles.set(fileId, {
      fileName: data.fileName,
      fileType: data.fileType,
      totalSize: data.fileSize,
      receivedSize: 0,
      chunks: []
    });

    // Send acceptance
    conn.send({
      type: 'file-accept',
      fileName: data.fileName
    });
  }

  private handleFileChunk(conn: DataConnection, data: any): void {
    const fileId = `${conn.peer}-${data.fileName}`;
    const fileInfo = this.receivingFiles.get(fileId);
    
    if (!fileInfo) {
      console.error('Received chunk for unknown file:', data.fileName);
      return;
    }

    // Convert base64 back to ArrayBuffer
    const chunkData = Uint8Array.from(atob(data.chunk), c => c.charCodeAt(0));
    fileInfo.chunks.push(chunkData.buffer);
    fileInfo.receivedSize += chunkData.length;

    // Update progress
    const progress: FileTransferProgress = {
      fileName: fileInfo.fileName,
      progress: (fileInfo.receivedSize / fileInfo.totalSize) * 100,
      bytesTransferred: fileInfo.receivedSize,
      totalBytes: fileInfo.totalSize
    };

    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }

    console.log(`Received chunk for ${data.fileName}: ${fileInfo.receivedSize}/${fileInfo.totalSize} bytes`);
  }

  private handleFileComplete(conn: DataConnection, data: any): void {
    const fileId = `${conn.peer}-${data.fileName}`;
    const fileInfo = this.receivingFiles.get(fileId);
    
    if (!fileInfo) {
      console.error('Received completion for unknown file:', data.fileName);
      return;
    }

    console.log('File transfer complete:', data.fileName);

    // Combine all chunks into a single blob
    const blob = new Blob(fileInfo.chunks, { type: fileInfo.fileType });
    const file = new File([blob], fileInfo.fileName, { type: fileInfo.fileType });

    // Clean up
    this.receivingFiles.delete(fileId);

    // Notify about received file
    if (this.onFileReceivedCallback) {
      this.onFileReceivedCallback(file, conn.peer);
    }
  }

  private handlePeerDisconnect(peerId: string): void {
    this.connections.delete(peerId);
    
    const peer = this.connectedPeers.get(peerId);
    if (peer) {
      peer.isOnline = false;
      this.connectedPeers.set(peerId, peer);
    }

    if (this.onPeerDisconnectedCallback) {
      this.onPeerDisconnectedCallback(peerId);
    }
  }

  async connectToPeer(peerId: string): Promise<boolean> {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    return new Promise((resolve) => {
      const conn = this.peer!.connect(peerId);

      conn.on('open', () => {
        console.log('Connected to peer:', peerId);
        this.connections.set(peerId, conn);
        
        // Send our device info
        conn.send({
          type: 'device-info',
          name: this.deviceName,
          id: this.peer?.id
        });

        this.setupConnectionHandlers(conn);
        resolve(true);
      });

      conn.on('error', (error) => {
        console.error('Failed to connect to peer:', error);
        resolve(false);
      });

      // Set timeout for connection attempt
      setTimeout(() => {
        if (!conn.open) {
          resolve(false);
        }
      }, 10000);
    });
  }

  async sendFile(peerId: string, file: File): Promise<boolean> {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) {
      console.error('No connection to peer:', peerId);
      return false;
    }

    console.log('Sending file:', file.name, 'to peer:', peerId);

    // Send file offer
    conn.send({
      type: 'file-offer',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Wait for acceptance (simplified - in real implementation, wait for response)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send file in chunks
    const CHUNK_SIZE = 16384; // 16KB chunks
    const reader = new FileReader();
    let offset = 0;

    return new Promise((resolve) => {
      const sendNextChunk = () => {
        if (offset >= file.size) {
          // File complete
          conn.send({
            type: 'file-complete',
            fileName: file.name
          });
          console.log('File transfer complete:', file.name);
          resolve(true);
          return;
        }

        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        reader.onload = (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (arrayBuffer) {
            // Convert to base64 for transmission
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            
            conn.send({
              type: 'file-chunk',
              fileName: file.name,
              chunk: base64
            });

            offset += chunk.size;

            // Update progress
            const progress: FileTransferProgress = {
              fileName: file.name,
              progress: (offset / file.size) * 100,
              bytesTransferred: offset,
              totalBytes: file.size
            };

            if (this.onProgressCallback) {
              this.onProgressCallback(progress);
            }

            // Send next chunk after a small delay
            setTimeout(sendNextChunk, 10);
          }
        };

        reader.onerror = () => {
          console.error('Failed to read file chunk');
          resolve(false);
        };

        reader.readAsArrayBuffer(chunk);
      };

      sendNextChunk();
    });
  }

  getConnectedPeers(): ConnectedPeer[] {
    return Array.from(this.connectedPeers.values());
  }

  getMyPeerId(): string | undefined {
    return this.peer?.id;
  }

  onPeerConnected(callback: (peer: ConnectedPeer) => void): void {
    this.onPeerConnectedCallback = callback;
  }

  onPeerDisconnected(callback: (peerId: string) => void): void {
    this.onPeerDisconnectedCallback = callback;
  }

  onFileReceived(callback: (file: File, sender: string) => void): void {
    this.onFileReceivedCallback = callback;
  }

  onProgress(callback: (progress: FileTransferProgress) => void): void {
    this.onProgressCallback = callback;
  }

  destroy(): void {
    this.connections.clear();
    this.connectedPeers.clear();
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}