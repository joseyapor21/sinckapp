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
            readFileForWebRTC: (filePath: string) => Promise<{
                name: string;
                data: ArrayBuffer;
                type: string;
            }>;
            onSyncProgress: (callback: (progress: any) => void) => void;
            onDeviceConnected: (callback: (device: any) => void) => void;
            onDeviceDisconnected: (callback: (deviceId: string) => void) => void;
        };
    }
}
export {};
//# sourceMappingURL=preload.d.ts.map