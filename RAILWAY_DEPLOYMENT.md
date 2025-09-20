# 🚀 Deploy SinckApp Signal Server to Railway.app

## Step 1: Prepare Your GitHub Repository

### Option A: Create New Repository
1. Go to [GitHub.com](https://github.com)
2. Click "New repository"
3. Name it `sinckapp-signal-server`
4. Make it public (required for Railway free tier)
5. Clone it locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sinckapp-signal-server.git
   cd sinckapp-signal-server
   ```

### Option B: Use Existing Repository
1. Initialize git in your sinckapp folder:
   ```bash
   cd /Users/joseyapor/sinckapp
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create repository on GitHub and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/sinckapp.git
   git branch -M main
   git push -u origin main
   ```

## Step 2: Deploy to Railway

### 1. Create Railway Account
- Go to [Railway.app](https://railway.app)
- Sign up with your GitHub account
- Verify your account

### 2. Deploy from GitHub

**Method 1: Deploy Entire Repository**
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `sinckapp` repository
4. Railway will detect the Node.js project

**Method 2: Deploy Only Server Folder**
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. In build settings, set:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3. Configure Environment Variables
Railway automatically sets:
- `PORT` (Railway provides this)
- `NODE_ENV=production`

No additional configuration needed!

### 4. Get Your Public URL
After deployment:
1. Go to your Railway dashboard
2. Click on your deployed service
3. In the "Settings" tab, find "Domains"
4. Copy the provided URL (e.g., `https://sinckapp-signal-production.up.railway.app`)

## Step 3: Test Your Deployment

### 1. Health Check
Open in browser: `https://your-railway-url.up.railway.app/health`

Should return:
```json
{
  "status": "healthy",
  "connectedPeers": 0,
  "uptime": 123.45
}
```

### 2. Peer List
Check: `https://your-railway-url.up.railway.app/peers`

Should return:
```json
{
  "peers": []
}
```

## Step 4: Update Your Client Configuration

Edit `src/main/config/network-config.ts`:

```typescript
export const defaultNetworkConfig: NetworkConfig = {
  signalServers: [
    'ws://localhost:8080',                                    // Local network
    'wss://your-railway-url.up.railway.app'                  // Your Railway server
  ],
  // ... rest of config
};
```

**Important**: Use `wss://` (secure WebSocket) for Railway URLs!

## Step 5: Rebuild and Test

```bash
cd /Users/joseyapor/sinckapp
npm run build
npm start
```

Your app should now connect to your Railway signal server!

## 🔧 Advanced Configuration

### Custom Domain (Optional)
1. In Railway dashboard → Settings → Domains
2. Click "Custom Domain"
3. Add your domain (e.g., `signal.yourapp.com`)
4. Update DNS settings as instructed

### Environment Variables
Add in Railway dashboard → Variables:
```
NODE_ENV=production
MAX_PEERS=1000
CLEANUP_INTERVAL=60000
```

### Monitoring
- Railway provides built-in logs and metrics
- Access via dashboard → your service → "Observability"

## 🆘 Troubleshooting

### Deployment Failed
- Check build logs in Railway dashboard
- Ensure `package.json` has correct start script
- Verify Node.js version compatibility

### Can't Connect to Server
- Check if Railway service is running
- Verify URL is correct (`wss://` not `ws://`)
- Test health endpoint in browser

### Server Keeps Restarting
- Check application logs for errors
- Verify environment variables
- Ensure port binding is correct (`process.env.PORT`)

## 💰 Railway Free Tier Limits

- **$5 free credit monthly**
- **500 hours of usage** (enough for 24/7 operation)
- **100GB bandwidth**
- **1GB RAM, 1 vCPU**

Perfect for a signal server!

## 🔄 Automatic Updates

Railway automatically redeploys when you push to GitHub:

```bash
# Update your code
git add .
git commit -m "Update signal server"
git push

# Railway will automatically redeploy
```

## 📊 Monitor Your Server

### Railway Dashboard
- View real-time logs
- Monitor resource usage
- Check deployment history

### API Endpoints
- Health: `GET /health`
- Peers: `GET /peers`
- WebSocket: `wss://your-url`

## ✅ Complete Setup Checklist

- [ ] GitHub repository created
- [ ] Railway account created
- [ ] Service deployed to Railway
- [ ] Public URL obtained
- [ ] Client configuration updated
- [ ] Health check passes
- [ ] Client successfully connects
- [ ] File transfer tested between devices

## 🎉 Success!

Your SinckApp signal server is now running on Railway.app and accessible from anywhere in the world!