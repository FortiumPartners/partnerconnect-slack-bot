import { spawn } from 'child_process';
import { EventEmitter } from 'events';

/**
 * MCP Client for communicating with PartnerConnect MCP Server
 * Used by smart commands for AI-enhanced analysis
 */
export class MCPClient extends EventEmitter {
  constructor(config) {
    super();
    this.serverPath = config.serverPath;
    this.timeout = config.timeout || 30000;
    this.process = null;
    this.isConnected = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  /**
   * Connect to MCP server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Spawn the MCP server process
        this.process = spawn('node', [this.serverPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        let buffer = '';

        // Handle stdout (JSON-RPC responses)
        this.process.stdout.on('data', (data) => {
          buffer += data.toString();

          // Process complete JSON messages
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line) {
              try {
                const message = JSON.parse(line);
                this.handleMessage(message);
              } catch (error) {
                console.error('Error parsing MCP message:', error, 'Line:', line);
              }
            }
          }
        });

        // Handle stderr (logs)
        this.process.stderr.on('data', (data) => {
          const message = data.toString().trim();
          if (message && !message.includes('PartnerConnect MCP server started')) {
            console.error('MCP Server stderr:', message);
          }
        });

        // Handle process errors
        this.process.on('error', (error) => {
          console.error('MCP Server process error:', error);
          this.isConnected = false;
          reject(error);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          console.log(`MCP Server exited with code ${code}, signal ${signal}`);
          this.isConnected = false;
          this.rejectPendingRequests('Server disconnected');
        });

        // Send initialization message
        setTimeout(() => {
          this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            clientInfo: {
              name: 'partnerconnect-slack-bot',
              version: '1.0.0'
            }
          }).then(() => {
            this.isConnected = true;
            console.log('MCP Client connected successfully');
            resolve();
          }).catch(reject);
        }, 1000); // Give server time to start

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isConnected = false;
    this.rejectPendingRequests('Client disconnected');
  }

  /**
   * Send JSON-RPC request to MCP server
   */
  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected && method !== 'initialize') {
        reject(new Error('MCP client not connected'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      // Store pending request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message);
    });
  }

  /**
   * Handle incoming messages from MCP server
   */
  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(message.id);
      clearTimeout(timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(`MCP Error: ${message.error.message}`));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // Handle notifications/requests from server
      console.log('MCP Server notification:', message);
    }
  }

  /**
   * Reject all pending requests
   */
  rejectPendingRequests(reason) {
    for (const [id, { reject, timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
      reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  /**
   * List available tools
   */
  async listTools() {
    const result = await this.sendRequest('tools/list');
    return result.tools;
  }

  /**
   * Call a specific tool
   */
  async callTool(name, arguments_ = {}) {
    try {
      const result = await this.sendRequest('tools/call', {
        name,
        arguments: arguments_
      });

      // Extract text content from MCP response
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
        return textContent;
      }

      return result;
    } catch (error) {
      console.error(`Error calling MCP tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.listTools();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create MCP client with environment configuration
 */
export function createMCPClient() {
  return new MCPClient({
    serverPath: process.env.MCP_SERVER_PATH || '/Users/burke/projects/partnerconnect-mcp/build/index.js',
    timeout: parseInt(process.env.MCP_TIMEOUT) || 30000
  });
}

/**
 * Singleton MCP client instance
 */
let mcpClientInstance = null;

export async function getMCPClient() {
  if (!mcpClientInstance) {
    mcpClientInstance = createMCPClient();
    await mcpClientInstance.connect();
  }

  if (!mcpClientInstance.isConnected) {
    await mcpClientInstance.connect();
  }

  return mcpClientInstance;
}

/**
 * Close MCP client connection
 */
export async function closeMCPClient() {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
    mcpClientInstance = null;
  }
}