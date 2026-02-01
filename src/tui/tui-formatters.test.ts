import { describe, expect, it } from "vitest";
import {
  extractContentFromMessage,
  extractTextFromMessage,
  extractThinkingFromMessage,
  isCommandMessage,
} from "./tui-formatters.js";

describe("extractTextFromMessage", () => {
  it("renders errorMessage when assistant content is empty", () => {
    const text = extractTextFromMessage({
      role: "assistant",
      content: [],
      stopReason: "error",
      errorMessage:
        '429 {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed your account\\u0027s rate limit. Please try again later."},"request_id":"req_123"}',
    });

    expect(text).toContain("HTTP 429");
    expect(text).toContain("rate_limit_error");
    expect(text).toContain("req_123");
  });

  it("falls back to a generic message when errorMessage is missing", () => {
    const text = extractTextFromMessage({
      role: "assistant",
      content: [],
      stopReason: "error",
      errorMessage: "",
    });

    expect(text).toContain("unknown error");
  });

  it("joins multiple text blocks with single newlines", () => {
    const text = extractTextFromMessage({
      role: "assistant",
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    });

    expect(text).toBe("first\nsecond");
  });

  it("places thinking before content when included", () => {
    const text = extractTextFromMessage(
      {
        role: "assistant",
        content: [
          { type: "text", text: "hello" },
          { type: "thinking", thinking: "ponder" },
        ],
      },
      { includeThinking: true },
    );

    expect(text).toBe("[thinking]\nponder\n\nhello");
  });
});

describe("extractThinkingFromMessage", () => {
  it("collects only thinking blocks", () => {
    const text = extractThinkingFromMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "alpha" },
        { type: "text", text: "hello" },
        { type: "thinking", thinking: "beta" },
      ],
    });

    expect(text).toBe("alpha\nbeta");
  });
});

describe("extractContentFromMessage", () => {
  it("collects only text blocks", () => {
    const text = extractContentFromMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "alpha" },
        { type: "text", text: "hello" },
      ],
    });

    expect(text).toBe("hello");
  });

  it("renders error text when stopReason is error and content is not an array", () => {
    const text = extractContentFromMessage({
      role: "assistant",
      stopReason: "error",
      errorMessage: '429 {"error":{"message":"rate limit"}}',
    });

    expect(text).toContain("HTTP 429");
  });
});

describe("isCommandMessage", () => {
  it("detects command-marked messages", () => {
    expect(isCommandMessage({ command: true })).toBe(true);
    expect(isCommandMessage({ command: false })).toBe(false);
    expect(isCommandMessage({})).toBe(false);
  });
});

describe("extractTextFromMessage - reply tag stripping", () => {
  it("strips [[reply_to:id]] from assistant messages", () => {
    const text = extractTextFromMessage({
      role: "assistant",
      content: [{ type: "text", text: "[[reply_to:msg_123]]Hello there" }],
    });
    expect(text).toBe("Hello there");
  });

  it("strips [[reply_to_current]] from assistant messages", () => {
    const text = extractTextFromMessage({
      role: "assistant",
      content: [{ type: "text", text: "[[reply_to_current]]Hello there" }],
    });
    expect(text).toBe("Hello there");
  });

  it("preserves reply tags in user messages", () => {
    const text = extractTextFromMessage({
      role: "user",
      content: [{ type: "text", text: "[[reply_to:msg_123]]Hello there" }],
    });
    expect(text).toBe("[[reply_to:msg_123]]Hello there");
  });

  it("strips multiple reply tags", () => {
    const text = extractTextFromMessage({
      role: "assistant",
      content: [{ type: "text", text: "[[reply_to:a]][[reply_to_current]]Hello" }],
    });
    expect(text).toBe("Hello");
  });

  it("handles inline reply tags", () => {
    const text = extractTextFromMessage({
      role: "assistant",
      content: [{ type: "text", text: "Hello [[reply_to:id]] world" }],
    });
    expect(text).toBe("Hello world");
  });
});
