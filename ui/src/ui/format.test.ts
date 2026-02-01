import { describe, expect, it } from "vitest";

import { stripReplyTags, stripThinkingTags } from "./format";

describe("stripThinkingTags", () => {
  it("strips <think>…</think> segments", () => {
    const input = ["<think>", "secret", "</think>", "", "Hello"].join("\n");
    expect(stripThinkingTags(input)).toBe("Hello");
  });

  it("strips <thinking>…</thinking> segments", () => {
    const input = ["<thinking>", "secret", "</thinking>", "", "Hello"].join("\n");
    expect(stripThinkingTags(input)).toBe("Hello");
  });

  it("keeps text when tags are unpaired", () => {
    expect(stripThinkingTags("<think>\nsecret\nHello")).toBe("secret\nHello");
    expect(stripThinkingTags("Hello\n</think>")).toBe("Hello\n");
  });

  it("returns original text when no tags exist", () => {
    expect(stripThinkingTags("Hello")).toBe("Hello");
  });

  it("strips <final>…</final> segments", () => {
    const input = "<final>\n\nHello there\n\n</final>";
    expect(stripThinkingTags(input)).toBe("Hello there\n\n");
  });

  it("strips mixed <think> and <final> tags", () => {
    const input = "<think>reasoning</think>\n\n<final>Hello</final>";
    expect(stripThinkingTags(input)).toBe("Hello");
  });

  it("handles incomplete <final tag gracefully", () => {
    // When streaming splits mid-tag, we may see "<final" without closing ">"
    // This should not crash and should handle gracefully
    expect(stripThinkingTags("<final\nHello")).toBe("<final\nHello");
    expect(stripThinkingTags("Hello</final>")).toBe("Hello");
  });
});

describe("stripReplyTags", () => {
  it("strips [[reply_to:id]] tags", () => {
    expect(stripReplyTags("[[reply_to:msg_123]]Hello")).toBe("Hello");
    expect(stripReplyTags("Hello [[reply_to:abc]] world")).toBe("Hello world");
    expect(stripReplyTags("[[reply_to:  spaces  ]] text")).toBe("text");
  });

  it("strips [[reply_to_current]] tags", () => {
    expect(stripReplyTags("[[reply_to_current]]Hello")).toBe("Hello");
    expect(stripReplyTags("Hello [[reply_to_current]] world")).toBe("Hello world");
  });

  it("handles whitespace in tags", () => {
    expect(stripReplyTags("[[ reply_to_current ]]Hello")).toBe("Hello");
    expect(stripReplyTags("[[  reply_to : id  ]]Hello")).toBe("Hello");
  });

  it("strips multiple tags", () => {
    expect(stripReplyTags("[[reply_to:a]][[reply_to:b]]Hello")).toBe("Hello");
    expect(stripReplyTags("[[reply_to_current]][[reply_to:id]]text")).toBe("text");
  });

  it("returns original text when no tags exist", () => {
    expect(stripReplyTags("Hello world")).toBe("Hello world");
  });

  it("normalizes multiple spaces to single space", () => {
    expect(stripReplyTags("Hello   world")).toBe("Hello world");
    expect(stripReplyTags("a [[reply_to:x]]  b")).toBe("a b");
  });

  it("handles case-insensitive matching", () => {
    expect(stripReplyTags("[[REPLY_TO_CURRENT]]Hello")).toBe("Hello");
    expect(stripReplyTags("[[Reply_To:id]]Hello")).toBe("Hello");
  });
});
