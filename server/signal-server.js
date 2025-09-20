const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SignalServer {
  constructor(port = 8080) {
    this.port = port;
    this.peers = new Map();
    this.server = null;
    this.wss = null;
    this.uploadDir = path.join(__dirname, 'uploads');
    this.files = new Map(); // Track uploaded files: fileId -> {filename, path, uploadedBy, uploadedAt, expiresAt}
    
    // Create uploads directory
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  start() {
    // Create HTTP server for health checks and file transfers
    this.server = http.createServer((req, res) => {
      // Enable CORS for all requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-File-Name, X-File-Size');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      const pathname = url.parse(req.url).pathname;
      
      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          connectedPeers: this.peers.size,
          uploadedFiles: this.files.size,
          uptime: process.uptime()
        }));
      } else if (pathname === '/peers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          peers: Array.from(this.peers.values()).map(peer => ({
            id: peer.id,
            name: peer.name,
            ip: peer.ip,
            connectedAt: peer.connectedAt
          }))
        }));
      } else if (pathname === '/upload' && req.method === 'POST') {
        this.handleFileUpload(req, res);
      } else if (pathname.startsWith('/download/') && req.method === 'GET') {
        this.handleFileDownload(req, res, pathname);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      console.log('New client connected from:', req.socket.remoteAddress);
      this.handleConnection(ws, req);
    });

    this.server.listen(this.port, () => {
      console.log(`Signal server listening on port ${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
      console.log(`Peer list: http://localhost:${this.port}/peers`);
    });
  }

  handleConnection(ws, req) {
    let peer = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message, ws, req);
        
        // Update peer info if it's an announcement
        if (message.type === 'peer-announce' || message.type === 'introduce') {
          peer = {
            id: message.deviceId,
            name: message.deviceName || `Device-${message.deviceId?.substring(0, 8)}`,
            ip: req.socket.remoteAddress,
            port: message.port || 8080,
            ws: ws,
            connectedAt: new Date(),
            lastSeen: new Date()
          };
          
          this.peers.set(message.deviceId, peer);
          console.log(`Peer registered: ${peer.name} (${peer.id})`);
          
          // Send current peer list to new peer
          this.sendPeerList(ws);
          
          // Announce new peer to others
          this.broadcastToOthers(message, ws);
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      if (peer) {
        this.peers.delete(peer.id);
        console.log(`Peer disconnected: ${peer.name} (${peer.id})`);
        
        // Notify others about disconnection
        this.broadcastToOthers({
          type: 'peer-disconnect',
          deviceId: peer.id
        }, null);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  handleMessage(message, senderWs, req) {
    console.log(`Received message type: ${message.type} from peer`);
    
    switch (message.type) {
      case 'peer-announce':
      case 'introduce':
        // Already handled in connection handler
        break;
        
      case 'peer-list-request':
        this.sendPeerList(senderWs);
        break;
        
      case 'peer-message':
        console.log(`Forwarding peer-message from ${message.from} to ${message.to}`);
        this.forwardToTarget(message, senderWs);
        break;
        
      case 'peer-data':
        console.log(`Forwarding peer-data from ${message.from} to ${message.to} (${message.data ? message.data.length : 0} chars)`);
        this.forwardToTarget(message, senderWs);
        break;
        
      case 'webrtc-offer':
        console.log(`🚀 Forwarding WebRTC offer from ${message.from || 'unknown'} to ${message.to || 'unknown'}`);
        this.forwardToTarget(message, senderWs);
        break;
        
      case 'webrtc-answer':
        console.log(`🚀 Forwarding WebRTC answer from ${message.from || 'unknown'} to ${message.to || 'unknown'}`);
        this.forwardToTarget(message, senderWs);
        break;
        
      case 'webrtc-ice-candidate':
        console.log(`🚀 Forwarding WebRTC ICE candidate from ${message.from || 'unknown'} to ${message.to || 'unknown'}`);
        this.forwardToTarget(message, senderWs);
        break;
        
      case 'offer':
      case 'answer':
      case 'ice-candidate':
      case 'peer-connection-request':
        this.forwardToTarget(message, senderWs);
        break;
        
      default:
        console.log(`Unknown message type: ${message.type}, broadcasting to all peers`);
        // Forward unknown messages to all peers
        this.broadcastToOthers(message, senderWs);
    }
  }

  sendPeerList(ws) {
    const peerList = Array.from(this.peers.values()).map(peer => ({
      type: 'peer-announce',
      deviceId: peer.id,
      deviceName: peer.name,
      ip: peer.ip,
      port: peer.port,
      timestamp: peer.lastSeen.getTime()
    }));

    const message = {
      type: 'peer-list',
      peers: peerList
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  forwardToTarget(message, senderWs) {
    if (message.to) {
      const targetPeer = this.peers.get(message.to);
      if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
        targetPeer.ws.send(JSON.stringify(message));
        console.log(`✅ Message forwarded to ${targetPeer.name} (${message.to})`);
      } else {
        console.log(`❌ Target peer ${message.to} not found or not connected`);
      }
    } else {
      console.log(`📡 Broadcasting message to all peers (no specific target)`);
      // If no specific target, broadcast to all except sender
      this.broadcastToOthers(message, senderWs);
    }
  }

  broadcastToOthers(message, excludeWs) {
    this.peers.forEach((peer) => {
      if (peer.ws !== excludeWs && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify(message));
      }
    });
  }

  // Handle file upload
  handleFileUpload(req, res) {
    const fileName = req.headers['x-file-name'] || 'unknown';
    const fileSize = parseInt(req.headers['x-file-size']) || 0;
    const uploaderId = req.headers['x-uploader-id'] || 'unknown';
    
    console.log(`📤 Starting upload: ${fileName} (${fileSize} bytes) from ${uploaderId}`);
    
    // Generate unique file ID
    const fileId = crypto.randomBytes(16).toString('hex');
    const filePath = path.join(this.uploadDir, `${fileId}_${fileName}`);
    
    // Create write stream
    const writeStream = fs.createWriteStream(filePath);
    let uploadedBytes = 0;
    
    req.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      writeStream.write(chunk);
    });
    
    req.on('end', () => {
      writeStream.end();
      
      // Store file metadata
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      this.files.set(fileId, {
        filename: fileName,
        path: filePath,
        size: uploadedBytes,
        uploadedBy: uploaderId,
        uploadedAt: new Date(),
        expiresAt: expiresAt
      });
      
      console.log(`✅ Upload complete: ${fileName} (${uploadedBytes}/${fileSize} bytes) - ID: ${fileId}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        fileId: fileId,
        filename: fileName,
        size: uploadedBytes,
        expiresAt: expiresAt.toISOString()
      }));
    });
    
    req.on('error', (error) => {
      console.error('Upload error:', error);
      writeStream.destroy();
      fs.unlink(filePath, () => {}); // Clean up partial file
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Upload failed'
      }));
    });
  }
  
  // Handle file download
  handleFileDownload(req, res, pathname) {
    const fileId = pathname.split('/')[2]; // /download/{fileId}
    const fileInfo = this.files.get(fileId);
    
    if (!fileInfo) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }
    
    // Check if file expired
    if (new Date() > fileInfo.expiresAt) {
      this.files.delete(fileId);
      fs.unlink(fileInfo.path, () => {});
      
      res.writeHead(410, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File expired' }));
      return;
    }
    
    console.log(`📥 Starting download: ${fileInfo.filename} (${fileInfo.size} bytes) - ID: ${fileId}`);
    
    // Stream file to client
    const readStream = fs.createReadStream(fileInfo.path);
    
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileInfo.filename}"`,
      'Content-Length': fileInfo.size
    });
    
    readStream.pipe(res);
    
    readStream.on('end', () => {
      console.log(`✅ Download complete: ${fileInfo.filename}`);
      
      // Delete file after download
      this.files.delete(fileId);
      fs.unlink(fileInfo.path, () => {});
    });
    
    readStream.on('error', (error) => {
      console.error('Download error:', error);
      res.writeHead(500);
      res.end('Download failed');
    });
  }

  // Cleanup disconnected peers and expired files periodically
  startCleanup() {
    setInterval(() => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      // Clean up stale peers
      for (const [peerId, peer] of this.peers.entries()) {
        if (peer.lastSeen < fiveMinutesAgo || peer.ws.readyState !== WebSocket.OPEN) {
          this.peers.delete(peerId);
          console.log(`Cleaned up stale peer: ${peer.name}`);
        }
      }
      
      // Clean up expired files
      for (const [fileId, fileInfo] of this.files.entries()) {
        if (now > fileInfo.expiresAt) {
          this.files.delete(fileId);
          fs.unlink(fileInfo.path, () => {});
          console.log(`Cleaned up expired file: ${fileInfo.filename}`);
        }
      }
    }, 60000); // Every minute
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

// Start server if run directly
if (require.main === module) {
  const port = process.env.PORT || 8080;
  const server = new SignalServer(port);
  
  server.start();
  server.startCleanup();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down signal server...');
    server.stop();
    process.exit(0);
  });
}

module.exports = SignalServer;