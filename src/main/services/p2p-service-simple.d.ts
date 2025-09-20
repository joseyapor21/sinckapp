import SimplePeer from 'simple-peer';
import { EventEmitter } from 'events';
export interface ConnectedPeer {
    id: string;
    name: string;
    isOnline: boolean;
    lastSeen: Date;
    peer?: SimplePeer.Instance;
}
export declare class P2PService extends EventEmitter {
    private peers;
    private wsServer;
    private deviceId;
    private isSignalingServer;
    initialize(deviceId: string): Promise<void>;
    private startSignalingServer;
    private connectToSignalingServer;
    private handleSignalingConnection;
    private handleSignalingMessage;
    private handlePeerIntroduction;
    private handleOffer;
    private handleAnswer;
    private handleIceCandidate;
    connectToPeer(peerId: string): Promise<boolean>;
    private createPeerConnection;
    private handlePeerData;
    sendMessage(peerId: string, message: any): boolean;
    sendData(peerId: string, data: Buffer): boolean;
    getConnectedPeers(): ConnectedPeer[];
    stop(): Promise<void>;
}
//# sourceMappingURL=p2p-service-simple.d.ts.map