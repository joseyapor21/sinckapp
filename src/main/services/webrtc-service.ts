import { EventEmitter } from 'events';
import SimplePeer from 'simple-peer';

export interface WebRTCPeer {
  id: string;
  name: string;
  peer: SimplePeer.Instance;
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
      if (message.type === 'webrtc-offer') {
        this.handleOffer(peerId, message);
      } else if (message.type === 'webrtc-answer') {
        this.handleAnswer(peerId, message);
      } else if (message.type === 'webrtc-ice-candidate') {
        this.handleIceCandidate(peerId, message);
      }
    });
  }

  async createConnection(peerId: string): Promise<boolean> {
    try {
      console.log(`Creating WebRTC connection to ${peerId}`);
      
      // Create peer connection as initiator
      const peer = new SimplePeer({
        initiator: true,
        trickle: false, // Wait for all ICE candidates
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
        peer,
        isConnected: false
      };

      this.peers.set(peerId, webrtcPeer);
      this.setupPeerEventHandlers(webrtcPeer);

      return true;
    } catch (error) {
      console.error('Failed to create WebRTC connection:', error);
      return false;
    }
  }

  private setupPeerEventHandlers(webrtcPeer: WebRTCPeer): void {
    const { peer, id } = webrtcPeer;

    peer.on('signal', (data) => {
      console.log(`Sending signal to ${id}`);
      if (data.type === 'offer') {
        this.signalingService.sendMessage(id, {
          type: 'webrtc-offer',
          from: this.deviceId,
          to: id,
          offer: data
        });
      } else if (data.type === 'answer') {
        this.signalingService.sendMessage(id, {
          type: 'webrtc-answer',
          from: this.deviceId,
          to: id,
          answer: data
        });
      } else if ((data as any).candidate) {
        this.signalingService.sendMessage(id, {
          type: 'webrtc-ice-candidate',
          from: this.deviceId,
          to: id,
          candidate: data
        });
      }
    });

    peer.on('connect', () => {
      console.log(`✅ WebRTC connection established with ${id}`);
      webrtcPeer.isConnected = true;
      this.emit('peer:connected', id);
    });

    peer.on('data', (data) => {
      console.log(`📦 Received data from ${id}: ${data.length} bytes`);
      this.emit('peer:data', id, data);
    });

    peer.on('close', () => {
      console.log(`🔌 WebRTC connection closed with ${id}`);
      webrtcPeer.isConnected = false;
      this.peers.delete(id);
      this.emit('peer:disconnected', id);
    });

    peer.on('error', (error) => {
      console.error(`❌ WebRTC error with ${id}:`, error);
      this.peers.delete(id);
      this.emit('peer:error', id, error);
    });
  }

  private handleOffer(peerId: string, message: any): void {
    try {
      console.log(`Received WebRTC offer from ${peerId}`);
      
      // Create peer connection as answerer
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
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
        peer,
        isConnected: false
      };

      this.peers.set(peerId, webrtcPeer);
      this.setupPeerEventHandlers(webrtcPeer);
      
      // Signal with the offer data
      peer.signal(message.offer);
    } catch (error) {
      console.error('Failed to handle WebRTC offer:', error);
    }
  }

  private handleAnswer(peerId: string, message: any): void {
    try {
      const webrtcPeer = this.peers.get(peerId);
      if (webrtcPeer) {
        console.log(`Received WebRTC answer from ${peerId}`);
        webrtcPeer.peer.signal(message.answer);
      }
    } catch (error) {
      console.error('Failed to handle WebRTC answer:', error);
    }
  }

  private handleIceCandidate(peerId: string, message: any): void {
    try {
      const webrtcPeer = this.peers.get(peerId);
      if (webrtcPeer) {
        console.log(`Received ICE candidate from ${peerId}`);
        webrtcPeer.peer.signal(message.candidate);
      }
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }

  sendData(peerId: string, data: Buffer): boolean {
    const webrtcPeer = this.peers.get(peerId);
    if (webrtcPeer && webrtcPeer.isConnected) {
      try {
        webrtcPeer.peer.send(data);
        return true;
      } catch (error) {
        console.error(`Failed to send data to ${peerId}:`, error);
        return false;
      }
    }
    return false;
  }

  isConnected(peerId: string): boolean {
    const webrtcPeer = this.peers.get(peerId);
    return webrtcPeer ? webrtcPeer.isConnected : false;
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.isConnected)
      .map(([id, _]) => id);
  }

  disconnect(peerId: string): void {
    const webrtcPeer = this.peers.get(peerId);
    if (webrtcPeer) {
      webrtcPeer.peer.destroy();
      this.peers.delete(peerId);
    }
  }

  destroy(): void {
    for (const [peerId, webrtcPeer] of this.peers.entries()) {
      webrtcPeer.peer.destroy();
    }
    this.peers.clear();
  }
}