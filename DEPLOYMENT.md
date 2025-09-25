# Render Deployment Guide

## Prerequisites

1. **Render Account**: https://render.com
2. **GitHub Repository**: Push this code to GitHub
3. **PartnerConnect OAuth Client**: Get client ID/secret from PartnerConnect admin

## Deployment Steps

### 1. Deploy to Render

1. **Connect GitHub**: Link your GitHub repository to Render
2. **Create Web Service**:
   - Service Type: Web Service
   - Environment: Docker
   - Region: Oregon (or closest to users)
   - Plan: Starter ($7/month)
   - Dockerfile Path: `./Dockerfile`
   - Health Check Path: `/health`

### 2. Configure Environment Variables

In Render dashboard, add these environment variables:

#### Slack Configuration
```
SLACK_BOT_TOKEN=xoxb-YOUR-BOT-TOKEN
SLACK_SIGNING_SECRET=YOUR-SIGNING-SECRET
SLACK_APP_TOKEN=xapp-YOUR-APP-TOKEN
```

#### PartnerConnect Configuration
```
PARTNERCONNECT_API_URL=https://prod-v3.fortiumpartners.io/v3
PARTNERCONNECT_CLIENT_ID=YOUR-CLIENT-ID
PARTNERCONNECT_CLIENT_SECRET=YOUR-CLIENT-SECRET
PARTNERCONNECT_TOKEN_ENDPOINT=https://prod-fs-fortiumpartners.us.auth0.com/oauth/token
PARTNERCONNECT_AUDIENCE=https://prod-v3.fortiumpartners.io
```

#### OAuth Configuration (Update after deployment)
```
OAUTH_REDIRECT_URI=https://YOUR-APP-NAME.onrender.com/auth/callback
TOKEN_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### AI Configuration
```
OPENAI_API_KEY=sk-proj-YOUR-OPENAI-API-KEY
```

#### Server Configuration
```
NODE_ENV=production
PORT=3000
API_TIMEOUT=30000
MCP_TIMEOUT=30000
```

### 3. Deploy and Get URL

1. **Deploy**: Click "Create Web Service"
2. **Wait for build**: ~5-10 minutes
3. **Get URL**: Will be something like `https://partnerconnect-slack-bot-xyz.onrender.com`

### 4. Update OAuth Redirect URI

1. **Update Environment Variable**:
   - `OAUTH_REDIRECT_URI=https://YOUR-ACTUAL-URL.onrender.com/auth/callback`
2. **Redeploy**: Trigger new deployment with updated environment

### 5. Configure PartnerConnect OAuth

**Contact PartnerConnect Admin** to add your redirect URI:
- **Redirect URI**: `https://YOUR-ACTUAL-URL.onrender.com/auth/callback`
- **Client ID**: (already configured)
- **Scopes**: `read:clients read:invoices read:bills read:engagements read:users`

## Testing

### 1. Health Check
```bash
curl https://YOUR-APP-URL.onrender.com/health
```
Should return:
```json
{"status":"healthy","timestamp":"2025-09-23T00:35:01.559Z","slackConnected":true}
```

### 2. Slack Bot
In Slack workspace:
```
@partnerconnect status
```
Should show authentication prompt.

### 3. OAuth Flow
1. Run `@partnerconnect balance`
2. Click "Connect PartnerConnect" button
3. Complete OAuth in browser
4. Return to Slack and retry command

## Production Considerations

### Scaling
- **Starter Plan**: Good for ~100 users
- **Professional Plan**: For larger teams
- **Redis**: Add for distributed token storage

### Monitoring
- **Render Logs**: Monitor authentication failures
- **Health Checks**: 30-second intervals
- **Alerts**: Set up for downtime/errors

### Security
- **Environment Variables**: Never commit secrets to git
- **HTTPS Only**: Render provides automatic SSL
- **Token Encryption**: All user tokens encrypted at rest

## Troubleshooting

### Common Issues

1. **Build Failed**: Check Dockerfile and dependencies
2. **Health Check Failed**: Verify `/health` endpoint responds
3. **Slack Not Connecting**: Check Socket Mode token
4. **OAuth Errors**: Verify redirect URI matches exactly
5. **API Errors**: Check PartnerConnect credentials

### Debug Commands
```bash
# Check logs
render logs --service-id=YOUR-SERVICE-ID

# Test locally with production env
docker build -t partnerconnect-bot .
docker run -p 3000:3000 --env-file .env.production partnerconnect-bot
```