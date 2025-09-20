import Store from 'electron-store';
import { randomUUID } from 'crypto';
import * as os from 'os';

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  version: string;
  publicKey: string;
  privateKey: string;
}

export class DeviceService {
  private store: Store;
  private deviceInfo: DeviceInfo | null = null;

  constructor() {
    this.store = new Store({
      name: 'device-config',
      encryptionKey: 'sinckapp-device-encryption-key'
    });
  }

  async initialize(): Promise<void> {
    let deviceInfo = this.store.get('deviceInfo') as DeviceInfo;
    
    if (!deviceInfo) {
      // Generate new device info
      deviceInfo = await this.generateDeviceInfo();
      this.store.set('deviceInfo', deviceInfo);
    }
    
    this.deviceInfo = deviceInfo;
  }

  private async generateDeviceInfo(): Promise<DeviceInfo> {
    const { generateKeyPair } = await import('crypto');
    
    return new Promise((resolve, reject) => {
      generateKeyPair('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({
          id: randomUUID(),
          name: `${os.hostname()}-${os.userInfo().username}`,
          platform: os.platform(),
          version: '1.0.0',
          publicKey,
          privateKey
        });
      });
    });
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  getDeviceId(): string {
    return this.deviceInfo?.id || '';
  }

  updateDeviceName(name: string): void {
    if (this.deviceInfo) {
      this.deviceInfo.name = name;
      this.store.set('deviceInfo', this.deviceInfo);
    }
  }

  getPublicKey(): string {
    return this.deviceInfo?.publicKey || '';
  }

  getPrivateKey(): string {
    return this.deviceInfo?.privateKey || '';
  }
}