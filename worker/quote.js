/**
 * Aerolift — quote form backend (POST /api/quote).
 *
 * Sends the enquiry to sales@ through the MailChannels Email API and answers
 * the browser. Nothing is stored: if the send fails, the request fails loudly
 * so main.js can fall back to the visitor's own mail client with their text
 * intact.
 *
 * MAILCHANNELS IS NO LONGER THE FREE KEYLESS INTEGRATION
 * -----------------------------------------------------
 * The old Cloudflare/MailChannels partnership — no account, no key, authorised
 * by a Domain Lockdown TXT record alone — was discontinued in 2024. What this
 * talks to is the paid MailChannels Email API, which authenticates with an API
 * key in `X-Api-Key`. Every tutorial that POSTs to this endpoint with no key is
 * describing the dead integration. See DEPLOY.md for the account and DNS setup.
 *
 * WHY THIS BUILDS RESPONSES WHEN worker/index.js SAYS NOT TO
 * ---------------------------------------------------------
 * index.js passes asset responses through untouched so the `_headers` CSP
 * survives. That rule is about ASSETS. These replies are generated, so no
 * `_headers` rule reaches them and they carry their own headers — see
 * SECURITY_HEADERS below. A generated reply that forgot them would be the one
 * document on the site with no CSP.
 */

const ENDPOINT = 'https://api.mailchannels.net/tx/v1/send';

// 16 KiB. The longest honest enquiry is a few hundred bytes; this only has to
// sit below the point where parsing a hostile body costs anything.
const MAX_BODY_BYTES = 16 * 1024;

const FIELD_LIMITS = {
  name: 120,
  company: 160,
  phone: 40,
  email: 254, // RFC 5321 maximum path length
  requirement: 60,
  message: 5000,
  page: 200,
};

const REQUIREMENTS = {
  'eot-crane': 'EOT crane — single or double girder',
  'gantry-crane': 'Gantry or semi-gantry crane',
  'jib-crane': 'Jib crane — wall or pillar mounted',
  hoist: 'Wire rope hoist (MT-series)',
  'spare-parts': 'Spare parts',
  installation: 'Installation or refurbishment',
  amc: 'Annual Maintenance Contract',
  emergency: 'Emergency breakdown',
  other: 'Something else',
};

// Deliberately stricter than the RFC: one @, no spaces, a dotted domain. A
// valid address this rejects is a cost worth paying, because this string goes
// into the Reply-To of a message sent on Aerolift's behalf.
const EMAIL = /^[^\s@,;:<>"'\\]+@[^\s@,;:<>"'\\.]+(\.[^\s@,;:<>"'\\.]+)+$/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Cache-Control': 'no-store',
};

/** CR and LF are how a value smuggles itself into a header. Nothing the
 *  visitor types needs them outside the message body. */
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();

const clamp = (s, max) => (s.length > max ? s.slice(0, max) : s);

function readField(form, name) {
  const raw = form.get(name);
  if (typeof raw !== 'string') return '';
  return clamp(raw.trim(), FIELD_LIMITS[name] || 200);
}

/**
 * Returns { ok: true, data } or { ok: false, errors: [field, …] }.
 * Exported so the shaping and the validation can be tested without a network.
 */
export function readEnquiry(form) {
  const data = {
    name: oneLine(readField(form, 'name')),
    company: oneLine(readField(form, 'company')),
    phone: oneLine(readField(form, 'phone')),
    email: oneLine(readField(form, 'email')),
    requirement: oneLine(readField(form, 'requirement')),
    // The body is the one place newlines belong — the visitor wrote them.
    message: readField(form, 'message'),
    page: oneLine(readField(form, 'page')),
  };

  const errors = [];
  for (const f of ['name', 'company', 'phone', 'email', 'requirement', 'message']) {
    if (!data[f]) errors.push(f);
  }
  if (data.email && !EMAIL.test(data.email)) errors.push('email');
  // An unknown value means a tampered or stale form, not a typo.
  if (data.requirement && !REQUIREMENTS[data.requirement]) errors.push('requirement');

  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, data };
}

/** The MailChannels payload. text/plain only — there is no HTML part, so
 *  nothing the visitor typed is ever parsed as markup by the reader. */
export function buildPayload(data, { to, from }) {
  const body = [
    `Name:        ${data.name}`,
    `Company:     ${data.company}`,
    `Phone:       ${data.phone}`,
    `Email:       ${data.email}`,
    `Requirement: ${REQUIREMENTS[data.requirement]}`,
    data.page ? `Sent from:   ${data.page}` : null,
    '',
    'Details',
    '-------',
    data.message,
    '',
    '--',
    'Sent by the quote form on aerolift-cranes.com.',
    'Reply to this message and it goes straight back to the sender.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    personalizations: [{ to: [{ email: to, name: 'Aerolift Sales' }] }],
    from: { email: from, name: 'Aerolift Website' },
    // The visitor's address goes here, never in `from`: `from` has to stay on
    // a domain the DKIM key and Domain Lockdown record authorise, or the
    // message is unauthenticated and lands in spam.
    reply_to: { email: data.email, name: data.name },
    subject: oneLine(`Quote request — ${data.company} (${REQUIREMENTS[data.requirement]})`),
    content: [{ type: 'text/plain', value: body }],
  };
}

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS },
  });

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * The no-JavaScript reply. A native form submit cannot read JSON, and sending
 * it back to the page it came from would show the empty form again with no
 * sign of what happened. This is deliberately plain — it reuses the site
 * stylesheet and nothing else, so it cannot break when the design changes.
 */
