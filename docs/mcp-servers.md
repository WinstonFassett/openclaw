# MCP Server Support

OpenClaw now supports synchronous MCP (Model Context Protocol) server interaction through the ACP (Agent Client Protocol) layer.

## Overview

With MCP server support enabled, OpenClaw can:
- Accept MCP server configurations in sessions
- Process MCP servers instead of ignoring them
- Enable HTTP and SSE MCP capabilities
- Support synchronous/blocking interaction patterns

## Configuration

Add MCP server configuration to your `~/.openclaw/openclaw.json`:

```json5
{
  mcp: {
    enabled: true,
    timeoutMs: 30000,
    
    servers: {
      "my-server": {
        name: "my-server",
        command: "mcporter",
        args: ["daemon", "start"],
        env: {
          "API_KEY": "your-api-key"
        },
        blocking: true
      }
    },
    
    defaultServers: ["my-server"]
  }
}
```

## Configuration Options

### McpConfig

- `enabled`: Enable/disable MCP support (boolean)
- `timeoutMs`: Global timeout for MCP operations (number, ms)
- `servers`: MCP server configurations (Record<string, McpServerConfig>)
- `defaultServers`: Default servers for new sessions (string[])

### McpServerConfig

- `name`: Server identifier (string)
- `command`: Command to run the server (string)
- `args`: Command arguments (string[], optional)
- `env`: Environment variables (Record<string, string>, optional)
- `cwd`: Working directory (string, optional)
- `timeoutMs`: Server-specific timeout (number, ms, optional)
- `blocking`: Enable synchronous mode (boolean, optional)

## Usage

### With mcporter

OpenClaw includes the mcporter skill for MCP server communication:

```bash
# List available MCP servers
mcporter list

# Call MCP server tools
mcporter call my-server.tool_name param=value

# Use with OpenClaw
openclaw "Use mcporter to call my-server.get_data"
```

### Synchronous Interaction

When `blocking: true` is set, OpenClaw will:
1. Call the MCP server
2. Wait for the response
3. Block until the operation completes

This uses OpenClaw's existing `expectFinal` mechanism for synchronous behavior.

## Implementation Details

### ACP Layer Changes

- MCP capabilities enabled: `http: true, sse: true`
- MCP servers are processed instead of ignored
- Configuration passed through to sessions

### Integration Points

- `src/acp/translator.ts`: Core MCP server handling
- `src/acp/client.ts`: MCP server configuration
- `src/config/types.mcp.ts`: Configuration schema
- mcporter skill: Actual MCP communication

## Example Use Cases

### Linear Integration

```json5
{
  mcp: {
    servers: {
      "linear": {
        name: "linear",
        command: "mcporter",
        args: ["call", "linear.list_issues"],
        env: { "LINEAR_API_KEY": "${LINEAR_API_KEY}" },
        blocking: true
      }
    }
  }
}
```

### Custom MCP Server

```json5
{
  mcp: {
    servers: {
      "custom-api": {
        name: "custom-api",
        command: "node",
        args: ["./my-mcp-server.js"],
        cwd: "~/projects/my-server",
        blocking: true
      }
    }
  }
}
```

## Testing

Run the MCP server tests:

```bash
pnpm vitest run src/acp/mcp-servers.test.ts
```

## Troubleshooting

1. **MCP servers being ignored**: Check that `mcp.enabled: true` is set
2. **Timeout issues**: Increase `timeoutMs` in server or global config
3. **Authentication failures**: Verify environment variables and API keys
4. **Synchronous issues**: Ensure `blocking: true` is set for blocking behavior

## Related Documentation

- [mcporter Skill](../skills/mcporter/SKILL.md)
- [ACP Protocol](src/acp/)
- [Configuration](gateway/configuration.md)
