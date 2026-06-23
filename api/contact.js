'use strict';
const { cors, preflight, json, apiError, readBody, rateLimited, clientIp } = require('../lib/anvil');

// POST /api/contact
// First-party lead intake for the Anvil marketing site. Accepts the contact /
// access-request modal payload and forwards it to the internal ops address via
// Resend. Same-origin: the marketing forms POST here directly, no cross-domain
// redirect, no lost leads.
//
// Fields (match the marketing forms exactly): name, email, organization, message.
// Optional: source (which surface the lead came from). Honeypot: company_website.
//   -> 201 { ok: true }   on success
//   -> 400 { error }      on invalid email / honeypot
//   -> 500 { error }      on upstream send failure (form shows a real error)

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'Kinetic Anvil <noreply@kineticanvil.com>';
const TO_ADDRESS = 'dow@kineticpartners.org';

function validEmail(s) {
  return typeof s === 'string' && s.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);

  if (req.method !== 'POST') {
    return apiError(res, 405, 'method_not_allowed', 'Use POST to submit an inquiry.');
  }

  const ip = clientIp(req);
  if (rateLimited('contact:' + ip, 8, 60000)) {
    res.setHeader('Retry-After', '60');
    return apiError(res, 429, 'rate_limited', 'Too many submissions from your network. Wait a minute and try again.');
  }

  const body = (await readBody(req)) || {};
  const name = (body.name || '').toString().slice(0, 200);
  const email = (body.email || '').toString().slice(0, 320);
  const organization = (body.organization || '').toString().slice(0, 200);
  const message = (body.message || '').toString().slice(0, 5000);
  const source = (body.source || '').toString().slice(0, 80) || 'site';
  const company_website = (body.company_website || '').toString();

  // Honeypot: bots fill this. Silently accept so they get no signal.
  if (company_website.trim() !== '') {
    return json(res, 201, { ok: true });
  }

  if (!validEmail(email)) {
    return apiError(res, 400, 'invalid_email', 'A valid email is required.');
  }

  const messageText = message.trim() || '(no message provided)';
  const subject = `New Anvil inquiry [${source}]: ${(organization || email).trim()}`;

  const bodyText = [
    `Source:       ${source}`,
    `Name:         ${name || '(not provided)'}`,
    `Email:        ${email}`,
    `Organization: ${organization || '(not provided)'}`,
    `Message:\n${messageText}`,
  ].join('\n');

  const bodyHtml = `
<p><strong>Source:</strong> ${escHtml(source)}</p>
<p><strong>Name:</strong> ${escHtml(name || '(not provided)')}</p>
<p><strong>Email:</strong> ${escHtml(email)}</p>
<p><strong>Organization:</strong> ${escHtml(organization || '(not provided)')}</p>
<p><strong>Message:</strong></p>
<pre style="font-family:inherit;white-space:pre-wrap">${escHtml(messageText)}</pre>
`.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY not set - lead not delivered:', JSON.stringify({ name, email, organization, source }));
    return apiError(res, 500, 'contact_delivery_failed', 'Inquiry could not be delivered. Please email dow@kineticpartners.org directly.');
  }

  let sendRes;
  try {
    sendRes = await fetch(RESEND_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: email,
        subject,
        text: bodyText,
        html: bodyHtml,
      }),
    });
  } catch (err) {
    console.error('[contact] Resend fetch error:', String(err && err.message));
    return apiError(res, 500, 'contact_delivery_failed', 'Inquiry could not be delivered. Please email dow@kineticpartners.org directly.');
  }

  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '');
    console.error('[contact] Resend API error:', sendRes.status, detail);
    return apiError(res, 500, 'contact_delivery_failed', 'Inquiry could not be delivered. Please email dow@kineticpartners.org directly.');
  }

  return json(res, 201, { ok: true });
};
