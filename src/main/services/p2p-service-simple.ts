import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface ConnectedPeer {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: Date;
}

export class P2PService extends EventEmitter {
  private peers: Map<string, ConnectedPeer> = new Map();
  private wsServer: WebSocket.Server | null = null;
  private ws: WebSocket | null = null;
  private deviceId: string = '';
  private deviceName: string = '';
  private isSignalingServer: boolean = false;

  async initialize(deviceId: string, deviceName?: string): Promise<void> {
    this.deviceId = deviceId;
    this.deviceName = deviceName || `Device-${deviceId.substring(0, 8)}`;
    
    try {
      // Try to connect to Railway server first
      console.log('Connecting to Railway signal server...');
      await this.connectToSignalingServer('wss://sinckapp-production.up.railway.app');
      console.log('Connected to Railway signal server');
    } catch (error) {
      console.log('Failed to connect to Railway server, trying local network...');
      try {
        // Try local signaling server
        await this.connectToSignalingServer('ws://localhost:8080');
        console.log('Connected to local signal server');
      } catch (localError) {
        // If can't connect anywhere, start our own local server
        console.log('Starting local signaling server...');
        await this.startSignalingServer();
        console.log('P2P service initialized as local signaling server');
      }
    }
  }

  private async startSignalingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsServer = new WebSocket.Server({ port: 8080 }, () => {
        console.log('Signaling server started on port 8080');
        this.isSignalingServer = true;
        resolve();
      });

      this.wsServer.on('connection', (ws) => {
        console.log('New client connected to signaling server');
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleSignalingMessage(message, ws);
            
            // Forward messages to other clients
            this.wsServer!.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data.toString());
              }
            });
          } catch (error) {
            console.error('Failed to parse message from client:', error);
          }
        });

        ws.on('close', () => {
          console.log('Client disconnected from signaling server');
        });
      });

      this.wsServer.on('error', (error) => {
        console.error('Signaling server error:', error);
        reject(error);
      });
    });
  }

  private async connectToSignalingServer(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('Connected to signaling server');
        this.sendIntroduction();
        this.startPeriodicAnnouncements();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received from Railway server:', message);
          this.handleSignalingMessage(message, this.ws!);
        } catch (error) {
          console.error('Failed to parse signaling message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from signaling server');
        this.ws = null;
      });

      this.ws.on('error', (error) => {
        console.error('Signaling server connection error:', error);
        reject(error);
      });
    });
  }

  private sendIntroduction(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Send introduction message compatible with Railway server
    const introMessage = {
      type: 'peer-announce',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      ip: 'unknown',
      port: 8080,
      timestamp: Date.now()
    };

    console.log('Sending introduction to Railway server:', introMessage);
    this.ws.send(JSON.stringify(introMessage));
  }

  private handleSignalingMessage(message: any, ws: WebSocket): void {
    switch (message.type) {
      case 'introduce':
      case 'peer-announce':
        this.handlePeerIntroduction(message, ws);
        break;
      case 'peer-list':
        this.handlePeerList(message);
        break;
      case 'peer-message':
        this.handlePeerMessage(message);
        break;
      case 'peer-data':
        this.handlePeerData(message);
        break;
    }
  }

  private handlePeerIntroduction(message: any, ws?: WebSocket): void {
    if (message.deviceId === this.deviceId) return; // Ignore self

    const peer: ConnectedPeer = {
      id: message.deviceId,
      name: message.deviceName || `Device-${message.deviceId.substring(0, 8)}`,
      isOnline: true,
      lastSeen: new Date(message.timestamp || Date.now())
    };

    const existingPeer = this.peers.get(message.deviceId);
    this.peers.set(message.deviceId, peer);
    
    if (!existingPeer) {
      console.log('New peer discovered:', peer.name, peer.id.substring(0, 8));
      this.emit('peer:connect', peer);
    }
  }

  private handlePeerMessage(envelope: any): void {
    // Handle message from another peer via signaling server
    if (envelope.to === this.deviceId) {
      console.log(`Received message from ${envelope.from}`);
      this.emit('peer:message', envelope.from, envelope.message);
    }
  }

  private handlePeerData(envelope: any): void {
    // Handle data from another peer via signaling server
    if (envelope.to === this.deviceId) {
      console.log(`Received data from ${envelope.from} (${envelope.data.length} chars base64)`);
      const data = Buffer.from(envelope.data, 'base64');
      this.emit('peer:data', envelope.from, data);
    }
  }

  private startPeriodicAnnouncements(): void {
    const interval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const announcement = {
          type: 'peer-announce',
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          ip: 'unknown',
          port: 8080,
          timestamp: Date.now()
        };
        this.ws.send(JSON.stringify(announcement));
      } else {
        clearInterval(interval);
      }
    }, 30000); // Announce every 30 seconds
  }

  sendMessage(peerId: string, message: any): boolean {
    const peer = this.peers.get(peerId);
    if (peer && peer.isOnline) {
      // Send message through signaling server to target peer
      const envelope = {
        type: 'peer-message',
        from: this.deviceId,
        to: peerId,
        message: message
      };
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(envelope));
        console.log(`Sent message to ${peerId} via signaling server`);
        return true;
      }
    }
    
    console.log(`Cannot send message to ${peerId}: peer not available or offline`);
    return false;
  }

  sendData(peerId: string, data: Buffer): boolean {
    const peer = this.peers.get(peerId);
    if (peer && peer.isOnline) {
      // Send data through signaling server to target peer
      const envelope = {
        type: 'peer-data',
        from: this.deviceId,
        to: peerId,
        data: data.toString('base64') // Convert to base64 for JSON transmission
      };
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(envelope));
        console.log(`Sent data to ${peerId} via signaling server (${data.length} bytes)`);
        return true;
      }
    }
    
    console.log(`Cannot send data to ${peerId}: peer not available or offline`);
    return false;
  }

  getConnectedPeers(): ConnectedPeer[] {
    return Array.from(this.peers.values());
  }

  private handlePeerList(message: any): void {
    if (message.peers && Array.isArray(message.peers)) {
      message.peers.forEach((peerData: any) => {
        if (peerData.deviceId !== this.deviceId) {
          this.handlePeerIntroduction(peerData);
        }
      });
    }
  }
}