function htmlReply(status, { heading, body }) {
  const page = `<!doctype html>
<html lang="en-AE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(heading)} — Aerolift</title>
<link rel="stylesheet" href="/css/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body class="bg-surface">
<main class="mx-auto max-w-xl px-6 py-24">
  <h1 class="text-3xl text-primary">${esc(heading)}</h1>
  <p class="mt-4 text-steel-strong">${body}</p>
  <p class="mt-8"><a href="/" class="link-underline font-semibold">Back to aerolift-cranes.com</a></p>
</main>
</body>
</html>`;
  return new Response(page, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
  });
}

const CALL_US =
  'Please call <a class="link-underline font-semibold" href="tel:+971557029550">+971 55 702 9550</a> ' +
  'or email <a class="link-underline font-semibold" href="mailto:sales@aerolift-cranes.com">sales@aerolift-cranes.com</a>.';

/**
 * @param {Request} request
 * @param {{MAILCHANNELS_API_KEY?: string, QUOTE_TO?: string, QUOTE_FROM?: string}} env
 * @param {typeof fetch} [send] injected in tests so the shaping can be checked
 *        offline — MailChannels only accepts requests from Cloudflare IPs, so
 *        a real call cannot be made from a laptop or a CI runner.
 */
export async function handleQuote(request, env, send = fetch) {
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  const fail = (status, message, heading = 'Your request was not sent') =>
    wantsJson
      ? json(status, { ok: false, error: message })
      : htmlReply(status, { heading, body: `${esc(message)} ${CALL_US}` });

  if (request.method !== 'POST') {
    const res = fail(405, 'This address only accepts a submitted quote form.');
    res.headers.set('Allow', 'POST');
    return res;
  }

  // A cross-site POST has no legitimate reason to land here. Browsers omit
  // Origin on some same-origin navigations, so an absent header is allowed
  // through — this rejects the forged case, it is not an auth check.
  const origin = request.headers.get('Origin');
  if (origin) {
    const host = new URL(request.url).host;
    let ok = false;
    try { ok = new URL(origin).host === host; } catch { ok = false; }
    if (!ok) return fail(403, 'That request did not come from this site.');
  }

  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY_BYTES) return fail(413, 'That enquiry is too long to send.');

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'That submission could not be read.');
  }

  // Honeypot. A filled `_gotcha` is a bot, and a bot that is told it failed
  // simply retries with the field blank. It gets the success page instead.
  if (oneLine(form.get('_gotcha') || '')) {
    return wantsJson
      ? json(202, { ok: true })
      : htmlReply(200, { heading: 'Request received', body: 'Thank you — our team will be in touch.' });
  }

  const parsed = readEnquiry(form);
  if (!parsed.ok) {
    return wantsJson
      ? json(422, { ok: false, error: 'Some fields need checking.', fields: parsed.errors })
      : htmlReply(422, {
          heading: 'Your request was not sent',
          body: `These fields need checking: ${esc(parsed.errors.join(', '))}. ${CALL_US}`,
        });
  }

  const apiKey = env.MAILCHANNELS_API_KEY;
  if (!apiKey) {
    // Deploying without the secret is a configuration mistake, not a visitor
    // mistake. Say so in the log and give the visitor a route that works.
    console.error('quote: MAILCHANNELS_API_KEY is not set — enquiry not sent');
    return fail(503, 'The enquiry form is temporarily unavailable.');
  }

  const payload = buildPayload(parsed.data, {
    to: env.QUOTE_TO || 'sales@aerolift-cranes.com',
    from: env.QUOTE_FROM || 'website@aerolift-cranes.com',
  });

  let res;
  try {
    res = await send(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('quote: MailChannels request threw', err && err.message);
    return fail(502, 'Your request could not be sent just now.');
  }

  // 202 Accepted is the success case — the API has taken the message, not
  // delivered it. Treating only 2xx as success keeps that honest.
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`quote: MailChannels returned ${res.status}`, detail.slice(0, 500));
    return fail(502, 'Your request could not be sent just now.');
  }

  return wantsJson
    ? json(202, { ok: true })
    : htmlReply(200, {
        heading: 'Request received',
        body:
          'Thank you. Our team will review the details and come back to you by email. ' +
          'If this is an equipment breakdown, call ' +
          '<a class="link-underline font-semibold" href="tel:+971557029550">+971 55 702 9550</a> ' +
          'for the 24/7 response team.',
      });
}
