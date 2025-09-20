import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { P2PService } from './p2p-service-simple';
import { WebRTCService } from './webrtc-service';

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

export class FileService {
  private readonly CHUNK_SIZE = 1024 * 1024; // 1MB for WebRTC - much faster
  private readonly CHUNK_DELAY = 0; // No artificial delays for WebRTC
  private activeTransfers: Map<string, FileTransfer> = new Map();
  private destinationFolder: string = '';
  private p2pService: P2PService | null = null;
  private webrtcService: WebRTCService | null = null;
  private syncProgress: SyncProgress = {
    totalFiles: 0,
    completedFiles: 0,
    totalBytes: 0,
    transferredBytes: 0,
    currentTransfers: [],
    useWebRTC: true
  };

  async initialize(p2pService?: P2PService): Promise<void> {
    const os = require('os');
    this.destinationFolder = path.join(os.homedir(), 'Downloads', 'SinckApp');
    this.p2pService = p2pService || null;
    
    if (this.p2pService) {
      // Set up P2P event listeners for receiving files
      this.p2pService.on('peer:message', (peerId: string, message: any) => {
        this.handlePeerMessage(peerId, message);
      });
      
      this.p2pService.on('peer:data', (peerId: string, data: Buffer) => {
        this.handlePeerData(peerId, data);
      });

      // Initialize WebRTC service for faster transfers
      this.webrtcService = new WebRTCService(this.p2pService, 'device-id');
      
      // Set up WebRTC event listeners
      this.webrtcService.on('peer:data', (peerId: string, data: Buffer) => {
        console.log(`📦 WebRTC data from ${peerId}: ${data.length} bytes`);
        this.handleWebRTCData(peerId, data);
      });
      
      this.webrtcService.on('peer:connected', (peerId: string) => {
        console.log(`🚀 WebRTC fast lane established with ${peerId}`);
      });
    }
    
    console.log('File service initialized with default destination:', this.destinationFolder);
  }

  setDestinationFolder(folder: string): void {
    this.destinationFolder = folder;
    console.log('Destination folder updated to:', this.destinationFolder);
  }

  getDestinationFolder(): string {
    return this.destinationFolder;
  }

  private async waitForWebRTCConnection(targetDeviceId: string, timeoutMs: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (this.webrtcService?.isConnected(targetDeviceId)) {
          resolve();
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('WebRTC connection timeout'));
          return;
        }
        
