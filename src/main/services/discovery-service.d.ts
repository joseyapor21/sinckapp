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
export declare class DiscoveryService extends EventEmitter {
    private config;
    private connectedServers;
    private knownPeers;
    private deviceId;
    private deviceName;
    constructor(config: DiscoveryConfig);
    initialize(deviceId: string, deviceName: string): Promise<void>;
    private connectToSignalServers;
    private connectToSignalServer;
    private handleSignalMessage;
    private handlePeerAnnouncement;
    private handlePeerList;
    private handlePeerRequest;
    private startPeerDiscovery;
    private announceSelf;
    private requestPeerLists;
    private cleanupOldPeers;
    private broadcast;
    requestPeerConnection(peerId: string): void;
    getKnownPeers(): RemotePeer[];
    addSignalServer(serverUrl: string): void;
    stop(): Promise<void>;
}
//# sourceMappingURL=discovery-service.d.ts.map