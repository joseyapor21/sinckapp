export interface NetworkConfig {
  signalServers: string[];
  fallbackServers: string[];
  localPort: number;
  publicSignalServer?: {
    enabled: boolean;
    port: number;
  };
}

// Default configuration
export const defaultNetworkConfig: NetworkConfig = {
  // Public signal servers for cross-network discovery
  signalServers: [
    'ws://localhost:8080', // Local network
    // Add your deployed signal server here
    // 'wss://your-signal-server.com:443'
  ],
  
  // Fallback public signal servers
  fallbackServers: [
    // You can add more public signal servers here
  ],
  
  localPort: 8080,
  
  publicSignalServer: {
    enabled: true,
    port: 8080
  }
};

// Environment-specific configurations
export const networkConfigs = {
  development: {
    ...defaultNetworkConfig,
    signalServers: [
      'ws://localhost:8080',
      'ws://localhost:8081', // For testing multiple instances
    ]
  },
  
  production: {
    ...defaultNetworkConfig,
    signalServers: [
      'ws://localhost:8080', // Local network
      // Add your production signal server here
      // 'wss://sinckapp-signal.your-domain.com:443'
    ]
  }
};

export function getNetworkConfig(environment: string = 'production'): NetworkConfig {
  return networkConfigs[environment as keyof typeof networkConfigs] || defaultNetworkConfig;
}