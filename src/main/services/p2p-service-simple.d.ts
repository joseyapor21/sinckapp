import { EventEmitter } from 'events';
export interface ConnectedPeer {
    id: string;
    name: string;
    isOnline: boolean;
    lastSeen: Date;
}
export declare class P2PService extends EventEmitter {
    private peers;
    private wsServer;
    private ws;
    private deviceId;
    private deviceName;
    private isSignalingServer;
    initialize(deviceId: string, deviceName?: string): Promise<void>;
    private startSignalingServer;
    private connectToSignalingServer;
    private sendIntroduction;
    private handleSignalingMessage;
    private handlePeerIntroduction;
    private handlePeerMessage;
    private handlePeerData;
    private startPeriodicAnnouncements;
    sendMessage(peerId: string, message: any): boolean;
    sendData(peerId: string, data: Buffer): boolean;
    getConnectedPeers(): ConnectedPeer[];
    private handlePeerList;
}
//# sourceMappingURL=p2p-service-simple.d.ts.map