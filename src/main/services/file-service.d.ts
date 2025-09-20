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
}
export declare class FileService {
    private readonly CHUNK_SIZE;
    private activeTransfers;
    private syncProgress;
    initialize(): Promise<void>;
    startSync(targetDeviceId: string, filePaths: string[]): Promise<string>;
    private prepareFileTransfer;
    private startFileTransfer;
    private sendChunk;
    private updateSyncProgress;
    getSyncProgress(): SyncProgress;
    receiveChunk(chunk: FileChunk, sourceDeviceId: string): Promise<boolean>;
    assembleFile(fileId: string, fileName: string, totalChunks: number, outputPath: string): Promise<boolean>;
}
//# sourceMappingURL=file-service.d.ts.map