import { describe, it, expect, vi } from "vitest";
import { AcpGatewayAgent } from "./translator.js";
import type { AcpServerOptions } from "./types.js";

describe("ACP MCP Server Support", () => {
  it("should enable MCP capabilities", async () => {
    const mockGateway = {
      request: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as any;

    const agent = new AcpGatewayAgent(
      {
        sendSessionUpdate: vi.fn(),
      } as any,
      mockGateway,
      {} as AcpServerOptions,
    );

    const capabilities = await agent.initialize({
      protocolVersion: "2024-11-05",
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: "test-client", version: "1.0.0" },
    });

    expect(capabilities.agentCapabilities.mcpCapabilities.http).toBe(true);
    expect(capabilities.agentCapabilities.mcpCapabilities.sse).toBe(true);
  });

  it("should process MCP servers in newSession", async () => {
    const mockGateway = {
      request: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as any;

    const agent = new AcpGatewayAgent(
      {
        sendSessionUpdate: vi.fn(),
      } as any,
      mockGateway,
      { verbose: true } as AcpServerOptions,
    );

    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await agent.newSession({
      cwd: "/test",
      mcpServers: [{ name: "test-server" }],
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("processing 1 MCP servers"));

    logSpy.mockRestore();
  });

  it("should process MCP servers in loadSession", async () => {
    const mockGateway = {
      request: vi.fn().mockResolvedValue({
        sessions: [],
      }),
      on: vi.fn(),
      off: vi.fn(),
    } as any;

    const agent = new AcpGatewayAgent(
      {
        sendSessionUpdate: vi.fn(),
      } as any,
      mockGateway,
      { verbose: true } as AcpServerOptions,
    );

    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await agent.loadSession({
      sessionId: "test-session",
      cwd: "/test",
      mcpServers: [{ name: "test-server" }],
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("processing 1 MCP servers"));

    logSpy.mockRestore();
  });
});
