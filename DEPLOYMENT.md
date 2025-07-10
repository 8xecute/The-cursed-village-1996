# Render Deployment Guide

## 🚀 Optimized Deployment for Render

This guide provides step-by-step instructions for deploying the Salem game to Render with performance optimizations.

## 📋 Prerequisites

- Node.js 18+ installed
- Git repository with the game code
- Render account (free tier available)

## 🔧 Pre-Deployment Setup

### 1. Environment Variables

Set these environment variables in your Render dashboard:

```bash
NODE_ENV=production
PORT=10000
ALLOWED_ORIGINS=https://your-app-name.onrender.com
```

### 2. Build Configuration

The project uses optimized build scripts:

```bash
# Install dependencies and build for production
npm install
npm run build:render
```

## 🏗️ Render Configuration

### Option 1: Using render.yaml (Recommended)

The project includes a `render.yaml` file for automatic deployment:

```yaml
services:
  - type: web
    name: salem-game
    env: node
    plan: starter
    buildCommand: npm install && npm run build:render
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

### Option 2: Manual Configuration

1. **Create New Web Service**
   - Service Type: Web Service
   - Environment: Node
   - Plan: Starter (Free)

2. **Build & Deploy Settings**
   - Build Command: `npm install && npm run build:render`
   - Start Command: `npm start`
   - Health Check Path: `/health`

3. **Environment Variables**
   - `NODE_ENV`: `production`
   - `PORT`: `10000`

## ⚡ Performance Optimizations

### Server-Side Optimizations

1. **Compression & Caching**
   - Gzip compression enabled
   - Static file caching (1 year)
   - ETag support

2. **Security Headers**
   - Helmet.js for security headers
   - CORS configuration
   - Content Security Policy

3. **Memory Management**
   - Automatic memory monitoring
   - Graceful shutdown handling
   - Memory leak prevention

4. **Socket.IO Optimizations**
   - WebSocket transport priority
   - Optimized ping/pong intervals
   - Connection pooling

### Client-Side Optimizations

1. **Asset Optimization**
   - Image compression (PNG optimization)
   - Lazy loading for card images
   - Cache management

2. **JavaScript Performance**
   - Debounced event handlers
   - Memory-efficient state management
   - DOM element caching

3. **Bundle Optimization**
   - Code splitting
   - Tree shaking
   - Minification

## 📊 Monitoring & Health Checks

### Health Check Endpoint

The application provides a health check at `/health`:

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 50,
    "heapUsed": 30,
    "heapTotal": 40,
    "external": 5
  },
  "rooms": 2
}
```

### Performance Monitoring

- Memory usage logged every 5 minutes
- Automatic cleanup of old data
- Connection monitoring

## 🔍 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check Node.js version
   node --version
   
   # Clear npm cache
   npm cache clean --force
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Memory Issues**
   - Monitor memory usage in logs
   - Check for memory leaks in long-running games
   - Consider upgrading to paid plan for more resources

3. **Connection Issues**
   - Verify WebSocket connections
   - Check CORS settings
   - Ensure proper SSL configuration

### Log Analysis

```bash
# View application logs
render logs --service salem-game

# Monitor real-time logs
render logs --service salem-game --follow
```

## 🚀 Deployment Steps

### 1. Connect Repository

1. Connect your Git repository to Render
2. Select the main branch
3. Configure build settings

### 2. Environment Setup

1. Set environment variables in Render dashboard
2. Configure health check path: `/health`
3. Set build command: `npm install && npm run build:render`

### 3. Deploy

1. Trigger manual deployment or push to main branch
2. Monitor build logs for any issues
3. Verify health check passes

### 4. Post-Deployment

1. Test game functionality
2. Monitor performance metrics
3. Set up custom domain (optional)

## 📈 Performance Metrics

### Expected Performance

- **Cold Start**: < 30 seconds
- **Memory Usage**: < 100MB per instance
- **Response Time**: < 200ms for API calls
- **WebSocket Latency**: < 50ms

### Optimization Targets

- Bundle size: < 500KB
- Image optimization: 60-80% compression
- Cache hit rate: > 90%
- Memory usage: < 50MB idle

## 🔧 Advanced Configuration

### Custom Domain

1. Add custom domain in Render dashboard
2. Configure DNS records
3. Enable SSL certificate

### Scaling

For high-traffic scenarios:

1. **Horizontal Scaling**
   - Multiple instances
   - Load balancing
   - Session management

2. **Database Integration**
   - Redis for session storage
   - PostgreSQL for game state
   - MongoDB for analytics

### CDN Integration

For global performance:

1. Configure CDN (Cloudflare, AWS CloudFront)
2. Set up asset caching
3. Enable compression

## 📝 Maintenance

### Regular Tasks

1. **Weekly**
   - Monitor performance metrics
   - Check error logs
   - Update dependencies

2. **Monthly**
   - Review security updates
   - Analyze usage patterns
   - Optimize based on metrics

3. **Quarterly**
   - Major dependency updates
   - Performance review
   - Feature planning

## 🆘 Support

### Render Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Render Status](https://status.render.com)

### Application Support

- Check logs for error details
- Monitor health check endpoint
- Review performance metrics

---

**Happy Gaming! 🎮** 