import { EventEmitter } from 'events';
const SimplePeer = require('simple-peer');
const wrtc = require('wrtc');

export interface WebRTCPeer {
  id: string;
  name: string;
  connection: any;
  dataChannel?: any;
  isConnected: boolean;
}

export class WebRTCService extends EventEmitter {
  private peers: Map<string, WebRTCPeer> = new Map();
  private signalingService: any; // Reference to P2P service for signaling
  private deviceId: string = '';

  constructor(signalingService: any, deviceId: string) {
    super();
    this.signalingService = signalingService;
    this.deviceId = deviceId;
    this.setupSignalingListeners();
  }

  private setupSignalingListeners(): void {
    // Listen for WebRTC signaling messages from the signaling server
    this.signalingService.on('peer:message', (peerId: string, message: any) => {
      if (message.type === 'webrtc-signal') {
        this.handleSignal(peerId, message.signal);
      }
    });
  }

  async createConnection(peerId: string): Promise<void> {
    if (this.peers.has(peerId)) {
      console.log(`WebRTC connection already exists for ${peerId}`);
      return;
    }

    try {
      console.log(`📡 Creating WebRTC connection to ${peerId}`);
      
      // Create a peer that will initiate the connection
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        wrtc: wrtc,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      const webrtcPeer: WebRTCPeer = {
        id: peerId,
        name: `Peer-${peerId.substring(0, 8)}`,
        connection: peer,
        isConnected: false
      };

      this.peers.set(peerId, webrtcPeer);

      // Handle signaling
      peer.on('signal', (signal: any) => {
        console.log(`📤 Sending WebRTC signal to ${peerId}`);
        this.signalingService.sendMessage(peerId, {
          type: 'webrtc-signal',
          signal: signal,
          fromDevice: this.deviceId
        });
      });

      // Handle connection established
      peer.on('connect', () => {
        console.log(`🔗 WebRTC connection established with ${peerId}`);
        webrtcPeer.isConnected = true;
        this.emit('peer:connected', peerId);
      });

      // Handle data received
      peer.on('data', (data: any) => {
        console.log(`📦 WebRTC data from ${peerId}: ${data.length} bytes`);
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        this.emit('peer:data', peerId, buffer);
      });

      // Handle errors
      peer.on('error', (error: any) => {
        console.error(`❌ WebRTC error with ${peerId}:`, error);
        this.emit('peer:error', peerId, error);
        this.disconnect(peerId);
      });

      // Handle close
      peer.on('close', () => {
        console.log(`🔌 WebRTC connection closed with ${peerId}`);
        webrtcPeer.isConnected = false;
        this.emit('peer:disconnected', peerId);
        this.peers.delete(peerId);
      });

    } catch (error) {
      console.error(`❌ Failed to create WebRTC connection to ${peerId}:`, error);
      this.peers.delete(peerId);
      throw error;
    }
  }

  private handleSignal(peerId: string, signal: any): void {
    try {
      console.log(`📥 Received WebRTC signal from ${peerId}`);
      
      let peer = this.peers.get(peerId);
      
      if (!peer) {
        // Create a peer to handle incoming connection
        console.log(`📡 Creating WebRTC connection for incoming signal from ${peerId}`);
        
        const simplePeer = new SimplePeer({
          initiator: false,
          trickle: false,
          wrtc: wrtc,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        peer = {
          id: peerId,
          name: `Peer-${peerId.substring(0, 8)}`,
          connection: simplePeer,
          isConnected: false
        };

        this.peers.set(peerId, peer);

        // Handle signaling for incoming connection
        simplePeer.on('signal', (signal: any) => {
          console.log(`📤 Sending WebRTC signal response to ${peerId}`);
          this.signalingService.sendMessage(peerId, {
            type: 'webrtc-signal',
            signal: signal,
            fromDevice: this.deviceId
          });
        });

        // Handle connection established
        simplePeer.on('connect', () => {
          console.log(`🔗 WebRTC connection established with ${peerId}`);
          peer!.isConnected = true;
          this.emit('peer:connected', peerId);
        });

        // Handle data received
        simplePeer.on('data', (data: any) => {
          console.log(`📦 WebRTC data from ${peerId}: ${data.length} bytes`);
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          this.emit('peer:data', peerId, buffer);
        });

        // Handle errors
        simplePeer.on('error', (error: any) => {
          console.error(`❌ WebRTC error with ${peerId}:`, error);
          this.emit('peer:error', peerId, error);
          this.disconnect(peerId);
        });

        // Handle close
        simplePeer.on('close', () => {
          console.log(`🔌 WebRTC connection closed with ${peerId}`);
          peer!.isConnected = false;
          this.emit('peer:disconnected', peerId);
          this.peers.delete(peerId);
        });
      }

      // Process the signal
      if (peer && peer.connection) {
        peer.connection.signal(signal);
      }

    } catch (error) {
      console.error(`❌ Failed to handle WebRTC signal from ${peerId}:`, error);
    }
  }

  sendData(peerId: string, data: Buffer): boolean {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.isConnected) {
      console.error(`❌ Cannot send data to ${peerId}: not connected`);
      return false;
    }

    try {
      peer.connection.send(data);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send data to ${peerId}:`, error);
      return false;
    }
  }

  isConnected(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    return peer ? peer.isConnected : false;
  }

  disconnect(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer && peer.connection) {
      peer.connection.destroy();
      this.peers.delete(peerId);
      console.log(`🔌 Disconnected WebRTC peer ${peerId}`);
    }
  }

  destroy(): void {
    // Close all peer connections
    for (const [peerId] of this.peers.entries()) {
      this.disconnect(peerId);
    }
    this.peers.clear();
    console.log('🔒 WebRTC service destroyed');
  }
}