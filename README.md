# SinckApp - P2P File Synchronization

A peer-to-peer file synchronization application that allows you to securely transfer large files between devices over WAN connections.

## Features

- **P2P Connectivity**: Direct device-to-device connections using libp2p with WebRTC transport
- **NAT Traversal**: Built-in support for connecting devices behind firewalls and NATs
- **Unique Device Identification**: Each device gets a unique ID and can be given a friendly name
- **Large File Support**: Chunked file transfer with resume capability
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Secure**: End-to-end encryption with public/private key authentication
- **User-Friendly**: Simple drag-and-drop interface for file selection

## Architecture

### Core Components

1. **P2P Service**: Handles peer discovery and connections using libp2p
2. **Device Service**: Manages device identity and authentication
3. **File Service**: Handles file chunking, transfer, and assembly
4. **UI**: Electron-based desktop application

### Technology Stack

- **Frontend**: Electron, TypeScript, HTML/CSS
- **P2P Networking**: libp2p with WebRTC transport
- **Encryption**: Ed25519 keys, AES-256-GCM
- **File Handling**: Node.js filesystem APIs

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd sinckapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. Start the application:
   ```bash
   npm start
   ```

## Development

### Development Mode

Run the application in development mode with hot reload:

```bash
npm run dev
```

### Building

Build the application for production:

```bash
npm run build
```

### Packaging

Package the application for distribution:

```bash
npm run package
```

## Usage

1. **Start the Application**: Launch SinckApp on all devices you want to sync
2. **Device Discovery**: Devices will automatically discover each other on the network
3. **Select Files**: Use "Select Files" or "Select Folder" to choose what to sync
4. **Choose Target Device**: Select the device you want to send files to
5. **Start Sync**: Click "Start Sync" to begin the transfer

## File Transfer Protocol

### Chunking System
- Files are split into 64KB chunks for efficient transfer
- Each chunk has a SHA-256 hash for integrity verification
- Supports resume for interrupted transfers

### Progress Tracking
- Real-time transfer speed and ETA calculation
- Per-file and overall sync progress
- Queue management for multiple file transfers

## Security

### Device Authentication
- Ed25519 public/private key pairs for each device
- Initial device pairing via shared secret or QR code
- Trusted device list with revocation capability

### Data Encryption
- End-to-end encryption using AES-256-GCM
- Perfect forward secrecy with ephemeral keys
- Message authentication to prevent tampering

## Network Requirements

### Ports
- The application uses dynamic ports for P2P connections
- WebRTC handles NAT traversal automatically
- No port forwarding required in most cases

### Firewall
- Allow the application through your firewall
- WebRTC will attempt to establish direct connections
- Falls back to relay servers if direct connection fails

## Troubleshooting

### Connection Issues
1. Check firewall settings
2. Ensure devices are on the same network or have internet access
3. Verify that WebRTC is not blocked by network policies

### Transfer Failures
1. Check available disk space on target device
2. Verify file permissions
3. Ensure stable network connection

## Development Roadmap

- [ ] Bootstrap server for initial peer discovery
- [ ] File conflict resolution
- [ ] Bandwidth throttling controls
- [ ] Mobile app support
- [ ] Web interface
- [ ] Directory synchronization
- [ ] Selective sync options
- [ ] Transfer scheduling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue on the GitHub repository.