// Vercel Serverless Function — emails proposal acceptances via Resend.
// Required env: RESEND_API_KEY. Optional: ACCEPT_TO (default info@dubaiincairo.com),
// ACCEPT_FROM (default uses Resend's shared onboarding sender).
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'accept', hint: 'POST a JSON acceptance to send it.' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    if (!b || typeof b !== 'object') b = {};
    const pick = (...keys) => {
      for (const k of keys) { if (b[k] != null && String(b[k]).trim() !== '') return String(b[k]).trim(); }
      return '';
    };
    const name = pick('name', 'from_name');
    const email = pick('email');
    const title = pick('title', 'Title');
    const company = pick('company', 'Company');
    const phone = pick('phone', 'Phone');
    const note = pick('note', 'Message');
    const proposal = pick('proposal', 'Proposal');
    const total = pick('total', 'Total');

    if (!name || !email || email.indexOf('@') < 0) {
      res.status(400).json({ error: 'Name and a valid email are required.' });
      return;
    }
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      res.status(500).json({ error: 'Email service is not configured (missing RESEND_API_KEY).' });
      return;
    }
    const to = (process.env.ACCEPT_TO || 'info@dubaiincairo.com').split(',').map((s) => s.trim()).filter(Boolean);
    const from = process.env.ACCEPT_FROM || 'Dubai in Cairo Proposals <onboarding@resend.dev>';

    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const row = (k, v) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#667;font:14px Arial,sans-serif;white-space:nowrap;vertical-align:top">${k}</td>` +
      `<td style="padding:6px 0;color:#111;font:14px Arial,sans-serif">${esc(v || '—')}</td></tr>`;
    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:560px">` +
      `<h2 style="margin:0 0 4px">Proposal ${esc(proposal)} accepted &#9989;</h2>` +
      `<p style="margin:0 0 16px;color:#555">A client confirmed acceptance` +
      (total ? ` at the fixed total of <b>${esc(total)}</b> (VAT inclusive)` : '') + `.</p>` +
      `<table style="border-collapse:collapse;width:100%">` +
      row('Name', name) + row('Title', title) + row('Company', company) +
      row('Email', email) + row('Phone', phone) + row('Note', note) +
      `</table>` +
      `<p style="margin:18px 0 0;font-size:12px;color:#999">Sent automatically from the Dubai in Cairo proposal microsite.</p>` +
      `</div>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        reply_to: email,
        subject: `Proposal Acceptance — ${proposal || 'DIC'} — ${name}`,
        html,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(502).json({ error: 'Email could not be sent.', detail: data });
      return;
    }
    res.status(200).json({ success: true, id: data.id });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
