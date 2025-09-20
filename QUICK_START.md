# SinckApp Quick Start Guide

## 🚀 Quick Installation & Setup

### 1. Install on Current Machine (macOS)

```bash
# Build the application
npm run build

# Run the application
npm start
```

The app will open and automatically start a local signal server on port 8080.

### 2. Install on Another Mac

**Option A: Build from source**
```bash
# 1. Clone/copy the project to the other Mac
git clone <your-repo> # or copy the folder
cd sinckapp

# 2. Install and build
npm install
npm run build
npm start
```

**Option B: Create installer package**
```bash
# On your current Mac, create a .dmg installer
npm run package:mac

# Copy the .dmg file to the other Mac
# File will be in: release/SinckApp-1.0.0.dmg
```

### 3. Connect Between Different Networks

#### Quick Setup for Cross-Network Connection:

1. **Deploy a Signal Server** (one-time setup):

   **Using a VPS/Cloud Server:**
   ```bash
   # On your server
   git clone <your-repo>
   cd sinckapp/server
   npm install
   npm start
   ```

   **Using Docker (easier):**
   ```bash
   # On your server
   cd sinckapp/server
   docker-compose up -d
   ```

2. **Configure Clients**:
   
   Edit `src/main/config/network-config.ts` and add your server:
   ```typescript
   signalServers: [
     'ws://localhost:8080',                    // Local network
     'wss://your-server-ip-or-domain.com:8080' // Your public server
   ]
   ```

3. **Rebuild and run**:
   ```bash
   npm run build
   npm start
   ```

## 🖥️ Building for Other Platforms

### For Windows:
```bash
npm run package:win
# Creates: release/SinckApp Setup 1.0.0.exe
```

### For Linux:
```bash
npm run package:linux
# Creates: release/SinckApp-1.0.0.AppImage
```

### For All Platforms at Once:
```bash
npm run package:all
```

## 🌐 Server Deployment Options

### Option 1: Free Hosting (Railway)

1. Create account at railway.app
2. Connect your GitHub repo
3. Deploy the `server` folder
4. Railway will provide a public URL

### Option 2: VPS (DigitalOcean, AWS, etc.)

```bash
# 1. SSH to your server
ssh user@your-server-ip

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone and setup
git clone <your-repo>
cd sinckapp/server
npm install

# 4. Install PM2 and start
npm install -g pm2
pm2 start signal-server.js --name sinckapp-signal
pm2 startup
pm2 save
```

### Option 3: Local Network Only

If you only need devices on the same WiFi network:
- No server deployment needed
- First device becomes the signal server automatically
- Other devices connect to it

## ✅ Testing the Connection

### 1. Same Network Test:
1. Start SinckApp on Device A
2. Start SinckApp on Device B (same WiFi)
3. Devices should appear in each other's "Connected Devices" list

### 2. Different Networks Test:
1. Deploy signal server (see above)
2. Configure both clients with server URL
3. Start both apps
4. They should discover each other through the signal server

### 3. File Transfer Test:
1. Select files on Device A
2. Choose Device B from the list
3. Click "Start Sync"
4. Monitor progress in the center panel

## 🔧 Troubleshooting

### "No devices found":
- Check if signal server is running
- Verify firewall allows port 8080
- Test server with: `curl http://your-server:8080/health`

### "Connection failed":
- Ensure both devices can reach the signal server
- Check network connectivity
- Try local network first, then cross-network

### "Transfer stuck":
- WebRTC connection may not be established
- Check NAT/firewall settings
- Try on same network first

## 📱 Next Steps

Once basic setup works:

1. **Configure automatic startup**
2. **Set up multiple signal servers for redundancy**
3. **Deploy to cloud for 24/7 availability**
4. **Create desktop shortcuts/dock icons**
5. **Set up automatic updates**

## 🆘 Support

If you encounter issues:

1. Check the server health: `http://your-server:8080/health`
2. View server logs: `pm2 logs sinckapp-signal`
3. Check client console for errors
4. Verify network connectivity between devices