import { EventEmitter } from 'events';
import { DataConnection } from 'peerjs';
export declare enum DataType {
    FILE = "FILE",
    MESSAGE = "MESSAGE"
}
export interface PeerData {
    type: DataType;
    data: any;
    filename?: string;
    filesize?: number;
    filetype?: string;
}
export interface ConnectedPeer {
    id: string;
    name: string;
    connection: DataConnection;
    isConnected: boolean;
}
export declare class PeerJSService extends EventEmitter {
    private peer;
    private connections;
    private deviceId;
    constructor(deviceId: string);
    startPeerSession(): Promise<string>;
    private setupPeerEventHandlers;
    connectToPeer(peerId: string): Promise<boolean>;
    private handleConnection;
    private handleReceivedData;
    sendFile(peerId: string, file: File): boolean;
    sendData(peerId: string, data: Buffer): boolean;
    isConnected(peerId: string): boolean;
    getConnectedPeers(): string[];
    getConnectedPeerNames(): {
        [key: string]: string;
    };
    disconnect(peerId: string): void;
    destroy(): void;
    getPeerId(): string;
}
//# sourceMappingURL=peerjs-service.d.ts.map