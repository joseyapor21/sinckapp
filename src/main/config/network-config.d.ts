export interface NetworkConfig {
    signalServers: string[];
    fallbackServers: string[];
    localPort: number;
    publicSignalServer?: {
        enabled: boolean;
        port: number;
    };
}
export declare const defaultNetworkConfig: NetworkConfig;
export declare const networkConfigs: {
    development: {
        signalServers: string[];
        fallbackServers: string[];
        localPort: number;
        publicSignalServer?: {
            enabled: boolean;
            port: number;
        };
    };
    production: {
        signalServers: string[];
        fallbackServers: string[];
        localPort: number;
        publicSignalServer?: {
            enabled: boolean;
            port: number;
        };
    };
};
export declare function getNetworkConfig(environment?: string): NetworkConfig;
//# sourceMappingURL=network-config.d.ts.map