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
export {};
//# sourceMappingURL=preload.d.ts.map