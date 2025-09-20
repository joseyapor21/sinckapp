import { EventEmitter } from 'events';
import * as wrtc from '@roamhq/wrtc';
export interface WebRTCPeer {
    id: string;
    name: string;
    connection: wrtc.RTCPeerConnection;
    dataChannel?: wrtc.RTCDataChannel;
    isConnected: boolean;
}
export declare class WebRTCService extends EventEmitter {
    private peers;
    private signalingService;
    private deviceId;
    constructor(signalingService: any, deviceId: string);
    private setupSignalingListeners;
    createConnection(peerId: string): Promise<boolean>;
    private setupPeerEventHandlers;
    private handleOffer;
    private handleAnswer;
    private handleIceCandidate;
    sendData(peerId: string, data: Buffer): boolean;
    isConnected(peerId: string): boolean;
    getConnectedPeers(): string[];
    disconnect(peerId: string): void;
    destroy(): void;
}
//# sourceMappingURL=webrtc-service.d.ts.map