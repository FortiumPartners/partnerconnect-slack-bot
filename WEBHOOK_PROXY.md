# PhantomBuster Webhook Proxy

**Feature**: Forward PhantomBuster job completion webhooks to local development backend

## Overview

This service acts as a webhook proxy for PhantomBuster scraping jobs. It receives webhook events from PhantomBuster (when scraping jobs complete) and forwards them to your local development backend via ngrok tunnel.

```
PhantomBuster → Render.com (this service) → Ngrok Tunnel → Local Backend (localhost:8000)
```

## Why This Exists

- **Testing webhooks locally**: PhantomBuster requires public HTTPS endpoint for webhooks
- **No full backend deployment**: Test webhook integration without deploying entire backend
- **Reuse existing infrastructure**: Leverages already-deployed partnerconnect-slack-bot service
- **Zero additional cost**: Uses existing Render.com starter plan ($7/month)

## Setup Instructions

### 1. Deploy to Render.com

This feature is already included in the partnerconnect-slack-bot service.

**Service**: https://partnerconnect-slack-bot.onrender.com
**Dashboard**: https://dashboard.render.com/web/srv-d3akcm95pdvs73cv5ang

### 2. Start Local Backend + Ngrok

```bash
# Terminal 1: Start local LinkedIn backend
cd /Users/burke/projects/linkedin-workspace
docker compose up api

# Verify backend is running
curl http://localhost:8000/health

# Terminal 2: Start ngrok tunnel
ngrok http 8000

# Copy the forwarding URL
# Example: https://abc123-456-789.ngrok.io
```

### 3. Configure Render Environment

1. Go to Render Dashboard: https://dashboard.render.com/web/srv-d3akcm95pdvs73cv5ang
2. Click "Environment" tab
3. Add/Update variable:
   - **Key**: `LOCAL_BACKEND_URL`
   - **Value**: `https://abc123-456-789.ngrok.io` (your ngrok URL)
4. Click "Save Changes" (triggers automatic redeploy)
5. Wait ~30 seconds for redeploy to complete

### 4. Configure PhantomBuster Webhook

1. Go to PhantomBuster Dashboard: https://phantombuster.com
2. Navigate to your LinkedIn Profile Scraper agent
3. Find "Webhooks" or "Notifications" section
4. Set webhook URL:
   ```
   https://partnerconnect-slack-bot.onrender.com/webhooks/phantombuster/{{containerId}}
   ```
   *Note: `{{containerId}}` is a PhantomBuster variable that gets auto-replaced*
5. Select events to trigger:
   - ✅ `agent.completed`
   - ✅ `agent.failed`
6. Save webhook configuration

### 5. Test Complete Flow

```bash
# Trigger PhantomBuster scrape from local backend
curl -X POST http://localhost:8000/api/v1/profiles/ingest \
  -H "X-API-Key: li_HieZz-IjBp0uE7d-rZkRE0qyy12r5_ZJS_FR4jMvv0I" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedin_url": "https://linkedin.com/in/williamhgates",
    "suggested_role": "Technology Executive"
  }'

# Expected flow (2-5 minutes):
# 1. Local backend launches PhantomBuster job
# 2. PhantomBuster scrapes profile
# 3. PhantomBuster sends webhook to Render proxy
# 4. Render proxy forwards to ngrok tunnel
# 5. Local backend receives webhook and processes data
```

## Monitoring

### Check Proxy Health

```bash
# Health check
curl https://partnerconnect-slack-bot.onrender.com/health | jq

# Should return:
{
  "status": "healthy",
  "timestamp": "2025-11-11T...",
  "slackConnected": true
}
```

### View Logs

**Render.com Logs** (proxy):
- Go to: https://dashboard.render.com/web/srv-d3akcm95pdvs73cv5ang
- Click "Logs" tab
- Look for:
  ```
  📨 PhantomBuster webhook received - Container: abc123
  ✅ Webhook forwarded - Container: abc123, Status: 200
  ```

**Ngrok Inspector** (tunnel):
```bash
# Open ngrok web interface
open http://localhost:4040

# View all requests forwarded through tunnel
```

**Local Backend Logs**:
```bash
# Docker logs
docker logs linkedin-api -f

# Look for webhook processing logs
```

