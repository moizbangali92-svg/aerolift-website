/**
 * Tests for the quote backend. `node --test worker/quote.test.mjs`.
 *
 * The MailChannels call is injected, never made: the API only accepts requests
 * from Cloudflare IPs, so a real send cannot be exercised from a laptop or a
 * CI runner. What is tested here is everything this repo is responsible for —
 * validation, the payload shape, header-injection defences, the honeypot, the
 * two reply formats and what happens when the API says no.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleQuote, readEnquiry, buildPayload } from './quote.js';

const ENV = { MAILCHANNELS_API_KEY: 'test-key', QUOTE_TO: 'sales@example.com', QUOTE_FROM: 'website@example.com' };

const VALID = {
  name: 'Sara Haddad',
  company: 'Jebel Ali Steel',
  phone: '+971 50 123 4567',
  email: 'sara@jebelalisteel.ae',
  requirement: 'eot-crane',
  message: '10 t double girder, 22 m span, two shifts.',
  page: '/products/eot-cranes/',
};

const formOf = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const post = (fields, { accept = 'application/json', origin = 'https://www.aerolift-cranes.com', ...init } = {}) =>
  new Request('https://www.aerolift-cranes.com/api/quote', {
    method: 'POST',
    headers: { Accept: accept, ...(origin ? { Origin: origin } : {}) },
    body: formOf(fields),
    ...init,
  });

/** A stub standing in for fetch; records what it was called with. */
const stub = (status = 202, body = '') => {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, payload: JSON.parse(init.body) });
    return new Response(body, { status });
  };
  fn.calls = calls;
  return fn;
};

test('a valid enquiry is accepted and sent', async () => {
  const send = stub();
  const res = await handleQuote(post(VALID), ENV, send);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(send.calls.length, 1);

  const { url, init, payload } = send.calls[0];
  assert.equal(url, 'https://api.mailchannels.net/tx/v1/send');
  assert.equal(init.headers['X-Api-Key'], 'test-key');
  assert.equal(payload.personalizations[0].to[0].email, 'sales@example.com');
  assert.equal(payload.from.email, 'website@example.com');
  // The visitor is the Reply-To, never the From — From has to stay on an
  // authenticated domain or the message is unsigned.
  assert.equal(payload.reply_to.email, 'sara@jebelalisteel.ae');
  assert.equal(payload.content.length, 1);
  assert.equal(payload.content[0].type, 'text/plain');
  assert.match(payload.content[0].value, /10 t double girder/);
  assert.match(payload.content[0].value, /\/products\/eot-cranes\//);
});

test('every required field is required', async () => {
  for (const missing of ['name', 'company', 'phone', 'email', 'requirement', 'message']) {
    const fields = { ...VALID };
    delete fields[missing];
    const send = stub();
    const res = await handleQuote(post(fields), ENV, send);
    assert.equal(res.status, 422, `${missing} should be required`);
    assert.deepEqual((await res.json()).fields, [missing]);
    assert.equal(send.calls.length, 0, 'nothing should be sent');
  }
});

test('whitespace does not satisfy a required field', async () => {
  const send = stub();
  const res = await handleQuote(post({ ...VALID, name: '   \t  ' }), ENV, send);
  assert.equal(res.status, 422);
  assert.equal(send.calls.length, 0);
});

test('a malformed email is rejected', async () => {
  for (const email of ['not-an-email', 'a@b', 'a b@c.com', 'two@@at.com', '<a@b.com>']) {
    const res = await handleQuote(post({ ...VALID, email }), ENV, stub());
    assert.equal(res.status, 422, `${email} should be rejected`);
  }
});

test('a requirement outside the select list is rejected', async () => {
  const send = stub();
  const res = await handleQuote(post({ ...VALID, requirement: 'free-crane' }), ENV, send);
  assert.equal(res.status, 422);
  assert.equal(send.calls.length, 0);
});

test('CR/LF cannot escape a field into a header', async () => {
  const send = stub();
  const res = await handleQuote(
    post({
      ...VALID,
      name: 'Sara\r\nBcc: victim@example.com',
      company: 'Steel\nX-Injected: yes',
      email: 'sara@jebelalisteel.ae',
    }),
    ENV,
    send
  );
  assert.equal(res.status, 202);
  const { payload } = send.calls[0];
  // The defence is that the break is gone, not that the words are. Collapsing
  // CR/LF to a space leaves "Bcc:" and "X-Injected:" as inert text in the
  // middle of a line, where they cannot start a header; deleting the
  // visitor's words instead would lose real content to a false positive.
  for (const v of [payload.subject, payload.reply_to.name, payload.from.name]) {
    assert.doesNotMatch(v, /[\r\n]/, `"${v}" still contains a newline`);
  }
  assert.equal(payload.subject.split('\n').length, 1);
  assert.doesNotMatch(payload.reply_to.name, /^Bcc:/m);
});

test('fields are clamped so one enquiry cannot carry a megabyte', () => {
  const parsed = readEnquiry(formOf({ ...VALID, message: 'x'.repeat(50000) }));
  assert.ok(parsed.ok);
  assert.equal(parsed.data.message.length, 5000);
});

test('there is no HTML part, so nothing typed is parsed as markup', () => {
  const payload = buildPayload(
    { ...VALID, message: '<img src=x onerror=alert(1)>' },
    { to: 'a@b.com', from: 'c@d.com' }
  );
  assert.equal(payload.content.length, 1);
  assert.equal(payload.content[0].type, 'text/plain');
  assert.ok(!payload.content.some((c) => c.type === 'text/html'));
});

test('a filled honeypot gets the success page and sends nothing', async () => {
  const send = stub();
  const res = await handleQuote(post({ ...VALID, _gotcha: 'http://spam.example' }), ENV, send);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(send.calls.length, 0, 'the honeypot must not send');
});

test('an empty honeypot is ignored', async () => {
  const send = stub();
  const res = await handleQuote(post({ ...VALID, _gotcha: '' }), ENV, send);
  assert.equal(res.status, 202);
  assert.equal(send.calls.length, 1);
});

test('a cross-origin POST is refused', async () => {
  const send = stub();
  const res = await handleQuote(post(VALID, { origin: 'https://evil.example' }), ENV, send);
  assert.equal(res.status, 403);
  assert.equal(send.calls.length, 0);
});

test('a missing Origin header is allowed through', async () => {
  const send = stub();
  const res = await handleQuote(post(VALID, { origin: null }), ENV, send);
  assert.equal(res.status, 202);
  assert.equal(send.calls.length, 1);
});

test('GET is refused with an Allow header', async () => {
  const res = await handleQuote(
    new Request('https://www.aerolift-cranes.com/api/quote', { headers: { Accept: 'application/json' } }),
    ENV,
    stub()
  );
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('Allow'), 'POST');
});

