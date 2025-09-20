export interface DeviceInfo {
    id: string;
    name: string;
    platform: string;
    version: string;
    publicKey: string;
    privateKey: string;
}
export declare class DeviceService {
    private store;
    private deviceInfo;
    constructor();
    initialize(): Promise<void>;
    private generateDeviceInfo;
    getDeviceInfo(): DeviceInfo | null;
    getDeviceId(): string;
    updateDeviceName(name: string): void;
    getPublicKey(): string;
    getPrivateKey(): string;
}
//# sourceMappingURL=device-service.d.ts.map