## Endpoints

### Webhook Forwarding
```
POST /webhooks/phantombuster/:container_id
```

**Request Headers**:
- `X-PhantomBuster-Signature`: Optional signature from PhantomBuster
- `Content-Type: application/json`

**Request Body** (example):
```json
{
  "event": "agent.completed",
  "containerId": "8576d64f-1636-4981-b3cf-41f8d3f8a...",
  "agentId": "108079279738520",
  "status": "success",
  "launchedAt": "2025-11-11T10:30:00Z",
  "completedAt": "2025-11-11T10:35:23Z"
}
```

**Response** (success):
```json
{
  "status": "forwarded",
  "container_id": "8576d64f...",
  "local_backend_status": 200,
  "local_backend_response": { ... },
  "timestamp": "2025-11-11T10:35:24.123Z"
}
```

**Response** (not configured):
```json
{
  "error": "Proxy not configured",
  "detail": "LOCAL_BACKEND_URL environment variable not set"
}
```

### Health Check
```
GET /health
```

Returns service health status.

## Troubleshooting

### Webhook Not Arriving at Local Backend

**Check 1: Ngrok tunnel is running**
```bash
curl https://YOUR_NGROK_URL/health
```

**Check 2: Render proxy is configured**
```bash
curl https://partnerconnect-slack-bot.onrender.com/health
```

**Check 3: Local backend is running**
```bash
curl http://localhost:8000/health
```

**Check 4: View Render logs**
- Look for "PhantomBuster webhook received" messages
- Check for forwarding errors

### Ngrok Tunnel Disconnects

**Problem**: Ngrok free tier disconnects after 2 hours

**Solutions**:
- Restart ngrok: `ngrok http 8000`
- Update `LOCAL_BACKEND_URL` in Render dashboard with new ngrok URL
- Consider ngrok paid plan for longer sessions

### Render Service Not Responding

**Problem**: Render starter plan should NOT sleep, but check status

**Solution**:
```bash
# Check service status
curl https://partnerconnect-slack-bot.onrender.com/health

# If 503 error, wait 30 seconds for wakeup
# Starter plan has fast wake-up times
```

### Webhook Delivery Delays

**Expected Latency**:
- PhantomBuster → Render: ~100ms
- Render → Ngrok → Local: ~100-200ms
- **Total**: <500ms from webhook send to local backend receipt

**If seeing delays >1 second**:
- Check ngrok tunnel stability
- Check local backend responsiveness
- Review Render logs for errors

## Cost

- **Render.com**: $7/month (Starter plan - already paying for Slack bot)
- **Ngrok**: FREE (2-hour sessions, 1 tunnel)
- **Total Additional Cost**: $0 (reusing existing service)

## Security Notes

- ✅ PhantomBuster signature forwarded to local backend for verification
- ✅ Local backend isolated behind ngrok (not directly exposed)
- ⚠️ Ngrok tunnel exposes local backend temporarily
- ⚠️ Use only for development/testing, not production

## Migration to Production

When ready to deploy full backend to Railway:

1. Deploy full backend to Railway (gets public HTTPS URL)
2. Update PhantomBuster webhook to point directly to Railway:
   ```
   https://linkedin-backend-production.up.railway.app/api/v1/webhooks/phantombuster/{{containerId}}
   ```
3. Remove `LOCAL_BACKEND_URL` from Render environment
4. Webhook proxy route remains dormant (no calls)

## Files Changed

- `src/slack/app.js`: Added webhook forwarding route (lines 434-496)
- `.env.example`: Added `LOCAL_BACKEND_URL` documentation

## Technical Details

**Implementation**: ~70 lines of code added to existing Express server

**Features**:
- Webhook signature forwarding (for local backend verification)
- Request/response logging
- Error handling with detailed error messages
- Configuration validation
- Startup logs show forwarding target

**Performance**:
- Minimal latency overhead (~100-200ms)
- Async request forwarding (non-blocking)
- 30-second timeout for backend requests

## Support

For issues or questions:
1. Check Render logs first
2. Verify ngrok tunnel is active
3. Test each component independently
4. Review troubleshooting section above
