import { DataConnection } from 'peerjs';
export interface FileTransferProgress {
    fileName: string;
    progress: number;
    bytesTransferred: number;
    totalBytes: number;
}
export interface ConnectedPeer {
    id: string;
    name: string;
    isOnline: boolean;
    connection?: DataConnection;
}
export declare class WebRTCService {
    private peer;
    private connections;
    private connectedPeers;
    private deviceName;
    private onPeerConnectedCallback?;
    private onPeerDisconnectedCallback?;
    private onFileReceivedCallback?;
    private onProgressCallback?;
    initialize(deviceId: string, deviceName: string): Promise<void>;
    private setupPeerEventHandlers;
    private handleIncomingConnection;
    private setupConnectionHandlers;
    private handleIncomingData;
    private handleDeviceInfo;
    private receivingFiles;
    private handleFileOffer;
    private handleFileChunk;
    private handleFileComplete;
    private handlePeerDisconnect;
    connectToPeer(peerId: string): Promise<boolean>;
    sendFile(peerId: string, file: File): Promise<boolean>;
    getConnectedPeers(): ConnectedPeer[];
    getMyPeerId(): string | undefined;
    onPeerConnected(callback: (peer: ConnectedPeer) => void): void;
    onPeerDisconnected(callback: (peerId: string) => void): void;
    onFileReceived(callback: (file: File, sender: string) => void): void;
    onProgress(callback: (progress: FileTransferProgress) => void): void;
    destroy(): void;
}
//# sourceMappingURL=webrtc-service.d.ts.map