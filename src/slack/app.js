#!/usr/bin/env node

import pkg from '@slack/bolt';
const { App } = pkg;
import OpenAI from 'openai';
import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';

// Load environment
dotenv.config();

// Import our modules
import { createOAuthHandler } from '../auth/oauth.js';
import { isUserAuthenticated } from '../auth/tokens.js';
import { createPartnerConnectAPI } from '../integrations/partnerconnect.js';
import { getMCPClient } from '../integrations/mcp-client.js';

// Import command handlers
import { handleBalanceCommand, parseBalanceArgs } from '../commands/fast/balance.js';
import { handleAnalyzeCommand, parseAnalyzeArgs } from '../commands/smart/analyze.js';

// Initialize services
const oauthHandler = createOAuthHandler();
const partnerConnectAPI = createPartnerConnectAPI();
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Hybrid PartnerConnect Slack Bot
 * Combines fast direct API calls with smart MCP + LLM analysis
 */

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000
});

// Command router - determines fast vs smart execution
function shouldUseMCP(messageText) {
  const smartKeywords = [
    'analyze', 'analysis', 'recommend', 'strategy', 'insights',
    'trends', 'patterns', 'help me', 'advice', 'what should',
    'deep dive', 'intelligence', 'smart'
  ];

  return smartKeywords.some(keyword =>
    messageText.toLowerCase().includes(keyword)
  );
}

// Authentication middleware
async function requireAuth(slackUserId, say) {
  try {
    const isAuthenticated = await isUserAuthenticated(slackUserId);

    if (!isAuthenticated) {
      const authUrl = oauthHandler.getAuthorizationUrl(slackUserId);

      await say({
        text: "🔒 Please connect your PartnerConnect account",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "🔒 *Authentication Required*\n\nYou need to connect your PartnerConnect account to access financial data."
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Connect PartnerConnect" },
                url: authUrl,
                style: "primary"
              }
            ]
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "This will open PartnerConnect login in your browser. After authentication, try your command again."
              }
            ]
          }
        ]
      });

      return null;
    }

    // Get valid token
    return await oauthHandler.getValidToken(slackUserId);

  } catch (error) {
    console.error('Authentication error:', error);

    if (error.message === 'TOKEN_EXPIRED') {
      const authUrl = oauthHandler.getAuthorizationUrl(slackUserId);

      await say({
        text: "🔒 Your session has expired",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "🔒 *Session Expired*\n\nYour PartnerConnect session has expired. Please re-authenticate to continue."
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Re-authenticate" },
                url: authUrl,
                style: "primary"
              }
            ]
          }
        ]
      });
    } else {
      await say({
        text: "❌ Authentication error",
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `❌ *Authentication Error*\n\n${error.message}\n\nPlease try reconnecting your account.`
          }
        }]
      });
    }

    return null;
  }
}

// Main message handler for @partnerconnect mentions
app.message(/@partnerconnect/i, async ({ message, say, logger }) => {
  try {
    const userId = message.user;
    const messageText = message.text.replace(/<@[^>]+>/g, '').trim();

    logger.info(`PartnerConnect command from ${userId}: ${messageText}`);

    // Check authentication
    const userToken = await requireAuth(userId, say);
    if (!userToken) {
      return; // Auth flow handled by requireAuth
    }

    // Determine command type and route accordingly
    const useMCP = shouldUseMCP(messageText);

    if (useMCP) {
      // Smart command - use MCP + LLM
      await handleSmartCommand(messageText, userToken, say, logger);
    } else {
      // Fast command - use direct API
      await handleFastCommand(messageText, userToken, say, logger);
    }

  } catch (error) {
    logger.error('Message handler error:', error);

    await say({
      text: "❌ Something went wrong",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❌ *Error Processing Command*\n\n${error.message}\n\nPlease try again or contact support.`
        }
      }]
    });
  }
});

// Fast command handler
async function handleFastCommand(messageText, userToken, say, logger) {
  logger.info('Processing fast command');

  let response;

  if (messageText.includes('balance') || messageText.includes('outstanding')) {
    const args = parseBalanceArgs(messageText);
    response = await handleBalanceCommand(partnerConnectAPI, userToken, args);
  }
  else if (messageText.includes('overdue')) {
    // TODO: Implement overdue command
    response = {
      text: "Overdue bills analysis coming soon!",
      blocks: [{
        type: "section",
        text: { type: "mrkdwn", text: "🚧 Overdue bills analysis is coming soon!" }
      }]
    };
  }
  else if (messageText.includes('client')) {
    // TODO: Implement client lookup
    response = {
      text: "Client lookup coming soon!",
      blocks: [{
        type: "section",
        text: { type: "mrkdwn", text: "🚧 Client lookup is coming soon!" }
      }]
    };
  }
  else {
    // Unknown fast command
    response = {
      text: "Command not recognized",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❓ *Command not recognized*\n\nTry:\n• \`@partnerconnect balance\` - Outstanding balance\n• \`@partnerconnect overdue\` - Overdue bills\n• \`@partnerconnect analyze\` - AI analysis`
        }
      }]
    };
  }

  await say(response);
}

