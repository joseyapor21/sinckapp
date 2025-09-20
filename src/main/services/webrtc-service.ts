import { EventEmitter } from 'events';
import * as wrtc from '@roamhq/wrtc';

export interface WebRTCPeer {
  id: string;
  name: string;
  connection: wrtc.RTCPeerConnection;
  dataChannel?: wrtc.RTCDataChannel;
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
      const connection = new wrtc.RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Create data channel for file transfer with optimized settings
      const dataChannel = connection.createDataChannel('fileTransfer', {
        ordered: false, // Allow out-of-order delivery for speed
        maxRetransmits: 0, // No retransmissions for speed
        maxPacketLifeTime: 3000 // 3 second packet lifetime
      });

      const webrtcPeer: WebRTCPeer = {
        id: peerId,
        name: `Peer-${peerId.substring(0, 8)}`,
        connection,
        dataChannel,
        isConnected: false
      };

      this.peers.set(peerId, webrtcPeer);
      this.setupPeerEventHandlers(webrtcPeer);

      // Create offer
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      // Send offer through signaling
      this.signalingService.sendMessage(peerId, {
        type: 'webrtc-offer',
        from: this.deviceId,
        to: peerId,
        offer: offer
      });

      return true;
    } catch (error) {
      console.error('Failed to create WebRTC connection:', error);
      return false;
    }
  }

  private setupPeerEventHandlers(webrtcPeer: WebRTCPeer): void {
    const { connection, dataChannel, id } = webrtcPeer;

    // ICE candidate handling
    connection.onicecandidate = (event: wrtc.RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${id}`);
        this.signalingService.sendMessage(id, {
          type: 'webrtc-ice-candidate',
          from: this.deviceId,
          to: id,
          candidate: event.candidate
        });
      }
    };

    // Connection state changes
    connection.onconnectionstatechange = () => {
      console.log(`Connection state with ${id}: ${connection.connectionState}`);
      if (connection.connectionState === 'connected') {
        console.log(`✅ WebRTC connection established with ${id}`);
        webrtcPeer.isConnected = true;
        this.emit('peer:connected', id);
      } else if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        console.log(`🔌 WebRTC connection closed with ${id}`);
        webrtcPeer.isConnected = false;
        this.peers.delete(id);
        this.emit('peer:disconnected', id);
      }
    };

    // Data channel handling for initiator
    if (dataChannel) {
      dataChannel.onopen = () => {
        console.log(`Data channel opened with ${id}`);
      };

      dataChannel.onmessage = (event: MessageEvent) => {
        console.log(`📦 Received data from ${id}: ${event.data.byteLength || event.data.length} bytes`);
        this.emit('peer:data', id, event.data);
      };

      dataChannel.onerror = (error: Event) => {
        console.error(`❌ Data channel error with ${id}:`, error);
        this.emit('peer:error', id, error);
      };
    }

    // Handle incoming data channels (for answerer)
    connection.ondatachannel = (event: wrtc.RTCDataChannelEvent) => {
      const channel = event.channel;
      webrtcPeer.dataChannel = channel;

      channel.onopen = () => {
        console.log(`Incoming data channel opened with ${id}`);
      };

      channel.onmessage = (event: MessageEvent) => {
        console.log(`📦 Received data from ${id}: ${event.data.byteLength || event.data.length} bytes`);
        this.emit('peer:data', id, event.data);
      };

      channel.onerror = (error: Event) => {
        console.error(`❌ Data channel error with ${id}:`, error);
        this.emit('peer:error', id, error);
      };
    };
  }

  private async handleOffer(peerId: string, message: any): Promise<void> {
    try {
      console.log(`Received WebRTC offer from ${peerId}`);
      
      // Create peer connection as answerer
      const connection = new wrtc.RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      const webrtcPeer: WebRTCPeer = {
        id: peerId,
        name: `Peer-${peerId.substring(0, 8)}`,
        connection,
        isConnected: false
      };

      this.peers.set(peerId, webrtcPeer);
      this.setupPeerEventHandlers(webrtcPeer);
      
      // Set remote description with the offer
      await connection.setRemoteDescription(message.offer);
      
      // Create and send answer
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);

      this.signalingService.sendMessage(peerId, {
        type: 'webrtc-answer',
        from: this.deviceId,
        to: peerId,
        answer: answer
      });
    } catch (error) {
      console.error('Failed to handle WebRTC offer:', error);
    }
  }

  private async handleAnswer(peerId: string, message: any): Promise<void> {
    try {
      const webrtcPeer = this.peers.get(peerId);
      if (webrtcPeer) {
        console.log(`Received WebRTC answer from ${peerId}`);
        await webrtcPeer.connection.setRemoteDescription(message.answer);
      }
    } catch (error) {
      console.error('Failed to handle WebRTC answer:', error);
    }
  }

  private async handleIceCandidate(peerId: string, message: any): Promise<void> {
    try {
      const webrtcPeer = this.peers.get(peerId);
      if (webrtcPeer) {
        console.log(`Received ICE candidate from ${peerId}`);
        await webrtcPeer.connection.addIceCandidate(message.candidate);
      }
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }

  sendData(peerId: string, data: Buffer): boolean {
    const webrtcPeer = this.peers.get(peerId);
    if (webrtcPeer && webrtcPeer.isConnected && webrtcPeer.dataChannel) {
      try {
        if (webrtcPeer.dataChannel.readyState === 'open') {
          webrtcPeer.dataChannel.send(new Uint8Array(data));
          return true;
        }
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
      if (webrtcPeer.dataChannel) {
        webrtcPeer.dataChannel.close();
      }
      webrtcPeer.connection.close();
      this.peers.delete(peerId);
    }
  }

  destroy(): void {
    for (const [peerId, webrtcPeer] of this.peers.entries()) {
      if (webrtcPeer.dataChannel) {
        webrtcPeer.dataChannel.close();
      }
      webrtcPeer.connection.close();
    }
    this.peers.clear();
  }
}