        setTimeout(checkConnection, 500); // Check every 500ms
      };
      
      checkConnection();
    });
  }

  async getReceivedFiles(): Promise<any[]> {
    try {
      if (!this.destinationFolder) {
        console.warn('Destination folder not set');
        return [];
      }

      // Ensure destination folder exists
      await fs.mkdir(this.destinationFolder, { recursive: true });
      
      const files = await fs.readdir(this.destinationFolder);
      const fileDetails = [];

      for (const fileName of files) {
        try {
          const filePath = path.join(this.destinationFolder, fileName);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile()) {
            fileDetails.push({
              name: fileName,
              path: filePath,
              size: stat.size,
              modified: stat.mtime,
              type: path.extname(fileName) || 'file'
            });
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn('Could not read file stats for:', fileName);
        }
      }

      // Sort by modification date (newest first)
      fileDetails.sort((a, b) => b.modified.getTime() - a.modified.getTime());
      
      return fileDetails;
    } catch (error) {
      console.error('Failed to read received files:', error);
      return [];
    }
  }

  async startSync(targetDeviceId: string, filePaths: string[]): Promise<string> {
    const syncId = crypto.randomUUID();
    
    try {
      // Try to establish WebRTC connection first (preferred method)
      if (this.webrtcService && !this.webrtcService.isConnected(targetDeviceId)) {
        console.log('🚀 Attempting WebRTC connection...');
        try {
          await this.webrtcService.createConnection(targetDeviceId);
          
          // Wait for WebRTC connection with shorter timeout
          await this.waitForWebRTCConnection(targetDeviceId, 5000); // 5 second timeout
          
          if (this.webrtcService.isConnected(targetDeviceId)) {
            console.log('✅ WebRTC connection established!');
          }
        } catch (error: any) {
          console.warn('⚠️ WebRTC connection failed, will use WebSocket fallback:', error.message);
        }
      }

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
        currentTransfers: transfers,
        useWebRTC: true
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
      // Send file start message first
      if (this.p2pService) {
        const fileStartMessage = {
          type: 'file-start',
          fileId: transfer.id,
          fileName: transfer.fileName,
          fileSize: transfer.fileSize,
          totalChunks: transfer.chunks.length
        };
        
        const messageSent = this.p2pService.sendMessage(transfer.targetDeviceId, fileStartMessage);
        if (!messageSent) {
          throw new Error('Failed to send file start message');
        }
        
        console.log(`Sent file start message for ${transfer.fileName} to ${transfer.targetDeviceId}`);
      }

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
        
        // Send chunk
        await this.sendChunk(transfer.targetDeviceId, chunk);
        
        // Clear chunk data to free memory after sending
        chunk.data = Buffer.alloc(0);
        
        // Mark chunk as completed
        transfer.completedChunks.add(i);
        transfer.progress = (transfer.completedChunks.size / transfer.chunks.length) * 100;
        
        // Update overall progress
        this.updateSyncProgress();
        
        console.log(`Sent chunk ${i + 1}/${transfer.chunks.length} for ${transfer.fileName}`);
      }
      
      await fileHandle.close();
      transfer.status = 'completed';
      this.syncProgress.completedFiles++;
      
    } catch (error) {
      console.error('File transfer failed:', error);
      transfer.status = 'failed';
    }
  }

  private async sendChunk(targetDeviceId: string, chunk: FileChunk, retryCount: number = 0): Promise<void> {
    if (!this.p2pService) {
      throw new Error('P2P service not available for file transfer');
    }

    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
      // Try WebRTC first if available
      const useWebRTC = this.webrtcService && this.webrtcService.isConnected(targetDeviceId);
      
      if (useWebRTC) {
        console.log(`🚀 Using WebRTC for chunk ${chunk.index}`);
        
        // Create efficient binary protocol: [header_length][header_json][chunk_data]
        const transfer = this.activeTransfers.get(chunk.fileId);
        const header = {
          type: 'webrtc-file-chunk',
          fileId: chunk.fileId,
          fileName: transfer?.fileName || 'unknown-file',
          chunkId: chunk.id,
          index: chunk.index,
          size: chunk.size,
          hash: chunk.hash,
          totalChunks: transfer?.chunks.length || 1
        };
        
        const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8');
        const headerLengthBuffer = Buffer.allocUnsafe(4);
        headerLengthBuffer.writeUInt32LE(headerBuffer.length, 0);
        
        // Combine: [4 bytes header length][header][chunk data]
        const messageBuffer = Buffer.concat([headerLengthBuffer, headerBuffer, chunk.data]);
        
        const success = this.webrtcService!.sendData(targetDeviceId, messageBuffer);
        if (!success) {
          throw new Error('Failed to send via WebRTC');
        }
        
        console.log(`✅ WebRTC sent chunk ${chunk.index} (${chunk.data.length} bytes) to ${targetDeviceId}`);
      } else {
        // Fallback to WebSocket method
        console.log(`📡 Using WebSocket for chunk ${chunk.index} (WebRTC not available)`);
        
        // Send chunk metadata first
        const chunkMessage = {
          type: 'file-chunk',
          fileId: chunk.fileId,
          chunkId: chunk.id,
          index: chunk.index,
          size: chunk.size,
          hash: chunk.hash,
          totalChunks: this.activeTransfers.get(chunk.fileId)?.chunks.length || 1
        };

        const messageSent = this.p2pService.sendMessage(targetDeviceId, chunkMessage);
        if (!messageSent) {
          throw new Error('Failed to send chunk metadata');
        }

        // Add small delay between metadata and data
        await new Promise(resolve => setTimeout(resolve, 10));

        // Send chunk data
        const dataSent = this.p2pService.sendData(targetDeviceId, chunk.data);
        if (!dataSent) {
          throw new Error('Failed to send chunk data');
        }

        console.log(`✅ WebSocket sent chunk ${chunk.index} (${chunk.data.length} bytes) to ${targetDeviceId}`);
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        console.warn(`⚠️ Chunk ${chunk.index} failed, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.sendChunk(targetDeviceId, chunk, retryCount + 1);
      } else {
        console.error(`❌ Failed to send chunk ${chunk.index} after ${maxRetries} attempts:`, error);
        throw error;
      }
    }
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
    
    // Log progress for debugging
    console.log('Sync progress updated:', {
      completed: this.syncProgress.completedFiles,
      total: this.syncProgress.totalFiles,
      transferredMB: Math.round(transferredBytes / 1024 / 1024)
    });
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
      const os = require('os');
      const tempDir = path.join(os.tmpdir(), 'sinckapp', chunk.fileId);
      await fs.mkdir(tempDir, { recursive: true });
      
      const chunkPath = path.join(tempDir, `chunk-${chunk.index}`);
      await fs.writeFile(chunkPath, chunk.data);
      
      console.log(`Saved chunk ${chunk.index} to: ${chunkPath}`);
      
      console.log(`Received chunk ${chunk.index} for file ${chunk.fileId}`);
      return true;
      
    } catch (error) {
      console.error('Failed to receive chunk:', error);
      return false;
    }
  }

  async assembleFile(fileId: string, fileName: string, totalChunks: number, outputPath?: string): Promise<boolean> {
    try {
      const os = require('os');
      const tempDir = path.join(os.tmpdir(), 'sinckapp', fileId);
      const finalOutputPath = outputPath || this.destinationFolder;
      
      console.log(`Assembling file: ${fileName} from ${totalChunks} chunks`);
      console.log(`Temp directory: ${tempDir}`);
      console.log(`Output path: ${finalOutputPath}`);
      
      // Check if temp directory exists
      try {
        await fs.access(tempDir);
      } catch (error) {
        console.error(`Temp directory does not exist: ${tempDir}`);
        return false;
      }
      
      // Verify all chunks exist
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk-${i}`);
        try {
          await fs.access(chunkPath);
          const stats = await fs.stat(chunkPath);
          console.log(`Chunk ${i}: ${stats.size} bytes`);
        } catch (error) {
          console.error(`Missing chunk ${i} at ${chunkPath}`);
          return false;
        }
      }
      
      // Ensure destination directory exists
      await fs.mkdir(finalOutputPath, { recursive: true });
      console.log(`Created destination directory: ${finalOutputPath}`);
      
      const outputFilePath = path.join(finalOutputPath, fileName);
      const outputFile = await fs.open(outputFilePath, 'w');
      
      let totalBytesWritten = 0;
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk-${i}`);
        const chunkData = await fs.readFile(chunkPath);
        await outputFile.write(chunkData);
        totalBytesWritten += chunkData.length;
        console.log(`Wrote chunk ${i}: ${chunkData.length} bytes`);
      }
      
      await outputFile.close();
      
      // Verify the assembled file
      const assembledStats = await fs.stat(outputFilePath);
      console.log(`File assembled successfully: ${fileName}`);
      console.log(`Total size: ${assembledStats.size} bytes (${totalBytesWritten} bytes written)`);
      console.log(`Saved to: ${outputFilePath}`);
      
      // Clean up temporary files
      try {
        await fs.rm(tempDir, { recursive: true });
        console.log(`Cleaned up temp directory: ${tempDir}`);
      } catch (error) {
        console.warn(`Failed to clean up temp directory: ${error}`);
      }
      
      return true;
      
    } catch (error) {
      console.error('Failed to assemble file:', error);
      return false;
    }
  }

  private handlePeerMessage(peerId: string, message: any): void {
    switch (message.type) {
      case 'file-start':
        this.handleFileTransferStart(peerId, message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private handlePeerData(peerId: string, data: Buffer): void {
    // WebSocket data handling is no longer used - using WebRTC only
    console.log(`Received WebSocket data from ${peerId}, ignoring (using WebRTC)`);
  }

  private handleWebRTCData(peerId: string, data: Buffer): void {
    try {
      // Parse binary protocol: [4 bytes header length][header JSON][chunk data]
      if (data.length < 4) {
        console.error('Invalid WebRTC data: too short');
        return;
      }
      
      const headerLength = data.readUInt32LE(0);
      if (data.length < 4 + headerLength) {
        console.error('Invalid WebRTC data: header length mismatch');
        return;
      }
      
      const headerBuffer = data.subarray(4, 4 + headerLength);
      const chunkData = data.subarray(4 + headerLength);
      
      const message = JSON.parse(headerBuffer.toString('utf8'));
      
      if (message.type === 'webrtc-file-chunk') {
        console.log(`📦 WebRTC chunk ${message.index} received from ${peerId}`);
        
        // Process the chunk directly with binary data
        this.processCompleteChunk(peerId, message, chunkData);
      }
    } catch (error) {
      console.error('Failed to handle WebRTC data:', error);
    }
  }

  private receivingFiles: Map<string, any> = new Map(); // Track incoming file transfers

  private handleFileTransferStart(peerId: string, message: any): void {
    console.log(`Starting to receive file: ${message.fileName} from ${peerId}`);
    
    this.receivingFiles.set(message.fileId, {
      fileId: message.fileId,
      fileName: message.fileName,
      fileSize: message.fileSize,
      totalChunks: message.totalChunks,
      receivedChunks: new Map(),
      fromPeer: peerId
    });
  }

  // WebSocket pendingChunks logic removed - using WebRTC only

  private async processCompleteChunk(peerId: string, chunkMessage: any, chunkData: Buffer): Promise<void> {
    try {
      // Verify chunk hash
      const calculatedHash = crypto.createHash('sha256').update(chunkData).digest('hex');
      if (calculatedHash !== chunkMessage.hash) {
        console.error('Chunk hash mismatch for chunk', chunkMessage.index);
        return;
      }

      console.log(`Successfully received chunk ${chunkMessage.index} for file ${chunkMessage.fileId}`);

      // Save chunk to temporary location
      const os = require('os');
      const tempDir = path.join(os.tmpdir(), 'sinckapp', chunkMessage.fileId);
      await fs.mkdir(tempDir, { recursive: true });
      
      const chunkPath = path.join(tempDir, `chunk-${chunkMessage.index}`);
      await fs.writeFile(chunkPath, chunkData);
      
      console.log(`💾 Saved chunk ${chunkMessage.index} to: ${chunkPath}`);

      // Track received chunks
      let fileTransfer = this.receivingFiles.get(chunkMessage.fileId);
      if (!fileTransfer) {
        // Create a temporary file transfer record with correct filename
        fileTransfer = {
          fileId: chunkMessage.fileId,
          fileName: chunkMessage.fileName || `received-file-${chunkMessage.fileId}`,
          totalChunks: chunkMessage.totalChunks,
          receivedChunks: new Map(),
          fromPeer: peerId
        };
        this.receivingFiles.set(chunkMessage.fileId, fileTransfer);
      }

      fileTransfer.receivedChunks.set(chunkMessage.index, true);

      // Check if all chunks received
      if (fileTransfer.receivedChunks.size === chunkMessage.totalChunks) {
        console.log(`All chunks received for file ${chunkMessage.fileId}, assembling...`);
        await this.assembleFile(
          chunkMessage.fileId, 
          fileTransfer.fileName, 
          chunkMessage.totalChunks
        );
        this.receivingFiles.delete(chunkMessage.fileId);
      }

    } catch (error) {
      console.error('Failed to process chunk:', error);
    }
  }
}