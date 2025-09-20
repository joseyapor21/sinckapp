import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectDestinationFolder: () => ipcRenderer.invoke('select-destination-folder'),
  getDownloadsFolder: () => ipcRenderer.invoke('get-downloads-folder'),
  
  // Device operations
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  getConnectedDevices: () => ipcRenderer.invoke('get-connected-devices'),
  
  // File transfer operations
  startSync: (targetDeviceId: string, filePaths: string[]) => 
    ipcRenderer.invoke('start-sync', targetDeviceId, filePaths),
  getSyncProgress: () => ipcRenderer.invoke('get-sync-progress'),
  setDestinationFolder: (folderPath: string) => 
    ipcRenderer.invoke('set-destination-folder', folderPath),
  getReceivedFiles: () => ipcRenderer.invoke('get-received-files'),
  openDestinationFolder: () => ipcRenderer.invoke('open-destination-folder'),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  
  // WebRTC file operations (renderer-side)
  saveReceivedFile: (fileData: ArrayBuffer, fileName: string, fileType: string) => 
    ipcRenderer.invoke('save-received-file', fileData, fileName, fileType),
  readFileForWebRTC: (filePath: string) => 
    ipcRenderer.invoke('read-file-for-webrtc', filePath),
  
  // Event listeners
  onSyncProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('sync-progress', (event, progress) => callback(progress));
  },
  
  onDeviceConnected: (callback: (device: any) => void) => {
    ipcRenderer.on('device-connected', (event, device) => callback(device));
  },
  
  onDeviceDisconnected: (callback: (deviceId: string) => void) => {
    ipcRenderer.on('device-disconnected', (event, deviceId) => callback(deviceId));
  }
});

// Define the type for the exposed API
declare global {
  interface Window {
    electronAPI: {
      selectFiles: () => Promise<string[]>;
      selectFolder: () => Promise<string>;
      selectDestinationFolder: () => Promise<string>;
      getDownloadsFolder: () => Promise<string>;
      getDeviceInfo: () => Promise<any>;
      getConnectedDevices: () => Promise<any[]>;
      startSync: (targetDeviceId: string, filePaths: string[]) => Promise<string>;
      getSyncProgress: () => Promise<any>;
      setDestinationFolder: (folderPath: string) => Promise<string>;
      getReceivedFiles: () => Promise<any[]>;
      openDestinationFolder: () => Promise<boolean>;
      openFile: (filePath: string) => Promise<boolean>;
      saveReceivedFile: (fileData: ArrayBuffer, fileName: string, fileType: string) => Promise<string>;
      readFileForWebRTC: (filePath: string) => Promise<{name: string, data: ArrayBuffer, type: string}>;
      onSyncProgress: (callback: (progress: any) => void) => void;
      onDeviceConnected: (callback: (device: any) => void) => void;
      onDeviceDisconnected: (callback: (deviceId: string) => void) => void;
    };
  }
}