export type McpServerConfig = {
  /** MCP server name/identifier. */
  name: string;
  /** MCP server command to run. */
  command: string;
  /** Arguments for the MCP server command. */
  args?: string[];
  /** Environment variables for the MCP server. */
  env?: Record<string, string>;
  /** Working directory for the MCP server. */
  cwd?: string;
  /** Timeout in milliseconds for MCP server responses. */
  timeoutMs?: number;
  /** Whether to enable synchronous/blocking mode. */
  blocking?: boolean;
};

export type McpConfig = {
  /** Enable/disable MCP support. */
  enabled?: boolean;
  /** Global timeout for MCP operations (ms). */
  timeoutMs?: number;
  /** MCP server configurations. */
  servers?: Record<string, McpServerConfig>;
  /** Default MCP servers to use for new sessions. */
  defaultServers?: string[];
};
