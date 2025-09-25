import { OpenAI } from 'openai';

/**
 * Smart Analyze Command - MCP + LLM implementation
 * Provides strategic business insights using AI analysis
 */
export async function handleAnalyzeCommand(mcpClient, openaiClient, userToken, args = {}) {
  try {
    // Show thinking indicator
    const thinkingMessage = "🤖 Analyzing your financial data...";

    // Step 1: Get comprehensive data from MCP
    const mcpData = await gatherMCPData(mcpClient, userToken, args);

    // Step 2: Analyze with LLM
    const analysis = await analyzeWithLLM(openaiClient, mcpData, args);

    // Step 3: Format for Slack
    return formatAnalysisForSlack(analysis, mcpData);

  } catch (error) {
    console.error('Analyze command error:', error);

    if (error.message.includes('MCP_ERROR')) {
      return {
        text: "❌ Error accessing financial data",
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: "❌ *Unable to access financial data*\n\nPlease check your PartnerConnect connection and try again."
          }
        }]
      };
    }

    return {
      text: "❌ Analysis failed",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❌ *Analysis Error*\n\n${error.message}`
        }
      }]
    };
  }
}

/**
 * Gather comprehensive data from MCP server
 */
async function gatherMCPData(mcpClient, userToken, args) {
  try {
    const data = {};

    // Get outstanding balance analysis
    data.outstandingBalance = await mcpClient.callTool('get_outstanding_balance', {
      userId: userToken, // MCP will resolve user context
      includeDetails: true
    });

    // Get recent engagements for context
    data.engagements = await mcpClient.callTool('query_engagements', {
      Active: true,
      limit: 20
    });

    // Get client information
    data.clients = await mcpClient.callTool('query_clients', {
      limit: 50
    });

    // If specific analysis requested, get targeted data
    if (args.clientName) {
      data.clientSpecific = await mcpClient.callTool('query_clients', {
        search: args.clientName,
        limit: 10
      });
    }

    return data;

  } catch (error) {
    console.error('MCP data gathering error:', error);
    throw new Error('MCP_ERROR: ' + error.message);
  }
}

/**
 * Analyze data using OpenAI
 */
async function analyzeWithLLM(openaiClient, mcpData, args) {
  try {
    const analysisType = args.type || 'collections';

    const systemPrompt = `You are a financial business analyst specializing in accounts receivable and collections strategy.

    Analyze the provided PartnerConnect financial data and provide actionable business insights.

    Focus areas:
    - Risk assessment and prioritization
    - Collection strategy recommendations
    - Process improvement opportunities
    - Client relationship insights
    - Cash flow optimization

    Always provide:
    1. Key findings (3-5 bullet points)
    2. Risk priorities (what needs immediate attention)
    3. Strategic recommendations (actionable next steps)
    4. Optional follow-up questions

    Keep insights business-focused and actionable for finance teams.`;

    let userPrompt = `Analyze this PartnerConnect financial data for ${analysisType} insights:\n\n`;

    // Add outstanding balance data
    if (mcpData.outstandingBalance) {
      userPrompt += `OUTSTANDING BALANCE DATA:\n${mcpData.outstandingBalance}\n\n`;
    }

    // Add engagement context
    if (mcpData.engagements) {
      userPrompt += `RECENT ENGAGEMENTS CONTEXT:\n${mcpData.engagements}\n\n`;
    }

    // Add client-specific data if available
    if (mcpData.clientSpecific) {
      userPrompt += `CLIENT-SPECIFIC DATA:\n${mcpData.clientSpecific}\n\n`;
    }

    userPrompt += `Please provide strategic analysis focusing on ${analysisType} strategy and risk management.`;

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.3 // Lower temperature for more consistent business analysis
    });

    return completion.choices[0].message.content;

  } catch (error) {
    console.error('LLM analysis error:', error);
    throw new Error('AI_ANALYSIS_ERROR: ' + error.message);
  }
}

/**
 * Format AI analysis for Slack display
 */
function formatAnalysisForSlack(analysis, mcpData) {
  // Parse the analysis to extract sections
  const sections = parseAnalysisContent(analysis);

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🤖 AI Financial Analysis"
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: analysis
      }
    }
  ];

  // Add action buttons for follow-up
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Deep Dive Analysis" },
        action_id: "analyze_deep_dive",
        style: "primary"
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Draft Collection Emails" },
        action_id: "draft_collection_emails"
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Risk Report" },
        action_id: "generate_risk_report"
      }
    ]
  });

  return {
    text: "AI Analysis Complete",
    blocks
  };
}

/**
 * Parse analysis content into structured sections
 */
function parseAnalysisContent(analysis) {
  const sections = {
    keyFindings: [],
    riskPriorities: [],
    recommendations: [],
    followUp: []
  };

  // Basic parsing - in production, could use more sophisticated NLP
  const lines = analysis.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().includes('key finding') || trimmed.toLowerCase().includes('findings')) {
      currentSection = 'keyFindings';
    } else if (trimmed.toLowerCase().includes('risk') || trimmed.toLowerCase().includes('priorities')) {
      currentSection = 'riskPriorities';
    } else if (trimmed.toLowerCase().includes('recommendation') || trimmed.toLowerCase().includes('strategy')) {
      currentSection = 'recommendations';
    } else if (trimmed.toLowerCase().includes('follow') || trimmed.toLowerCase().includes('next')) {
      currentSection = 'followUp';
    } else if (currentSection && trimmed.startsWith('-') || trimmed.match(/^\d+\./)) {
      sections[currentSection].push(trimmed);
    }
  }

  return sections;
}

/**
 * Parse analyze command arguments
 */
export function parseAnalyzeArgs(text) {
  const args = { type: 'collections' };

  // Determine analysis type
  if (text.includes('risk')) {
    args.type = 'risk';
  } else if (text.includes('client')) {
    args.type = 'client';
  } else if (text.includes('cash flow') || text.includes('cashflow')) {
    args.type = 'cashflow';
  } else if (text.includes('trend')) {
    args.type = 'trends';
  }

  // Extract client name if specified
  const clientMatch = text.match(/(?:for|client)\s+([^,\n]+)/i);
  if (clientMatch) {
    args.clientName = clientMatch[1].trim();
  }

  return args;
}