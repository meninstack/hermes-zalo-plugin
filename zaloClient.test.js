import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { TextStyle } from "zca-js";
import { ZaloClient } from "./zaloClient.js";

// server.js auto-starts (app.listen + login) unless imported; point its data dir
// at a scratch tmp dir so the import doesn't touch the real ~/.hermes-zalo.
process.env.ZALO_DATA_DIR = path.join(os.tmpdir(), `hermes-zalo-test-${process.pid}`);
const { validateStyles } = await import("./server.js");

function makeClient() {
  const client = new ZaloClient({
    credentialsPath: path.join(process.env.ZALO_DATA_DIR, "credentials.json"),
    qrPath: path.join(process.env.ZALO_DATA_DIR, "qr.png"),
  });
  const calls = [];
  client.api = {
    sendMessage: async (content, threadId, type) => {
      calls.push({ content, threadId, type });
      return { message: { msgId: 1 }, attachment: [] };
    },
  };
  return { client, calls };
}

// ── US2: backward compatibility (T003) ──────────────────────────────────────

test("sendText omits content.styles when styles is undefined", async () => {
  const { client, calls } = makeClient();
  await client.sendText("t1", "user", "hello", undefined, undefined, undefined);
  assert.equal("styles" in calls[0].content, false);
});

test("sendText omits content.styles when styles is []", async () => {
  const { client, calls } = makeClient();
  await client.sendText("t1", "user", "hello", undefined, undefined, []);
  assert.equal("styles" in calls[0].content, false);
});

// ── US1: build Style[] from valid styles (T006, T007) ───────────────────────

test("sendText builds content.styles 1-1 for multiple valid entries, indentSize only on Indent", async () => {
  const { client, calls } = makeClient();
  const styles = [
    { start: 0, len: 3, type: TextStyle.Bold },
    { start: 2, len: 4, type: TextStyle.Red },
    { start: 5, len: 2, type: TextStyle.Indent, indentSize: 4 },
  ];
  await client.sendText("t1", "user", "hello world", undefined, undefined, styles);
  assert.deepEqual(calls[0].content.styles, [
    { start: 0, len: 3, st: TextStyle.Bold },
    { start: 2, len: 4, st: TextStyle.Red },
    { start: 5, len: 2, st: TextStyle.Indent, indentSize: 4 },
  ]);
});

test("sendText applies overlapping ranges independently without resolving them", async () => {
  const { client, calls } = makeClient();
  const styles = [
    { start: 0, len: 5, type: TextStyle.Bold },
    { start: 0, len: 3, type: TextStyle.Italic },
  ];
  await client.sendText("t1", "user", "hello world", undefined, undefined, styles);
  assert.deepEqual(calls[0].content.styles, [
    { start: 0, len: 5, st: TextStyle.Bold },
    { start: 0, len: 3, st: TextStyle.Italic },
  ]);
});

// ── US3: validateStyles rejects malformed input, all-or-nothing (T010, T011) ─

test("validateStyles: styles present but not an Array", () => {
  const result = validateStyles({}, 10);
  assert.equal(result.ok, false);
  assert.equal(result.error, "styles must be an array");
});

test("validateStyles: styles undefined/[] pass through (no-op)", () => {
  assert.deepEqual(validateStyles(undefined, 10), { ok: true });
  assert.deepEqual(validateStyles([], 10), { ok: true });
});

test("validateStyles: start not an integer or < 0", () => {
  assert.equal(
    validateStyles([{ start: -1, len: 1, type: TextStyle.Bold }], 10).error,
    "invalid styles entry at index 0: start must be an integer >= 0",
  );
  assert.equal(
    validateStyles([{ start: 1.5, len: 1, type: TextStyle.Bold }], 10).error,
    "invalid styles entry at index 0: start must be an integer >= 0",
  );
});

test("validateStyles: len not an integer or < 1", () => {
  assert.equal(
    validateStyles([{ start: 0, len: 0, type: TextStyle.Bold }], 10).error,
    "invalid styles entry at index 0: len must be an integer >= 1",
  );
  assert.equal(
    validateStyles([{ start: 0, len: "2", type: TextStyle.Bold }], 10).error,
    "invalid styles entry at index 0: len must be an integer >= 1",
  );
});

test("validateStyles: type not one of TextStyle values", () => {
  assert.equal(
    validateStyles([{ start: 0, len: 1, type: "bogus" }], 10).error,
    "invalid styles entry at index 0: type must be one of the supported TextStyle values",
  );
});

test("validateStyles: start + len exceeds text length", () => {
  assert.equal(
    validateStyles([{ start: 8, len: 5, type: TextStyle.Bold }], 10).error,
    "invalid styles entry at index 0: start + len must not exceed text length",
  );
});

test("validateStyles: reports the failing index when a later entry is invalid", () => {
  const result = validateStyles(
    [
      { start: 0, len: 1, type: TextStyle.Bold },
      { start: -1, len: 1, type: TextStyle.Bold },
    ],
    10,
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "invalid styles entry at index 1: start must be an integer >= 0");
});

test("validateStyles: one valid + one malformed entry rejects the whole array (all-or-nothing)", async () => {
  const { client, calls } = makeClient();
  const styles = [
    { start: 0, len: 1, type: TextStyle.Bold },
    { start: -1, len: 1, type: TextStyle.Bold },
  ];
  const result = validateStyles(styles, 10);
  assert.equal(result.ok, false);
  // Mirrors the route: sendText must not be invoked when validation fails.
  if (result.ok) await client.sendText("t1", "user", "hello", undefined, undefined, styles);
  assert.equal(calls.length, 0);
});

// ── Polish: mentions + quote + styles together, none dropped (T015) ─────────

test("sendText keeps mentions, quote, and styles all present together", async () => {
  const { client, calls } = makeClient();
  const mentions = [{ pos: 0, uid: "123", len: 4 }];
  const quote = { msgId: "1", cliMsgId: "1" };
  const styles = [{ start: 0, len: 3, type: TextStyle.Bold }];
  await client.sendText("t1", "user", "hello world", mentions, quote, styles);
  assert.deepEqual(calls[0].content.mentions, mentions);
  assert.deepEqual(calls[0].content.quote, quote);
  assert.deepEqual(calls[0].content.styles, [{ start: 0, len: 3, st: TextStyle.Bold }]);
});
