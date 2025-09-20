import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // Device operations
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  getConnectedDevices: () => ipcRenderer.invoke('get-connected-devices'),
  
  // File transfer operations
  startSync: (targetDeviceId: string, filePaths: string[]) => 
    ipcRenderer.invoke('start-sync', targetDeviceId, filePaths),
  getSyncProgress: () => ipcRenderer.invoke('get-sync-progress'),
  
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
      getDeviceInfo: () => Promise<any>;
      getConnectedDevices: () => Promise<any[]>;
      startSync: (targetDeviceId: string, filePaths: string[]) => Promise<string>;
      getSyncProgress: () => Promise<any>;
      onSyncProgress: (callback: (progress: any) => void) => void;
      onDeviceConnected: (callback: (device: any) => void) => void;
      onDeviceDisconnected: (callback: (deviceId: string) => void) => void;
    };
  }
}