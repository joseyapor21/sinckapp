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

    // Device operations
    ipcMain.handle('get-device-info', () => {
      return this.deviceService.getDeviceInfo();
    });

    ipcMain.handle('get-connected-devices', () => {
      return this.p2pService.getConnectedPeers();
    });

    // File transfer operations
    ipcMain.handle('start-sync', async (event, targetDeviceId: string, filePaths: string[]) => {
      return this.fileService.startSync(targetDeviceId, filePaths);
    });

    ipcMain.handle('get-sync-progress', () => {
      return this.fileService.getSyncProgress();
    });
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.deviceService.initialize();
      await this.p2pService.initialize(this.deviceService.getDeviceId());
      await this.fileService.initialize();
      
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  }
}

new SinckApp();