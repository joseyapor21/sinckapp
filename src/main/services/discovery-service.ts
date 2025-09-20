import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface DiscoveryConfig {
  signalServers: string[];
  publicIP?: string;
  port: number;
}

export interface RemotePeer {
  id: string;
  name: string;
  ip: string;
  port: number;
  lastSeen: Date;
}

export class DiscoveryService extends EventEmitter {
  private config: DiscoveryConfig;
  private connectedServers: Map<string, WebSocket> = new Map();
  private knownPeers: Map<string, RemotePeer> = new Map();
  private deviceId: string = '';
  private deviceName: string = '';

  constructor(config: DiscoveryConfig) {
    super();
    this.config = config;
  }

  async initialize(deviceId: string, deviceName: string): Promise<void> {
    this.deviceId = deviceId;
    this.deviceName = deviceName;

    // Connect to all configured signal servers
    await this.connectToSignalServers();
    
    // Start periodic peer discovery
    this.startPeerDiscovery();
  }

  private async connectToSignalServers(): Promise<void> {
    const connectionPromises = this.config.signalServers.map(async (serverUrl) => {
      try {
        await this.connectToSignalServer(serverUrl);
        console.log(`Connected to signal server: ${serverUrl}`);
      } catch (error) {
        console.error(`Failed to connect to signal server ${serverUrl}:`, error);
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  private async connectToSignalServer(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serverUrl);

      ws.on('open', () => {
        this.connectedServers.set(serverUrl, ws);
        
        // Send introduction message
        const introMessage = {
          type: 'peer-announce',
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          ip: this.config.publicIP || 'unknown',
          port: this.config.port,
          timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(introMessage));
        resolve();
      });

      ws.on('message', (data) => {
        this.handleSignalMessage(JSON.parse(data.toString()));
      });

      ws.on('close', () => {
        this.connectedServers.delete(serverUrl);
        console.log(`Disconnected from signal server: ${serverUrl}`);
        
        // Attempt reconnection after delay
        setTimeout(() => {
          this.connectToSignalServer(serverUrl).catch(console.error);
        }, 5000);
      });

      ws.on('error', (error) => {
        reject(error);
      });
    });
  }

  private handleSignalMessage(message: any): void {
    switch (message.type) {
      case 'peer-announce':
        this.handlePeerAnnouncement(message);
        break;
      case 'peer-list':
        this.handlePeerList(message.peers);
        break;
      case 'peer-request':
        this.handlePeerRequest(message);
        break;
    }
  }

  private handlePeerAnnouncement(message: any): void {
    if (message.deviceId === this.deviceId) return; // Ignore self

    const peer: RemotePeer = {
      id: message.deviceId,
      name: message.deviceName,
      ip: message.ip,
      port: message.port,
      lastSeen: new Date(message.timestamp)
    };

    this.knownPeers.set(message.deviceId, peer);
    this.emit('peer-discovered', peer);
  }

  private handlePeerList(peers: any[]): void {
    peers.forEach((peerData) => {
      if (peerData.deviceId !== this.deviceId) {
        this.handlePeerAnnouncement(peerData);
      }
    });
  }

  private handlePeerRequest(message: any): void {
    // Someone is requesting to connect to us
    this.emit('peer-connection-request', message);
  }

  private startPeerDiscovery(): void {
    // Send periodic announcements
    setInterval(() => {
      this.announceSelf();
    }, 30000); // Every 30 seconds

    // Request peer lists
    setInterval(() => {
      this.requestPeerLists();
    }, 60000); // Every minute

    // Clean up old peers
    setInterval(() => {
      this.cleanupOldPeers();
    }, 120000); // Every 2 minutes
  }

  private announceSelf(): void {
    const announcement = {
      type: 'peer-announce',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      ip: this.config.publicIP || 'unknown',
      port: this.config.port,
      timestamp: Date.now()
    };

    this.broadcast(announcement);
  }

  private requestPeerLists(): void {
    const request = {
      type: 'peer-list-request',
      deviceId: this.deviceId
    };

    this.broadcast(request);
  }

  private cleanupOldPeers(): void {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    for (const [peerId, peer] of this.knownPeers.entries()) {
      if (peer.lastSeen < fiveMinutesAgo) {
        this.knownPeers.delete(peerId);
        this.emit('peer-lost', peer);
      }
    }
  }

  private broadcast(message: any): void {
    this.connectedServers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  requestPeerConnection(peerId: string): void {
    const request = {
      type: 'peer-connection-request',
      from: this.deviceId,
      to: peerId,
      timestamp: Date.now()
    };

    this.broadcast(request);
  }

  getKnownPeers(): RemotePeer[] {
    return Array.from(this.knownPeers.values());
  }

  addSignalServer(serverUrl: string): void {
    if (!this.config.signalServers.includes(serverUrl)) {
      this.config.signalServers.push(serverUrl);
      this.connectToSignalServer(serverUrl).catch(console.error);
    }
  }

  async stop(): Promise<void> {
    this.connectedServers.forEach((ws) => {
      ws.close();
    });
    this.connectedServers.clear();
    this.knownPeers.clear();
  }
}