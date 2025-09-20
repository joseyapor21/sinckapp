import WebSocket from 'ws';
import SimplePeer from 'simple-peer';
import { EventEmitter } from 'events';

export interface ConnectedPeer {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: Date;
  peer?: SimplePeer.Instance;
}

export class P2PService extends EventEmitter {
  private peers: Map<string, ConnectedPeer> = new Map();
  private wsServer: WebSocket.Server | null = null;
  private deviceId: string = '';
  private isSignalingServer: boolean = false;

  async initialize(deviceId: string): Promise<void> {
    this.deviceId = deviceId;
    
    try {
      // Start as signaling server
      await this.startSignalingServer();
      console.log('P2P service initialized as signaling server');
    } catch (error) {
      // If can't start server, connect to existing one
      console.log('Starting as P2P client');
      await this.connectToSignalingServer();
    }
  }

  private async startSignalingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsServer = new WebSocket.Server({ port: 8080 }, () => {
        console.log('Signaling server started on port 8080');
        this.isSignalingServer = true;
        resolve();
      });

      this.wsServer.on('error', (error) => {
        reject(error);
      });

      this.wsServer.on('connection', (ws) => {
        this.handleSignalingConnection(ws);
      });
    });
  }

  private async connectToSignalingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8080');

      ws.on('open', () => {
        console.log('Connected to signaling server');
        this.handleSignalingConnection(ws);
        resolve();
      });

      ws.on('error', (error) => {
        reject(error);
      });
    });
  }

  private handleSignalingConnection(ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleSignalingMessage(message, ws);
      } catch (error) {
        console.error('Failed to parse signaling message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Signaling connection closed');
    });

    // Send introduction message
    const introMessage = {
      type: 'introduce',
      deviceId: this.deviceId,
      deviceName: `Device-${this.deviceId.substring(0, 8)}`
    };
    ws.send(JSON.stringify(introMessage));
  }

  private handleSignalingMessage(message: any, ws: WebSocket): void {
    switch (message.type) {
      case 'introduce':
        this.handlePeerIntroduction(message, ws);
        break;
      case 'offer':
        this.handleOffer(message);
        break;
      case 'answer':
        this.handleAnswer(message);
        break;
      case 'ice-candidate':
        this.handleIceCandidate(message);
        break;
    }
  }

  private handlePeerIntroduction(message: any, ws: WebSocket): void {
    if (message.deviceId === this.deviceId) return; // Ignore self

    const peer: ConnectedPeer = {
      id: message.deviceId,
      name: message.deviceName || `Device-${message.deviceId.substring(0, 8)}`,
      isOnline: true,
      lastSeen: new Date()
    };

    this.peers.set(message.deviceId, peer);
    this.emit('peer:connect', peer);

    // If we're the signaling server, broadcast to other peers
    if (this.isSignalingServer && this.wsServer) {
      this.wsServer.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  private handleOffer(message: any): void {
    // Handle WebRTC offer from another peer
    const peer = this.peers.get(message.from);
    if (peer) {
      this.createPeerConnection(message.from, false, message.offer);
    }
  }

  private handleAnswer(message: any): void {
    // Handle WebRTC answer from another peer
    const peer = this.peers.get(message.from);
    if (peer && peer.peer) {
      peer.peer.signal(message.answer);
    }
  }

  private handleIceCandidate(message: any): void {
    // Handle ICE candidate from another peer
    const peer = this.peers.get(message.from);
    if (peer && peer.peer) {
      peer.peer.signal(message.candidate);
    }
  }

  async connectToPeer(peerId: string): Promise<boolean> {
    if (this.peers.has(peerId)) {
      this.createPeerConnection(peerId, true);
      return true;
    }
    return false;
  }

  private createPeerConnection(peerId: string, initiator: boolean, offer?: any): void {
    const peerConnection = new SimplePeer({
      initiator,
      trickle: true
    });

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.peer = peerConnection;
    }

    peerConnection.on('signal', (data) => {
      // Send signaling data through WebSocket
      const message = {
        type: data.type === 'offer' ? 'offer' : data.type === 'answer' ? 'answer' : 'ice-candidate',
        from: this.deviceId,
        to: peerId,
        [data.type === 'offer' ? 'offer' : data.type === 'answer' ? 'answer' : 'candidate']: data
      };

      // Broadcast through signaling server
      if (this.wsServer) {
        this.wsServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }
    });

    peerConnection.on('connect', () => {
      console.log('Direct P2P connection established with:', peerId);
      if (peer) {
        peer.isOnline = true;
        peer.lastSeen = new Date();
      }
      this.emit('peer:connected', peerId);
    });

    peerConnection.on('data', (data) => {
      this.handlePeerData(peerId, data);
    });

    peerConnection.on('error', (error) => {
      console.error('P2P connection error with', peerId, ':', error);
    });

    peerConnection.on('close', () => {
      console.log('P2P connection closed with:', peerId);
      if (peer) {
        peer.isOnline = false;
        peer.lastSeen = new Date();
      }
      this.emit('peer:disconnect', peerId);
    });

    // If we received an offer, signal it to start the connection
    if (offer) {
      peerConnection.signal(offer);
    }
  }

  private handlePeerData(peerId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      this.emit('peer:message', peerId, message);
    } catch (error) {
      // Handle binary data (file chunks)
      this.emit('peer:data', peerId, data);
    }
  }

  sendMessage(peerId: string, message: any): boolean {
    const peer = this.peers.get(peerId);
    if (peer && peer.peer && peer.peer.connected) {
      peer.peer.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  sendData(peerId: string, data: Buffer): boolean {
    const peer = this.peers.get(peerId);
    if (peer && peer.peer && peer.peer.connected) {
      peer.peer.send(data);
      return true;
    }
    return false;
  }

  getConnectedPeers(): ConnectedPeer[] {
    return Array.from(this.peers.values());
  }

  async stop(): Promise<void> {
    // Close all peer connections
    this.peers.forEach((peer) => {
      if (peer.peer) {
        peer.peer.destroy();
      }
    });
    this.peers.clear();

    // Close signaling server
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }
  }
}