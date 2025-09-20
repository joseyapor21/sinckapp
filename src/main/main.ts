import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { P2PService } from './services/p2p-service-simple';
import { FileService } from './services/file-service';
import { DeviceService } from './services/device-service';

class SinckApp {
  private mainWindow: BrowserWindow | null = null;
  private p2pService: P2PService;
  private fileService: FileService;
  private deviceService: DeviceService;

  constructor() {
    this.p2pService = new P2PService();
    this.fileService = new FileService();
    this.deviceService = new DeviceService();
    this.initializeApp();
  }

  private initializeApp(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.setupIpcHandlers();
      this.initializeServices();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Load the app
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private setupIpcHandlers(): void {
    // File operations
    ipcMain.handle('select-files', async () => {
      if (!this.mainWindow) return [];
      
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      return result.filePaths;
    });

    ipcMain.handle('select-folder', async () => {
      if (!this.mainWindow) return '';
      
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory']
      });
      
      return result.filePaths[0] || '';
    });

    ipcMain.handle('select-destination-folder', async () => {
      if (!this.mainWindow) return '';
      
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select folder to save received files'
      });
      
      return result.filePaths[0] || '';
    });

    ipcMain.handle('get-downloads-folder', () => {
      const os = require('os');
      return path.join(os.homedir(), 'Downloads', 'SinckApp');
    });

    // Device operations
    ipcMain.handle('get-device-info', () => {
      return this.deviceService.getDeviceInfo();
    });

    ipcMain.handle('get-connected-devices', () => {
      return this.p2pService.getConnectedPeers();
    });

    // File transfer operations
    ipcMain.handle('start-sync', async (event, targetDeviceId: string, filePaths: string[]) => {
      console.log('Starting sync to device:', targetDeviceId, 'files:', filePaths);
      return this.fileService.startSync(targetDeviceId, filePaths);
    });

    ipcMain.handle('get-sync-progress', () => {
      return this.fileService.getSyncProgress();
    });

    // Destination folder operations
    ipcMain.handle('set-destination-folder', (event, folderPath: string) => {
      this.fileService.setDestinationFolder(folderPath);
      return folderPath;
    });

    ipcMain.handle('get-received-files', async () => {
      return this.fileService.getReceivedFiles();
    });

    ipcMain.handle('open-destination-folder', async () => {
      const { shell } = require('electron');
      const destinationPath = this.fileService.getDestinationFolder();
      
      // Create folder if it doesn't exist
      const fs = require('fs').promises;
      try {
        await fs.mkdir(destinationPath, { recursive: true });
        shell.openPath(destinationPath);
        return true;
      } catch (error) {
        console.error('Failed to open destination folder:', error);
        return false;
      }
    });

    ipcMain.handle('open-file', async (event, filePath: string) => {
      const { shell } = require('electron');
      try {
        await shell.openPath(filePath);
        return true;
      } catch (error) {
        console.error('Failed to open file:', error);
        return false;
      }
    });

    // WebRTC file saving (renderer-side)
    ipcMain.handle('save-received-file', async (event, fileData: ArrayBuffer, fileName: string, fileType: string) => {
      return this.fileService.saveReceivedFileFromRenderer(fileData, fileName, fileType);
    });

    // WebRTC file reading (renderer-side)
    ipcMain.handle('read-file-for-webrtc', async (event, filePath: string) => {
      const fs = require('fs').promises;
      const path = require('path');
      
      try {
        const data = await fs.readFile(filePath);
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        // Determine MIME type based on extension
        let mimeType = 'application/octet-stream';
        const mimeTypes: {[key: string]: string} = {
          '.txt': 'text/plain',
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.mp4': 'video/mp4',
          '.mov': 'video/quicktime',
          '.avi': 'video/x-msvideo',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.zip': 'application/zip',
          '.rar': 'application/x-rar-compressed'
        };
        
        if (mimeTypes[ext]) {
          mimeType = mimeTypes[ext];
        }
        
        return {
          name: fileName,
          data: data.buffer,
          type: mimeType
        };
      } catch (error) {
        console.error('Failed to read file for WebRTC:', error);
        throw error;
      }
    });
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.deviceService.initialize();
      const deviceInfo = this.deviceService.getDeviceInfo();
      console.log('Device info:', deviceInfo?.name, deviceInfo?.id.substring(0, 8));
      
      // Setup P2P event listeners
      this.p2pService.on('peer:connect', (peer) => {
        console.log('Peer connected:', peer);
        this.broadcastToRenderer('device-connected', peer);
      });
      
      this.p2pService.on('peer:disconnect', (peerId) => {
        console.log('Peer disconnected:', peerId);
        this.broadcastToRenderer('device-disconnected', peerId);
      });
      
      await this.p2pService.initialize(this.deviceService.getDeviceId(), deviceInfo?.name);
      await this.fileService.initialize(this.p2pService);
      
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  }
  
  private broadcastToRenderer(event: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(event, data);
    }
  }
}

new SinckApp();