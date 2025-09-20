const WebSocket = require('ws');
const http = require('http');
const url = require('url');

class SignalServer {
  constructor(port = 8080) {
    this.port = port;
    this.peers = new Map();
    this.server = null;
    this.wss = null;
  }

  start() {
    // Create HTTP server for health checks
    this.server = http.createServer((req, res) => {
      const pathname = url.parse(req.url).pathname;
      
      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          connectedPeers: this.peers.size,
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

  // Cleanup disconnected peers periodically
  startCleanup() {
    setInterval(() => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      for (const [peerId, peer] of this.peers.entries()) {
        if (peer.lastSeen < fiveMinutesAgo || peer.ws.readyState !== WebSocket.OPEN) {
          this.peers.delete(peerId);
          console.log(`Cleaned up stale peer: ${peer.name}`);
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