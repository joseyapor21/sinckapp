import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

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

export class FileService {
  private readonly CHUNK_SIZE = 64 * 1024; // 64KB
  private activeTransfers: Map<string, FileTransfer> = new Map();
  private syncProgress: SyncProgress = {
    totalFiles: 0,
    completedFiles: 0,
    totalBytes: 0,
    transferredBytes: 0,
    currentTransfers: []
  };

  async initialize(): Promise<void> {
    console.log('File service initialized');
  }

  async startSync(targetDeviceId: string, filePaths: string[]): Promise<string> {
    const syncId = crypto.randomUUID();
    
    try {
      // Calculate total size and prepare transfers
      let totalSize = 0;
      const transfers: FileTransfer[] = [];

      for (const filePath of filePaths) {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const transfer = await this.prepareFileTransfer(filePath, targetDeviceId);
          transfers.push(transfer);
          totalSize += stat.size;
        }
      }

      // Update sync progress
      this.syncProgress = {
        totalFiles: transfers.length,
        completedFiles: 0,
        totalBytes: totalSize,
        transferredBytes: 0,
        currentTransfers: transfers
      };

      // Start transfers
      for (const transfer of transfers) {
        this.activeTransfers.set(transfer.id, transfer);
        this.startFileTransfer(transfer);
      }

      return syncId;
    } catch (error) {
      console.error('Failed to start sync:', error);
      throw error;
    }
  }

  private async prepareFileTransfer(filePath: string, targetDeviceId: string): Promise<FileTransfer> {
    const stat = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const fileId = crypto.randomUUID();
    
    const transfer: FileTransfer = {
      id: fileId,
      fileName,
      filePath,
      fileSize: stat.size,
      targetDeviceId,
      progress: 0,
      status: 'pending',
      chunks: [],
      completedChunks: new Set()
    };

    // Prepare chunks
    const totalChunks = Math.ceil(stat.size / this.CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const chunkSize = Math.min(this.CHUNK_SIZE, stat.size - (i * this.CHUNK_SIZE));
      transfer.chunks.push({
        id: crypto.randomUUID(),
        fileId,
        index: i,
        size: chunkSize,
        hash: '',
        data: Buffer.alloc(0) // Will be loaded when needed
      });
    }

    return transfer;
  }

  private async startFileTransfer(transfer: FileTransfer): Promise<void> {
    transfer.status = 'transferring';
    
    try {
      // Read and process chunks
      const fileHandle = await fs.open(transfer.filePath, 'r');
      
      for (let i = 0; i < transfer.chunks.length; i++) {
        const chunk = transfer.chunks[i];
        const buffer = Buffer.alloc(chunk.size);
        
        // Read chunk data
        await fileHandle.read(buffer, 0, chunk.size, i * this.CHUNK_SIZE);
        
        // Calculate hash
        chunk.hash = crypto.createHash('sha256').update(buffer).digest('hex');
        chunk.data = buffer;
        
        // Send chunk (this would integrate with P2P service)
        await this.sendChunk(transfer.targetDeviceId, chunk);
        
        // Mark chunk as completed
        transfer.completedChunks.add(i);
        transfer.progress = (transfer.completedChunks.size / transfer.chunks.length) * 100;
        
        // Update overall progress
        this.updateSyncProgress();
      }
      
      await fileHandle.close();
      transfer.status = 'completed';
      this.syncProgress.completedFiles++;
      
    } catch (error) {
      console.error('File transfer failed:', error);
      transfer.status = 'failed';
    }
  }

  private async sendChunk(targetDeviceId: string, chunk: FileChunk): Promise<void> {
    // This would integrate with the P2P service to send chunks
    // For now, just simulate the transfer
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Sent chunk ${chunk.index} of file ${chunk.fileId} to ${targetDeviceId}`);
        resolve();
      }, 100); // Simulate network delay
    });
  }

  private updateSyncProgress(): void {
    let transferredBytes = 0;
    
    for (const transfer of this.activeTransfers.values()) {
      for (const chunkIndex of transfer.completedChunks) {
        transferredBytes += transfer.chunks[chunkIndex].size;
      }
    }
    
    this.syncProgress.transferredBytes = transferredBytes;
    this.syncProgress.currentTransfers = Array.from(this.activeTransfers.values());
  }

  getSyncProgress(): SyncProgress {
    return { ...this.syncProgress };
  }

  async receiveChunk(chunk: FileChunk, sourceDeviceId: string): Promise<boolean> {
    try {
      // Verify chunk hash
      const calculatedHash = crypto.createHash('sha256').update(chunk.data).digest('hex');
      if (calculatedHash !== chunk.hash) {
        console.error('Chunk hash mismatch');
        return false;
      }

      // Save chunk to temporary location
      const tempDir = path.join(process.cwd(), 'temp', chunk.fileId);
      await fs.mkdir(tempDir, { recursive: true });
      
      const chunkPath = path.join(tempDir, `chunk-${chunk.index}`);
      await fs.writeFile(chunkPath, chunk.data);
      
      console.log(`Received chunk ${chunk.index} for file ${chunk.fileId}`);
      return true;
      
    } catch (error) {
      console.error('Failed to receive chunk:', error);
      return false;
    }
  }

  async assembleFile(fileId: string, fileName: string, totalChunks: number, outputPath: string): Promise<boolean> {
    try {
      const tempDir = path.join(process.cwd(), 'temp', fileId);
      const outputFile = await fs.open(path.join(outputPath, fileName), 'w');
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk-${i}`);
        const chunkData = await fs.readFile(chunkPath);
        await outputFile.write(chunkData);
      }
      
      await outputFile.close();
      
      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true });
      
      console.log(`File assembled: ${fileName}`);
      return true;
      
    } catch (error) {
      console.error('Failed to assemble file:', error);
      return false;
    }
  }
}