import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";

interface MCPSession {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
  server: string;
  lastUsed: number;
}

// Session pool to maintain persistent connections
const mcpSessions = new Map<string, MCPSession>();

// Clean up sessions older than 30 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, session] of mcpSessions.entries()) {
      if (now - session.lastUsed > 30 * 60 * 1000) {
        session.client.close().catch(() => {});
        mcpSessions.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

async function getOrCreateSession(server: string, config: OpenClawConfig): Promise<MCPSession> {
  // Check if session exists and is still valid
  const existing = mcpSessions.get(server);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing;
  }

  // Create new session
  const mcpConfig = config.mcp;
  if (!mcpConfig?.enabled) {
    throw new Error("MCP support is not enabled in configuration");
  }

  const serverConfig = mcpConfig.servers?.[server] as McpServerConfig;
  if (!serverConfig) {
    throw new Error(`MCP server '${server}' not found in configuration`);
  }

  const client = new Client(
    {
      name: "openclaw-mcp-bridge",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  let transport: StdioClientTransport | StreamableHTTPClientTransport;

  // Connect based on server configuration
  if (serverConfig.url) {
    // HTTP connection using modern StreamableHTTP transport with extended timeout
    transport = new StreamableHTTPClientTransport(new URL(serverConfig.url), {
      // Custom fetch with no timeout for long-running voice interactions
      fetch: async (input, init) => {
        const response = await fetch(input, {
          ...init,
          signal: undefined, // Remove timeout signal
        });
        return response;
      },
    });
    console.log(`Connecting to MCP server via HTTP: ${serverConfig.url} (no timeout for voice)`);
  } else if (serverConfig.command) {
    // Stdio connection
    const serverArgs = serverConfig.args || [];
    transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverArgs,
      env: Object.fromEntries(
        Object.entries({ ...process.env, ...serverConfig.env }).filter(([, v]) => v !== undefined),
      ) as Record<string, string>,
      cwd: serverConfig.cwd || process.cwd(),
    });
    console.log(
      `Connecting to MCP server via stdio: ${serverConfig.command} ${serverArgs.join(" ")}`,
    );
  } else {
    throw new Error(`MCP server '${server}' must have either 'url' or 'command' configured`);
  }

  // Connect to MCP server
  await client.connect(transport);
  console.log(`Connected to MCP server: ${server}`);

  // List available tools (for debugging)
  const toolsList = await client.listTools();
  console.log(
    `Available tools on ${server}: ${toolsList.tools.map((t: { name: string }) => t.name).join(", ")}`,
  );

  const session: MCPSession = {
    client,
    transport,
    server,
    lastUsed: Date.now(),
  };

  mcpSessions.set(server, session);
  return session;
}

export interface McpCallParams {
  /** MCP server name from configuration */
  server: string;
  /** Tool name to call on the MCP server */
  tool: string;
  /** Arguments to pass to the MCP tool */
  args?: Record<string, unknown>;
  /** Whether to block until response (default: true) */
  blocking?: boolean;
}

export interface McpServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  timeoutMs?: number;
  blocking?: boolean;
}

const McpToolSchema = Type.Object({
  server: Type.String({ description: "MCP server name from configuration" }),
  tool: Type.String({ description: "Tool name to call on the MCP server" }),
  args: Type.Optional(
    Type.Record(Type.String(), Type.Any(), { description: "Arguments to pass to the MCP tool" }),
  ),
  blocking: Type.Optional(
    Type.Boolean({ default: true, description: "Whether to block until response (default: true)" }),
  ),
});

/**
 * Create a generic MCP bridge tool that allows calling any MCP server tool
 */
export function createMcpTool(opts?: { config?: OpenClawConfig }): AnyAgentTool {
  return {
    label: "MCP Call",
    name: "mcp_call",
    description: "Call a tool on any configured MCP server (supports synchronous blocking)",
    parameters: McpToolSchema,

    async execute(
      toolCallId: string,
      params: McpCallParams,
      signal?: AbortSignal,
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      const { server, tool, args = {}, blocking = true } = params;

      console.log(`Connecting to MCP server: ${server}`);

      try {
        // Get or create persistent session
        const config = opts?.config;
        if (!config) {
          throw new Error("No configuration provided to MCP tool");
        }
        const session = await getOrCreateSession(server, config);
        const { client } = session;

        console.log(
          `Calling MCP tool: ${tool} with args: ${JSON.stringify(args)} (blocking: ${blocking})`,
        );

        // Call the tool using persistent session
        const result = await client.callTool({
          name: tool,
          arguments: args,
        });

        console.log(
          `MCP tool ${tool} completed. Content length: ${(result.content as Array<{ type: string }>).length}`,
        );

        // Update session last used time
        session.lastUsed = Date.now();

        // Handle different content types from MCP
        const contentArray = result.content as Array<{
          type: string;
          text?: string;
          mimeType?: string;
          resource?: { uri?: string };
        }>;
        if (contentArray.length === 0) {
          return {
            content: [{ type: "text", text: "MCP tool returned empty result" }],
            details: { tool, server, result: "empty" },
          };
        }

        const firstContent = contentArray[0];
        if (firstContent.type === "text") {
          return {
            content: [{ type: "text", text: firstContent.text || "No text content" }],
            details: { tool, server, result: firstContent.text },
          };
        } else if (firstContent.type === "image") {
          return {
            content: [
              { type: "text", text: `Image content: ${firstContent.mimeType || "unknown"}` },
            ],
            details: { tool, server, result: "image", mimeType: firstContent.mimeType },
          };
        } else if (firstContent.type === "resource") {
          return {
            content: [
              { type: "text", text: `Resource: ${firstContent.resource?.uri || "unknown"}` },
            ],
            details: { tool, server, result: "resource", uri: firstContent.resource?.uri },
          };
        } else {
          return {
            content: [{ type: "text", text: `Unknown content type: ${firstContent.type}` }],
            details: { tool, server, result: "unknown" },
          };
        }
      } catch (error) {
        console.error(`MCP tool call failed:`, error);

        // Remove session if it's broken
        const brokenSession = mcpSessions.get(server);
        if (brokenSession) {
          try {
            await brokenSession.client.close();
          } catch {
            // Ignore close errors
          }
          mcpSessions.delete(server);
        }

        return {
          content: [
            {
              type: "text",
              text: `MCP tool call failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {
            status: "error",
            tool,
            server,
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  };
}

// Export a default instance for backward compatibility
export const mcpTool = createMcpTool();
