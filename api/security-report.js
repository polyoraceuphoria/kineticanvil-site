'use strict';
const { cors, preflight, json, apiError, readBody, rateLimited, clientIp } = require('../lib/anvil');

// POST /api/security-report
// Responsible-disclosure intake (the form on /trust and /contact). Forwards the
// report to the internal security address via Resend. Same-origin, first-party.
//
// Fields: email (optional), details (the report body). Honeypot: company_website.
//   -> 201 { ok: true }   on success
//   -> 400 { error }      on empty report / honeypot
//   -> 500 { error }      on upstream send failure

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'Kinetic Anvil Security <noreply@kineticanvil.com>';
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
    return apiError(res, 405, 'method_not_allowed', 'Use POST to submit a report.');
  }

  const ip = clientIp(req);
  if (rateLimited('secrep:' + ip, 8, 60000)) {
    res.setHeader('Retry-After', '60');
    return apiError(res, 429, 'rate_limited', 'Too many submissions from your network. Wait a minute and try again.');
  }

  const body = (await readBody(req)) || {};
  const email = (body.email || '').toString().slice(0, 320);
  // Accept a few field names the forms may use for the report body.
  const details = (body.details || body.report || body.message || '').toString().slice(0, 10000);
  const company_website = (body.company_website || '').toString();

  if (company_website.trim() !== '') {
    return json(res, 201, { ok: true });
  }

  if (!details.trim()) {
    return apiError(res, 400, 'empty_report', 'A report description is required.');
  }

  const reporter = validEmail(email) ? email : '(anonymous / no email)';
  const subject = `Security report: ${reporter}`;

  const bodyText = [
    `Reporter email: ${reporter}`,
    `Report:\n${details.trim()}`,
  ].join('\n');

  const bodyHtml = `
<p><strong>Reporter email:</strong> ${escHtml(reporter)}</p>
<p><strong>Report:</strong></p>
<pre style="font-family:inherit;white-space:pre-wrap">${escHtml(details.trim())}</pre>
`.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[security-report] RESEND_API_KEY not set - report not delivered.');
    return apiError(res, 500, 'report_delivery_failed', 'Report could not be delivered. Please email dow@kineticpartners.org directly.');
  }

  let sendRes;
  try {
    sendRes = await fetch(RESEND_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: validEmail(email) ? email : undefined,
        subject,
        text: bodyText,
        html: bodyHtml,
      }),
    });
  } catch (err) {
    console.error('[security-report] Resend fetch error:', String(err && err.message));
    return apiError(res, 500, 'report_delivery_failed', 'Report could not be delivered. Please email dow@kineticpartners.org directly.');
  }

  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '');
    console.error('[security-report] Resend API error:', sendRes.status, detail);
    return apiError(res, 500, 'report_delivery_failed', 'Report could not be delivered. Please email dow@kineticpartners.org directly.');
  }

  return json(res, 201, { ok: true });
};
