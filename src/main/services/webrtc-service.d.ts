import { EventEmitter } from 'events';
export interface WebRTCPeer {
    id: string;
    name: string;
    connection: any;
    dataChannel?: any;
    isConnected: boolean;
}
export declare class WebRTCService extends EventEmitter {
    private peers;
    private signalingService;
    private deviceId;
    constructor(signalingService: any, deviceId: string);
    private setupSignalingListeners;
    createConnection(peerId: string): Promise<void>;
    private handleSignal;
    sendData(peerId: string, data: Buffer): boolean;
    isConnected(peerId: string): boolean;
    disconnect(peerId: string): void;
    destroy(): void;
}
//# sourceMappingURL=webrtc-service.d.ts.map