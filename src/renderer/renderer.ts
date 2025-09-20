class SinckAppRenderer {
  private selectedFiles: string[] = [];
  private selectedDevice: string | null = null;
  private connectedDevices: any[] = [];

  constructor() {
    this.initializeApp();
    this.setupEventListeners();
    this.setupElectronEventListeners();
  }

  private async initializeApp(): Promise<void> {
    await this.loadDeviceInfo();
    await this.loadConnectedDevices();
    this.updateUI();
  }

  private setupEventListeners(): void {
    // File selection buttons
    document.getElementById('select-files-btn')?.addEventListener('click', () => {
      this.selectFiles();
    });

    document.getElementById('select-folder-btn')?.addEventListener('click', () => {
      this.selectFolder();
    });

    // Device refresh button
    document.getElementById('refresh-devices-btn')?.addEventListener('click', () => {
      this.loadConnectedDevices();
    });

    // Sync button
    document.getElementById('start-sync-btn')?.addEventListener('click', () => {
      this.startSync();
    });
  }

  private setupElectronEventListeners(): void {
    if (window.electronAPI) {
      // Listen for sync progress updates
      window.electronAPI.onSyncProgress((progress) => {
        this.updateSyncProgress(progress);
      });

      // Listen for device connections
      window.electronAPI.onDeviceConnected((device) => {
        this.addConnectedDevice(device);
      });

      window.electronAPI.onDeviceDisconnected((deviceId) => {
        this.removeConnectedDevice(deviceId);
      });
    }
  }

  private async loadDeviceInfo(): Promise<void> {
    try {
      const deviceInfo = await window.electronAPI.getDeviceInfo();
      if (deviceInfo) {
        document.getElementById('device-name')!.textContent = deviceInfo.name;
        document.getElementById('device-id')!.textContent = `ID: ${deviceInfo.id.substring(0, 8)}...`;
      }
    } catch (error) {
      console.error('Failed to load device info:', error);
    }
  }

  private async loadConnectedDevices(): Promise<void> {
    try {
      this.connectedDevices = await window.electronAPI.getConnectedDevices();
      this.renderDeviceList();
    } catch (error) {
      console.error('Failed to load connected devices:', error);
    }
  }

  private async selectFiles(): Promise<void> {
    try {
      const filePaths = await window.electronAPI.selectFiles();
      if (filePaths && filePaths.length > 0) {
        this.selectedFiles = [...this.selectedFiles, ...filePaths];
        this.renderFileList();
        this.updateSyncButton();
      }
    } catch (error) {
      console.error('Failed to select files:', error);
    }
  }

  private async selectFolder(): Promise<void> {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        // For now, just add the folder path as a single item
        // In a real implementation, you'd enumerate the folder contents
        this.selectedFiles.push(folderPath);
        this.renderFileList();
        this.updateSyncButton();
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }

  private renderFileList(): void {
    const fileList = document.getElementById('selected-files')!;
    const template = document.getElementById('file-item-template') as HTMLTemplateElement;

    if (this.selectedFiles.length === 0) {
      fileList.innerHTML = `
        <div class="empty-state">
          <p>No files selected</p>
          <p class="hint">Click "Select Files" or "Select Folder" to choose files to sync</p>
        </div>
      `;
      return;
    }

    fileList.innerHTML = '';

    this.selectedFiles.forEach((filePath, index) => {
      const clone = template.content.cloneNode(true) as DocumentFragment;
      const fileItem = clone.querySelector('.file-item')!;
      const fileName = clone.querySelector('.file-name')!;
      const filePathElement = clone.querySelector('.file-path')!;
      const removeBtn = clone.querySelector('.btn-danger')!;

      fileName.textContent = filePath.split('/').pop() || filePath;
      filePathElement.textContent = filePath;

      removeBtn.addEventListener('click', () => {
        this.removeFile(index);
      });

      fileList.appendChild(clone);
    });
  }

  private renderDeviceList(): void {
    const deviceList = document.getElementById('connected-devices')!;
    const template = document.getElementById('device-item-template') as HTMLTemplateElement;

    if (this.connectedDevices.length === 0) {
      deviceList.innerHTML = `
        <div class="empty-state">
          <p>No devices connected</p>
          <p class="hint">Devices will appear here when they come online</p>
        </div>
      `;
      return;
    }

    deviceList.innerHTML = '';

    this.connectedDevices.forEach((device) => {
      const clone = template.content.cloneNode(true) as DocumentFragment;
      const deviceItem = clone.querySelector('.device-item')!;
      const deviceName = clone.querySelector('.device-name')!;
      const deviceId = clone.querySelector('.device-id')!;
      const deviceStatus = clone.querySelector('.device-status')!;
      const selectBtn = clone.querySelector('.select-device-btn')! as HTMLButtonElement;

      deviceName.textContent = device.name;
      deviceId.textContent = device.id.substring(0, 16) + '...';
      deviceStatus.textContent = device.isOnline ? 'Online' : 'Offline';
      
      if (!device.isOnline) {
        deviceStatus.classList.add('offline');
        selectBtn.disabled = true;
      }

      if (this.selectedDevice === device.id) {
        deviceItem.classList.add('selected');
        selectBtn.textContent = 'Selected';
        selectBtn.disabled = true;
      }

      selectBtn.addEventListener('click', () => {
        this.selectDevice(device.id);
      });

      deviceList.appendChild(clone);
    });
  }

  private removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.renderFileList();
    this.updateSyncButton();
  }

  private selectDevice(deviceId: string): void {
    this.selectedDevice = deviceId;
    this.renderDeviceList();
    this.updateSyncButton();
  }

  private updateSyncButton(): void {
    const syncBtn = document.getElementById('start-sync-btn') as HTMLButtonElement;
    const statusText = document.getElementById('sync-status-text')!;

    const hasFiles = this.selectedFiles.length > 0;
    const hasDevice = this.selectedDevice !== null;

    syncBtn.disabled = !(hasFiles && hasDevice);

    if (!hasFiles && !hasDevice) {
      statusText.textContent = 'Select files and a target device';
    } else if (!hasFiles) {
      statusText.textContent = 'Select files to sync';
    } else if (!hasDevice) {
      statusText.textContent = 'Select a target device';
    } else {
      statusText.textContent = `Ready to sync ${this.selectedFiles.length} file(s)`;
    }
  }

  private async startSync(): Promise<void> {
    if (!this.selectedDevice || this.selectedFiles.length === 0) {
      return;
    }

    try {
      const syncBtn = document.getElementById('start-sync-btn') as HTMLButtonElement;
      const statusText = document.getElementById('sync-status-text')!;

      syncBtn.disabled = true;
      statusText.textContent = 'Starting sync...';

      const syncId = await window.electronAPI.startSync(this.selectedDevice, this.selectedFiles);
      
      statusText.textContent = 'Sync in progress...';
      this.startProgressPolling();

    } catch (error) {
      console.error('Failed to start sync:', error);
      const statusText = document.getElementById('sync-status-text')!;
      statusText.textContent = 'Sync failed';
    }
  }

  private startProgressPolling(): void {
    const pollProgress = async () => {
      try {
        const progress = await window.electronAPI.getSyncProgress();
        this.updateSyncProgress(progress);

        if (progress.completedFiles < progress.totalFiles) {
          setTimeout(pollProgress, 1000); // Poll every second
        } else {
          this.onSyncComplete();
        }
      } catch (error) {
        console.error('Failed to get sync progress:', error);
      }
    };

    pollProgress();
  }

  private updateSyncProgress(progress: any): void {
    const progressContainer = document.getElementById('sync-progress')!;
    const template = document.getElementById('progress-item-template') as HTMLTemplateElement;

    if (progress.currentTransfers.length === 0) {
      progressContainer.innerHTML = `
        <div class="empty-state">
          <p>No active transfers</p>
        </div>
      `;
      return;
    }

    progressContainer.innerHTML = '';

    progress.currentTransfers.forEach((transfer: any) => {
      const clone = template.content.cloneNode(true) as DocumentFragment;
      const fileName = clone.querySelector('.file-name')!;
      const progressPercentage = clone.querySelector('.progress-percentage')!;
      const progressFill = clone.querySelector('.progress-fill')! as HTMLElement;
      const transferSpeed = clone.querySelector('.transfer-speed')!;
      const eta = clone.querySelector('.eta')!;

      fileName.textContent = transfer.fileName;
      progressPercentage.textContent = `${Math.round(transfer.progress)}%`;
      progressFill.style.width = `${transfer.progress}%`;
      
      // Calculate transfer speed (simplified)
      const speedKBps = Math.round(Math.random() * 1000); // Mock speed
      transferSpeed.textContent = `${speedKBps} KB/s`;
      
      // Calculate ETA (simplified)
      const remainingPercent = 100 - transfer.progress;
      const etaSeconds = Math.round((remainingPercent / 100) * 60); // Mock ETA
      eta.textContent = `ETA: ${etaSeconds}s`;

      progressContainer.appendChild(clone);
    });

    // Update overall status
    const statusText = document.getElementById('sync-status-text')!;
    const overallProgress = Math.round((progress.completedFiles / progress.totalFiles) * 100);
    statusText.textContent = `Syncing... ${overallProgress}% complete (${progress.completedFiles}/${progress.totalFiles} files)`;
  }

  private onSyncComplete(): void {
    const syncBtn = document.getElementById('start-sync-btn') as HTMLButtonElement;
    const statusText = document.getElementById('sync-status-text')!;
    const progressContainer = document.getElementById('sync-progress')!;

    syncBtn.disabled = false;
    statusText.textContent = 'Sync completed successfully!';
    
    progressContainer.innerHTML = `
      <div class="empty-state">
        <p>✅ Sync completed</p>
        <p class="hint">All files have been transferred successfully</p>
      </div>
    `;

    // Reset after a delay
    setTimeout(() => {
      this.selectedFiles = [];
      this.selectedDevice = null;
      this.renderFileList();
      this.renderDeviceList();
      this.updateSyncButton();
      
      progressContainer.innerHTML = `
        <div class="empty-state">
          <p>No active transfers</p>
        </div>
      `;
    }, 3000);
  }

  private addConnectedDevice(device: any): void {
    const existingIndex = this.connectedDevices.findIndex(d => d.id === device.id);
    if (existingIndex >= 0) {
      this.connectedDevices[existingIndex] = device;
    } else {
      this.connectedDevices.push(device);
    }
    this.renderDeviceList();
  }

  private removeConnectedDevice(deviceId: string): void {
    const device = this.connectedDevices.find(d => d.id === deviceId);
    if (device) {
      device.isOnline = false;
      this.renderDeviceList();
    }
  }

  private updateUI(): void {
    this.renderFileList();
    this.renderDeviceList();
    this.updateSyncButton();
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SinckAppRenderer();
});