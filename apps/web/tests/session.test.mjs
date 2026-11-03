import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_KEY, SESSION_EXPIRED, tokenExpiresAt, expireSession, authenticatedFetch } from '../src/services/session.ts';

const originalFetch = globalThis.fetch;
let storage;
let expired;
function token(exp = Math.floor(Date.now() / 1000) + 3600) {
  return `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
}
beforeEach(() => {
  storage = new Map();
  expired = 0;
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  globalThis.window = new EventTarget();
  window.addEventListener(SESSION_EXPIRED, () => expired++);
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.localStorage;
  delete globalThis.window;
});

test('reads JWT expiration and rejects malformed payloads', () => {
  assert.equal(tokenExpiresAt(token(123)), 123000);
  for (const value of ['', 'abc', 'a.b.c', 'a.e30.c']) assert.equal(tokenExpiresAt(value), 0);
});

test('missing/expired/malformed tokens never reach the protected API', async () => {
  globalThis.fetch = () => { throw new Error('must not fetch'); };
  for (const value of [null, token(1), 'invalid']) {
    if (value) storage.set(TOKEN_KEY, value);
    await assert.rejects(authenticatedFetch('/private'), /Vui lòng đăng nhập lại/);
    assert.equal(storage.has(TOKEN_KEY), false);
  }
  assert.equal(expired, 3);
});

test('attaches Bearer token and preserves request options', async () => {
  const accessToken = token();
  storage.set(TOKEN_KEY, accessToken);
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/private');
    assert.equal(init.headers.get('Authorization'), `Bearer ${accessToken}`);
    assert.equal(init.headers.get('Content-Type'), 'application/json');
    assert.equal(init.method, 'POST');
    assert.equal(init.body, '{}');
    return new Response('{}');
  };
  assert.equal((await authenticatedFetch('/private', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 200);
});

test('401 clears session and notifies the auth provider', async () => {
  storage.set(TOKEN_KEY, token());
  globalThis.fetch = async () => new Response(null, { status: 401 });
  assert.equal((await authenticatedFetch('/private')).status, 401);
  assert.equal(storage.has(TOKEN_KEY), false);
  assert.equal(expired, 1);
});

test('403 and network failures preserve the session', async () => {
  const accessToken = token();
  storage.set(TOKEN_KEY, accessToken);
  globalThis.fetch = async () => new Response(null, { status: 403 });
  await authenticatedFetch('/private');
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(authenticatedFetch('/private'), /offline/);
  assert.equal(storage.get(TOKEN_KEY), accessToken);
  assert.equal(expired, 0);
});

test('an old session response cannot log out a newer session', async () => {
  const oldToken = token();
  const newToken = token(Math.floor(Date.now() / 1000) + 7200);
  storage.set(TOKEN_KEY, oldToken);
  globalThis.fetch = async () => {
    storage.set(TOKEN_KEY, newToken);
    return new Response(null, { status: 401 });
  };
  await authenticatedFetch('/private');
  expireSession(oldToken);
  assert.equal(storage.get(TOKEN_KEY), newToken);
  assert.equal(expired, 0);
});
