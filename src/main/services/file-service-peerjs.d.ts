export interface SyncProgress {
    totalFiles: number;
    completedFiles: number;
    transferredBytes: number;
    currentTransfers: any[];
    isActive: boolean;
}
export declare class FileServicePeerJS {
    private destinationFolder;
    private peerJSService;
    private syncProgress;
    initialize(deviceId: string): Promise<void>;
    private saveReceivedFile;
    setDestinationFolder(folder: string): void;
    getDestinationFolder(): string;
    connectToPeer(peerId: string): Promise<boolean>;
    sendFiles(targetDeviceId: string, filePaths: string[]): Promise<string>;
    getSyncProgress(): SyncProgress;
    getReceivedFiles(): Promise<any[]>;
    getConnectedDevices(): {
        [key: string]: string;
    };
    getPeerId(): string;
    isConnectedToPeer(peerId: string): boolean;
    disconnect(peerId: string): void;
    destroy(): void;
}
//# sourceMappingURL=file-service-peerjs.d.ts.map