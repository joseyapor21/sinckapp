# SinckApp Deployment Guide

## 🖥️ Installing on Different Platforms

### macOS Installation

1. **Download the installer**:
   ```bash
   # Build for macOS
   npm run package:mac
   ```
   - Creates: `release/SinckApp-1.0.0.dmg` and `release/SinckApp-1.0.0-mac.zip`

2. **Install**:
   - Double-click the `.dmg` file
   - Drag SinckApp to Applications folder
   - Open Applications → SinckApp

### Windows Installation

1. **Build for Windows**:
   ```bash
   npm run package:win
   ```
   - Creates: `release/SinckApp Setup 1.0.0.exe` and `release/SinckApp 1.0.0.exe` (portable)

2. **Install**:
   - Run the setup executable for system-wide installation
   - Or use the portable version (no installation required)

### Linux Installation

1. **Build for Linux**:
   ```bash
   npm run package:linux
   ```
   - Creates: `release/SinckApp-1.0.0.AppImage`, `.deb`, and `.rpm` files

2. **Install**:
   - **AppImage** (universal): `chmod +x SinckApp-1.0.0.AppImage && ./SinckApp-1.0.0.AppImage`
   - **Ubuntu/Debian**: `sudo dpkg -i SinckApp_1.0.0_amd64.deb`
   - **RedHat/CentOS**: `sudo rpm -i SinckApp-1.0.0.x86_64.rpm`

## 🌐 Cross-Network Connection Setup

### Local Network (Same WiFi)
- Devices automatically discover each other
- No additional configuration needed

### Different Networks (WAN)
You need a public signal server for peer discovery:

#### Option 1: Use Your Own Server

1. **Deploy Signal Server**:
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Configure Client**:
   - Edit `src/main/config/network-config.ts`
   - Add your server: `'wss://your-domain.com:8080'`
   - Rebuild the app

#### Option 2: Docker Deployment

1. **Build and run**:
   ```bash
   cd server
   docker-compose up -d
   ```

2. **Access**:
   - Server runs on port 8080
   - Health check: `http://your-server:8080/health`

## 🚀 Server Deployment Options

### 1. VPS/Cloud Server (DigitalOcean, AWS, etc.)

```bash
# 1. Clone repository
git clone <your-repo>
cd sinckapp/server

# 2. Install dependencies
npm install

# 3. Start with PM2 (recommended)
npm install -g pm2
npm run pm2:start

# 4. Setup auto-start
pm2 startup
pm2 save
```

### 2. Docker Deployment

```bash
# 1. Clone and build
git clone <your-repo>
cd sinckapp/server

# 2. Build and run
docker build -t sinckapp-signal .
docker run -d -p 8080:8080 --name sinckapp-signal sinckapp-signal

# Or use docker-compose
docker-compose up -d
```

### 3. Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sinckapp-signal
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sinckapp-signal
  template:
    metadata:
      labels:
        app: sinckapp-signal
    spec:
      containers:
      - name: sinckapp-signal
        image: sinckapp-signal:latest
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: sinckapp-signal-service
spec:
  selector:
    app: sinckapp-signal
  ports:
  - port: 80
    targetPort: 8080
  type: LoadBalancer
```

### 4. Railway/Heroku Deployment

1. **Create `Procfile`**:
   ```
   web: cd server && npm start
   ```

2. **Deploy**:
   - Push to Railway/Heroku
   - Set environment variable: `PORT=80`

## 🔧 Configuration

### Client Configuration

Edit `src/main/config/network-config.ts`:

```typescript
export const defaultNetworkConfig: NetworkConfig = {
  signalServers: [
    'ws://localhost:8080',           // Local network
    'wss://your-signal-server.com'   // Your public server
  ],
  fallbackServers: [
    'wss://backup-server.com'        // Backup servers
  ],
  localPort: 8080
};
```

### Server Configuration

Environment variables:

- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (production/development)

## 🔐 Security Considerations

### For Production Deployment:

1. **Enable HTTPS/WSS**:
   ```bash
   # Use reverse proxy (nginx/traefik)
   # Get SSL certificate (Let's Encrypt)
   ```

2. **Firewall Rules**:
   ```bash
   # Allow only necessary ports
   ufw allow 8080
   ufw allow 80
   ufw allow 443
   ```

3. **Rate Limiting**:
   - Implement rate limiting in signal server
   - Use tools like fail2ban

## 📱 Mobile Support (Future)

The current architecture supports adding mobile apps:

1. **React Native App**: Can use the same WebSocket signaling
2. **Flutter App**: WebRTC support available
3. **Web App**: Browser-based version possible

## 🔄 Updates and Maintenance

### Auto-Updates (Client)

Add to `package.json`:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "sinckapp"
    }
  }
}
```

### Server Updates

```bash
# Update and restart
cd server
git pull
npm install
pm2 restart sinckapp-signal
```

## 🐛 Troubleshooting

### Common Issues:

1. **Connection Failed**:
   - Check firewall settings
   - Verify signal server is running
   - Test with: `telnet your-server 8080`

2. **Peer Discovery Not Working**:
   - Ensure signal server is reachable
   - Check network connectivity
   - Verify signal server URL in config

3. **File Transfer Slow**:
   - WebRTC direct connection may not be established
   - Consider TURN server for NAT traversal

### Logs:

- **Client**: Check Electron console
- **Server**: `pm2 logs sinckapp-signal`
- **Docker**: `docker logs sinckapp-signal-server`

## 📊 Monitoring

### Server Health:

```bash
# Health check endpoint
curl http://your-server:8080/health

# Peer list
curl http://your-server:8080/peers
```

### PM2 Monitoring:

```bash
pm2 status
pm2 monit
pm2 logs
```