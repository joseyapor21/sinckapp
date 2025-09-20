declare class SinckAppRenderer {
    private selectedFiles;
    private selectedDevice;
    private connectedDevices;
    private destinationFolder;
    private receivedFiles;
    constructor();
    private initializeApp;
    private setupEventListeners;
    private setupElectronEventListeners;
    private loadDeviceInfo;
    private loadConnectedDevices;
    private selectFiles;
    private selectFolder;
    private loadDefaultDestination;
    private selectDestinationFolder;
    private updateDestinationDisplay;
    private loadReceivedFiles;
    private openDestinationFolder;
    private renderReceivedFiles;
    private formatFileSize;
    private openReceivedFile;
    private renderFileList;
    private renderDeviceList;
    private removeFile;
    private selectDevice;
    private updateSyncButton;
    private startSync;
    private startProgressPolling;
    private updateSyncProgress;
    private onSyncComplete;
    private addConnectedDevice;
    private removeConnectedDevice;
    private updateUI;
}
//# sourceMappingURL=renderer.d.ts.map