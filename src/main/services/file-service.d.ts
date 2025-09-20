import { P2PService } from './p2p-service-simple';
export interface FileChunk {
    id: string;
    fileId: string;
    index: number;
    size: number;
    hash: string;
    data: Buffer;
}
export interface FileTransfer {
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    targetDeviceId: string;
    progress: number;
    status: 'pending' | 'transferring' | 'completed' | 'failed';
    chunks: FileChunk[];
    completedChunks: Set<number>;
}
export interface SyncProgress {
    totalFiles: number;
    completedFiles: number;
    totalBytes: number;
    transferredBytes: number;
    currentTransfers: FileTransfer[];
    useWebRTC: boolean;
}
export declare class FileService {
    private readonly CHUNK_SIZE;
    private readonly CHUNK_DELAY;
    private activeTransfers;
    private destinationFolder;
    private p2pService;
    private webrtcService;
    private syncProgress;
    initialize(p2pService?: P2PService): Promise<void>;
    setDestinationFolder(folder: string): void;
    getDestinationFolder(): string;
    private waitForWebRTCConnection;
    getReceivedFiles(): Promise<any[]>;
    startSync(targetDeviceId: string, filePaths: string[]): Promise<string>;
    private prepareFileTransfer;
    private startFileTransfer;
    private sendChunk;
    private updateSyncProgress;
    getSyncProgress(): SyncProgress;
    receiveChunk(chunk: FileChunk, sourceDeviceId: string): Promise<boolean>;
    assembleFile(fileId: string, fileName: string, totalChunks: number, outputPath?: string): Promise<boolean>;
    private handlePeerMessage;
    private handlePeerData;
    private handleWebRTCData;
    private receivingFiles;
    private handleFileTransferStart;
    private processCompleteChunk;
}
//# sourceMappingURL=file-service.d.ts.map