// Smart command handler
async function handleSmartCommand(messageText, userToken, say, logger) {
  logger.info('Processing smart command with MCP + LLM');

  try {
    // Show thinking indicator
    const thinkingResponse = await say({
      text: "🤖 Analyzing...",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🤖 *Analyzing your financial data...*\n\nThis may take a few seconds while I gather insights."
        }
      }]
    });

    // Get MCP client
    const mcpClient = await getMCPClient();

    let response;

    if (messageText.includes('analyze') || messageText.includes('analysis')) {
      const args = parseAnalyzeArgs(messageText);
      response = await handleAnalyzeCommand(mcpClient, openaiClient, userToken, args);
    }
    else {
      // Generic smart command
      const args = { type: 'general' };
      response = await handleAnalyzeCommand(mcpClient, openaiClient, userToken, args);
    }

    // Update the thinking message with results
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: thinkingResponse.channel,
      ts: thinkingResponse.ts,
      text: response.text,
      blocks: response.blocks
    });

  } catch (error) {
    logger.error('Smart command error:', error);

    await say({
      text: "❌ Analysis failed",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❌ *Analysis Failed*\n\n${error.message}\n\nFalling back to basic commands might work better.`
        }
      }]
    });
  }
}

// Help command
app.message(/^help$/i, async ({ say }) => {
  await say({
    text: "PartnerConnect Bot Help",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🤖 PartnerConnect Bot Commands" }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Fast Commands* ⚡\n• `@partnerconnect balance` - Outstanding balance summary\n• `@partnerconnect overdue` - Overdue bills analysis\n• `@partnerconnect client [name]` - Client information"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Smart Analysis* 🧠\n• `@partnerconnect analyze collections` - AI collections strategy\n• `@partnerconnect analyze risk` - Risk assessment\n• `@partnerconnect recommend actions` - Strategic recommendations"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Authentication* 🔒\n• `@partnerconnect logout` - Disconnect account\n• `@partnerconnect status` - Check connection"
        }
      }
    ]
  });
});

// Logout command
app.message(/@partnerconnect.*logout/i, async ({ message, say }) => {
  try {
    await oauthHandler.revokeToken(message.user);
    await say({
      text: "✅ Logged out successfully",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *Logged Out*\n\nYour PartnerConnect account has been disconnected. Use `@partnerconnect balance` to reconnect when needed."
        }
      }]
    });
  } catch (error) {
    await say("❌ Logout failed: " + error.message);
  }
});

// Status command
app.message(/@partnerconnect.*status/i, async ({ message, say }) => {
  try {
    const isAuth = await isUserAuthenticated(message.user);
    const apiHealth = await partnerConnectAPI.healthCheck();

    await say({
      text: "Bot Status",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🤖 *PartnerConnect Bot Status*\n\n• Authentication: ${isAuth ? '✅ Connected' : '❌ Not connected'}\n• API Health: ${apiHealth ? '✅ Healthy' : '❌ Issues detected'}\n• MCP Service: 🔄 Checking...`
        }
      }]
    });
  } catch (error) {
    await say("❌ Status check failed: " + error.message);
  }
});

// Error handler
app.error((error) => {
  console.error('Slack app error:', error);
});

// Create Express server for OAuth callbacks and health checks
const expressApp = express();
expressApp.use(express.json());

