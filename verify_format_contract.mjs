import assert from 'node:assert/strict';
import { ZaloClient } from './zaloClient.js';

function createClient(sendMessageImpl) {
  const client = Object.create(ZaloClient.prototype);
  client.api = {
    sendMessage: async (content, threadId, threadType) => sendMessageImpl(content, threadId, threadType),
  };
  client._threadTypeEnum = (threadType) => threadType;
  return client;
}

async function testPlainTextCompatibility() {
  let captured;
  const client = createClient(async (content, threadId, threadType) => {
    captured = { content, threadId, threadType };
    return { ok: true };
  });

  await client.sendText('123', 'user', 'Xin chào');

  assert.deepEqual(captured, {
    content: { msg: 'Xin chào' },
    threadId: '123',
    threadType: 'user',
  });
}

async function testSchemaValidation() {
  const client = createClient(async () => ({ ok: true }));
  await assert.rejects(
    () => client.sendText('123', 'user', 'abc', undefined, undefined, { version: 2, segments: [] }),
    /format\.version must be 1/,
  );
  await assert.rejects(
    () => client.sendText('123', 'user', 'abc', undefined, undefined, { version: 1, segments: [{ styles: [] }] }),
    /format\.segments\[0\]\.text must be a string/,
  );
}

async function testUnsupportedStyleGracefulFallback() {
  let captured;
  const client = createClient(async (content, threadId, threadType) => {
    captured = { content, threadId, threadType };
    return { ok: true };
  });

  await client.sendText(
    'thread-1',
    'group',
    'Xin chào thế giới',
    [{ pos: 0, uid: '42', len: 8 }],
    { msgId: 'quoted' },
    {
      version: 1,
      segments: [
        { text: 'Xin chào', styles: ['bold', 'unsupported'] },
        { text: ' thế giới', styles: [] },
      ],
    },
  );

  assert.equal(captured.threadId, 'thread-1');
  assert.equal(captured.threadType, 'group');
  assert.deepEqual(captured.content, {
    msg: 'Xin chào thế giới',
    mentions: [{ pos: 0, uid: '42', len: 8 }],
    quote: { msgId: 'quoted' },
  });
}

async function main() {
  await testPlainTextCompatibility();
  await testSchemaValidation();
  await testUnsupportedStyleGracefulFallback();
  console.log('verify_format_contract: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