test('a missing API key is a 503, not a silent success', async () => {
  const send = stub();
  const res = await handleQuote(post(VALID), { ...ENV, MAILCHANNELS_API_KEY: '' }, send);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).ok, false);
  assert.equal(send.calls.length, 0);
});

test('a MailChannels rejection surfaces as 502, never as success', async () => {
  for (const status of [400, 401, 403, 429, 500]) {
    const res = await handleQuote(post(VALID), ENV, stub(status, 'nope'));
    assert.equal(res.status, 502, `upstream ${status} should become 502`);
    assert.equal((await res.json()).ok, false);
  }
});

test('a thrown request surfaces as 502', async () => {
  const res = await handleQuote(post(VALID), ENV, async () => {
    throw new Error('connection reset');
  });
  assert.equal(res.status, 502);
});

test('without Accept: application/json the reply is a real HTML page', async () => {
  const res = await handleQuote(post(VALID, { accept: 'text/html' }), ENV, stub());
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Request received/);
  assert.match(html, /noindex/);
});

test('generated replies carry their own security headers', async () => {
  for (const res of [
    await handleQuote(post(VALID), ENV, stub()),
    await handleQuote(post(VALID, { accept: 'text/html' }), ENV, stub()),
    await handleQuote(post({}, { accept: 'text/html' }), ENV, stub()),
  ]) {
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.ok(res.headers.get('Content-Security-Policy'), 'a generated reply with no CSP');
  }
});

test('the HTML error page escapes what it echoes back', async () => {
  const res = await handleQuote(
    post({ ...VALID, requirement: '<script>alert(1)</script>' }, { accept: 'text/html' }),
    ENV,
    stub()
  );
  const html = await res.text();
  assert.doesNotMatch(html, /<script>alert/);
});

test('an oversized declared body is refused before it is parsed', async () => {
  const req = new Request('https://www.aerolift-cranes.com/api/quote', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Length': String(2 * 1024 * 1024) },
    body: formOf(VALID),
  });
  const send = stub();
  const res = await handleQuote(req, ENV, send);
  assert.equal(res.status, 413);
  assert.equal(send.calls.length, 0);
});