// Health check endpoint
expressApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    slackConnected: app.client ? true : false
  });
});

// OAuth routes
expressApp.get('/auth/login', async (req, res) => {
  try {
    const { state } = req.query;
    if (!state) {
      return res.status(400).send('Missing state parameter');
    }

    const authUrl = oauthHandler.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth login error:', error);
    res.status(500).send('Authentication error');
  }
});

expressApp.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing required parameters');
    }

    await oauthHandler.exchangeCodeForToken(code, state);

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>✅ Authentication Successful!</h2>
          <p>You can now close this window and return to Slack.</p>
          <p>Try running <code>@partnerconnect balance</code> in Slack.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>❌ Authentication Failed</h2>
          <p>Please try again from Slack.</p>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// PhantomBuster webhook forwarding proxy
// Forwards PhantomBuster completion webhooks to local development backend
expressApp.post('/webhooks/phantombuster/:container_id', async (req, res) => {
  try {
    const { container_id } = req.params;
    const LOCAL_BACKEND_URL = process.env.LOCAL_BACKEND_URL;

    // Validate configuration
    if (!LOCAL_BACKEND_URL) {
      console.error('❌ PhantomBuster webhook proxy not configured - LOCAL_BACKEND_URL missing');
      return res.status(503).json({
        error: 'Proxy not configured',
        detail: 'LOCAL_BACKEND_URL environment variable not set'
      });
    }

    console.log(`📨 PhantomBuster webhook received - Container: ${container_id}`);
    console.log(`   Event: ${req.body?.event || 'unknown'}, Status: ${req.body?.status || 'unknown'}`);

    // Forward webhook to local backend via ngrok tunnel
    const forwardUrl = `${LOCAL_BACKEND_URL}/api/v1/webhooks/phantombuster/${container_id}`;

    const response = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PhantomBuster-Signature': req.headers['x-phantombuster-signature'] || '',
        'X-Forwarded-By': 'render-webhook-proxy',
        'X-Forwarded-For': req.ip || 'unknown'
      },
      body: JSON.stringify(req.body),
      timeout: 30000 // 30 second timeout
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    console.log(`✅ Webhook forwarded - Container: ${container_id}, Status: ${response.status}`);

    res.status(200).json({
      status: 'forwarded',
      container_id,
      local_backend_status: response.status,
      local_backend_response: responseData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ PhantomBuster webhook forward failed:', error.message);

    res.status(502).json({
      error: 'Failed to forward webhook to local backend',
      container_id: req.params.container_id,
      detail: error.message,
      backend_url: process.env.LOCAL_BACKEND_URL || 'NOT_CONFIGURED'
    });
  }
});

// Start the app
(async () => {
  try {
    // Start Slack bot
    await app.start();

    // Start Express server
    const port = process.env.PORT || 3000;
    expressApp.listen(port, () => {
      console.log('🤖 PartnerConnect Slack Bot is running!');
      console.log(`🌐 Express server running on port ${port}`);
      console.log('\nBot Features:');
      console.log('⚡ Fast Commands: Direct API for immediate responses');
      console.log('🧠 Smart Analysis: MCP + AI for strategic insights');
      console.log('🔒 OAuth Security: Per-user authentication');
      console.log('📡 Webhook Proxy: PhantomBuster → Local Backend');
      console.log('\nEndpoints:');
      console.log(`📍 Health Check: http://localhost:${port}/health`);
      console.log(`🔐 OAuth Login: http://localhost:${port}/auth/login?state=USER_ID`);
      console.log(`↩️  OAuth Callback: http://localhost:${port}/auth/callback`);
      console.log(`🪝 PhantomBuster Webhook: http://localhost:${port}/webhooks/phantombuster/:container_id`);
      if (process.env.LOCAL_BACKEND_URL) {
        console.log(`   → Forwarding to: ${process.env.LOCAL_BACKEND_URL}`);
      } else {
        console.log(`   ⚠️  LOCAL_BACKEND_URL not configured (webhooks will fail)`);
      }
      console.log('\nTry: @partnerconnect balance');
      console.log('Or:  @partnerconnect analyze collections');
    });
  } catch (error) {
    console.error('Failed to start Slack bot:', error);
    process.exit(1);
  }
})();