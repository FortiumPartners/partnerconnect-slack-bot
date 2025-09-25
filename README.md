# PartnerConnect Slack Bot 🤖

**Hybrid AI-powered Slack bot for PartnerConnect financial data with blazing-fast responses and strategic AI insights.**

## 🎯 Features

### ⚡ **Fast Commands** (< 1 second)
- `@partnerconnect balance` - Outstanding balance with aging analysis
- `@partnerconnect overdue` - Critical overdue invoices
- `@partnerconnect client [name]` - Client information lookup

### 🧠 **Smart Analysis** (3-5 seconds)
- `@partnerconnect analyze collections` - AI-powered collections strategy
- `@partnerconnect analyze risk` - Risk assessment and prioritization
- `@partnerconnect recommend actions` - Strategic business recommendations

### 🔒 **Security**
- **Individual OAuth authentication** - Each user authenticates with their own PartnerConnect account
- **Encrypted token storage** - All tokens encrypted at rest
- **Granular permissions** - Users only see data they have access to

## 🏗️ Architecture

```
Fast Commands:     Slack → Direct PartnerConnect API (< 1s)
Smart Commands:    Slack → MCP Server → OpenAI → Strategic Insights (3-5s)
```

**Best of both worlds**: Immediate data access + AI intelligence

## 🚀 Quick Start

### 1. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. **Install Dependencies**
```bash
npm install
```

### 3. **Start the Bot**
```bash
npm start
```

### 4. **Try Commands**
```
@partnerconnect balance
@partnerconnect analyze collections
```

## 🔧 Configuration

### **Required Environment Variables**

#### **Slack Configuration**
```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token          # Bot User OAuth Token
SLACK_SIGNING_SECRET=your-signing-secret      # Signing Secret
SLACK_APP_TOKEN=xapp-your-app-token          # App-Level Token (for Socket Mode)
```

#### **PartnerConnect Configuration**
```bash
PARTNERCONNECT_API_URL=https://prod-v3.fortiumpartners.io/v3
PARTNERCONNECT_CLIENT_ID=your-oauth-client-id
PARTNERCONNECT_CLIENT_SECRET=your-oauth-client-secret
PARTNERCONNECT_TOKEN_ENDPOINT=https://prod-fs-fortiumpartners.us.auth0.com/oauth/token
PARTNERCONNECT_AUDIENCE=https://prod-v3.fortiumpartners.io
```

#### **AI Configuration**
```bash
OPENAI_API_KEY=sk-your-openai-api-key        # For smart analysis
MCP_SERVER_PATH=/path/to/partnerconnect-mcp/build/index.js
```

### **Slack App Setup**

1. **Create Slack App** at https://api.slack.com/apps
2. **Enable Socket Mode** (for easier development)
3. **Add Bot Scopes**:
   - `chat:write`
   - `app_mentions:read`
   - `users:read`
4. **Install to Workspace**
5. **Copy tokens to `.env`**

### **OAuth Setup**

1. **Configure OAuth redirect URL** in PartnerConnect
2. **Set OAUTH_REDIRECT_URI** in environment
3. **Users authenticate via browser OAuth flow**

## 💬 Usage Examples

### **Fast Financial Data**
```
@partnerconnect balance
💰 Outstanding Balance: $1,063,218.99 (6,461 invoices)
📅 Current: $799K | 31-60: $61K | 61-90: $40K | 90+: $163K
🔝 Top: Puget Sound Energy $95K
🚨 URGENT: 5,980 invoices over 90 days overdue!
```

### **AI Strategic Analysis**
```
@partnerconnect analyze collections
🤖 Analyzing your financial data...

📊 AI Collections Analysis

Key Insights:
• 92% of overdue amount is 90+ days old - major red flag
• Foresite represents 25% of your risk ($191K across multiple invoices)
• Current invoices are healthy ($799K flowing normally)

Strategic Recommendations:
1. URGENT: Focus collection efforts on 90+ day bucket
2. Investigate Foresite: Multiple old invoices suggest systematic issue
3. Process Review: 92% aging suggests collection process needs tightening

[Deep Dive Analysis] [Draft Collection Emails] [Risk Report]
```

## 🔄 Development

### **Project Structure**
```
src/
├── auth/              # OAuth & token management
├── commands/
│   ├── fast/          # Direct API commands
│   └── smart/         # MCP + AI commands
├── integrations/      # API clients
├── slack/             # Slack app logic
└── utils/             # Formatting helpers
```

### **Adding New Commands**

#### **Fast Command** (Direct API)
```javascript
// src/commands/fast/my-command.js
export async function handleMyCommand(apiClient, userToken, args) {
  const data = await apiClient.get('/endpoint', userToken);
  return formatForSlack(data);
}
```

#### **Smart Command** (MCP + AI)
```javascript
// src/commands/smart/my-analysis.js
export async function handleMyAnalysis(mcpClient, openaiClient, userToken, args) {
  const data = await mcpClient.callTool('get_data', args);
  const insights = await analyzeWithLLM(openaiClient, data);
  return formatAnalysisForSlack(insights);
}
```

### **Testing**
```bash
npm test                    # Run tests
npm run dev                 # Development mode with auto-restart
```

## 🛠️ Production Deployment

### **Security Checklist**
- ✅ Use HTTPS for OAuth redirect URLs
- ✅ Store secrets in secure environment variables
- ✅ Use Redis for token storage (not in-memory)
- ✅ Enable rate limiting
- ✅ Monitor authentication failures

### **Scaling Considerations**
- **Redis** for distributed token storage
- **Load balancer** for multiple bot instances
- **MCP connection pooling** for high throughput
- **OpenAI rate limiting** for AI features

### **Monitoring**
- Authentication success/failure rates
- Command response times (fast vs smart)
- API error rates
- User adoption metrics

## 🆘 Troubleshooting

### **Authentication Issues**
```bash
# Check OAuth configuration
@partnerconnect status

# Re-authenticate user
@partnerconnect logout
@partnerconnect balance  # Triggers re-auth
```

### **Performance Issues**
- **Fast commands slow?** Check PartnerConnect API health
- **Smart commands timeout?** Check MCP server and OpenAI connectivity
- **Memory issues?** Switch to Redis token storage

### **Common Errors**
- `USER_NOT_AUTHENTICATED` → User needs to complete OAuth
- `TOKEN_EXPIRED` → Auto-refresh failed, user needs to re-auth
- `MCP_ERROR` → MCP server connection issues
- `API_SERVER_ERROR` → PartnerConnect API issues

## 📈 Roadmap

### **Phase 1: Core Features** ✅
- Fast balance and overdue commands
- Smart collections analysis
- OAuth authentication

### **Phase 2: Enhanced Intelligence**
- Predictive analytics
- Collection email drafting
- Risk scoring algorithms
- Custom reporting

### **Phase 3: Workflow Integration**
- Automated collection workflows
- Calendar integration for follow-ups
- Team collaboration features
- Mobile notifications

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for modern finance teams who want both speed and intelligence.**