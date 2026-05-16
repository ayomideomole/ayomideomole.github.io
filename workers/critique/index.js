/**
 * Critique simulator — Cloudflare Worker proxy to Anthropic.
 *
 * POST JSON { image?: dataURL, text?: string }
 * → 200 JSON { voices: [{name, critique}], common_thread }
 *
 * Rate-limited per IP per day via Cloudflare KV (binding: RATE_LIMIT_KV).
 * CORS locked to ALLOWED_ORIGINS.
 * Anthropic key stored as secret ANTHROPIC_API_KEY.
 */

const ALLOWED_ORIGINS = [
  'https://ayomideomole.github.io',
  'https://ayoomole.xyz',
  'http://localhost:4321',
  'http://localhost:4322',
];

const RATE_LIMIT = 5; // requests per IP per day
const MODEL = 'claude-sonnet-4-5';
const MAX_PAYLOAD_BYTES = 6 * 1024 * 1024; // 6MB room for a 5MB image after base64

const SYSTEM_PROMPT = `You are a design critique engine. Given a UI design (image or description), produce a critique from three distinct voices.

THE THREE VOICES:

1. Strict reviewer — a senior product designer with high standards. Cares deeply about craft: type hierarchy, spacing, alignment, color, accessibility, microcopy. Direct but not cruel. References principles when relevant ("information hierarchy is unclear because…"). Specific over generic.

2. Pragmatic PM — a product manager focused on outcomes. Cares about user task success, conversion friction, edge cases, business goals, scope. Asks "what's this for?" and "what happens when X?". Identifies unstated assumptions and the metrics that would tell you it's working.

3. Curious user — a real person, first-time encounter, no context. Reads everything literally. Confused or delighted in specific ways. Asks questions the team didn't think of. Uses everyday language, not design jargon ("I clicked the button but nothing happened?").

INSTRUCTIONS:

For each voice, write 90–160 words of critique. Reference SPECIFIC visible elements (button placement, color choices, hierarchy decisions, copy). Avoid generic advice. End each voice with ONE concrete suggestion.

After the three voices, write a "common_thread" of 30–50 words identifying the one or two issues all three voices raised. This is the "if you only fix one thing, fix this" insight.

RETURN ONLY this exact JSON structure, no preamble, no markdown fences, no explanation:

{
  "voices": [
    {"name": "Strict reviewer", "critique": "…"},
    {"name": "Pragmatic PM", "critique": "…"},
    {"name": "Curious user", "critique": "…"}
  ],
  "common_thread": "…"
}

If you can't see a meaningful UI in the image (random photo, chart, plain text, etc.), respond with:

{
  "voices": [
    {"name": "Strict reviewer", "critique": "I can't see a UI to critique here. Drop a screenshot of an actual interface — a screen, a page, a component — and I'll dig in."},
    {"name": "Pragmatic PM", "critique": "Same. Send the screen users would actually encounter, not the data behind it."},
    {"name": "Curious user", "critique": "Where's the thing I'm supposed to use?"}
  ],
  "common_thread": "Show the interface, not the input."
}`;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return jsonError('Method not allowed.', 405, cors);
    }

    // Size guard before we even parse
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return jsonError('Payload too large. Keep images under ~5MB.', 413, cors);
    }

    // Rate limit
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const rlKey = `rl:${ip}:${day}`;
    const current = parseInt((await env.RATE_LIMIT_KV.get(rlKey)) || '0', 10);
    if (current >= RATE_LIMIT) {
      return jsonError(`You've used ${RATE_LIMIT} critiques today. Try again tomorrow.`, 429, cors);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Body must be JSON.', 400, cors);
    }

    const image = typeof body.image === 'string' ? body.image : '';
    const text = typeof body.text === 'string' ? body.text.slice(0, 1500) : '';
    if (!image && !text) {
      return jsonError('Send an image or some text describing the design.', 400, cors);
    }

    // Build user content
    const userContent = [];
    if (image) {
      const match = image.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
      if (!match) {
        return jsonError('Image must be a base64 data URL (PNG, JPEG, WebP, or GIF).', 400, cors);
      }
      const mediaType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: match[2] },
      });
    }
    const promptText = text
      ? `Context from the designer: ${text}\n\nCritique this UI.`
      : 'Critique this UI.';
    userContent.push({ type: 'text', text: promptText });

    // Call Anthropic
    let claudeData;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2400,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      if (!r.ok) {
        const errBody = await r.text().catch(() => '');
        console.log('Anthropic error', r.status, errBody.slice(0, 500));
        return jsonError(`Claude returned ${r.status}. Try again in a moment.`, 502, cors);
      }
      claudeData = await r.json();
    } catch (err) {
      console.log('Network error', err && err.message);
      return jsonError('Network error reaching Claude. Try again.', 502, cors);
    }

    const raw = claudeData?.content?.[0]?.text || '';
    const parsed = parseCritique(raw);
    if (!parsed) {
      console.log('Parse failure. Raw:', raw.slice(0, 500));
      return jsonError('Claude returned an unexpected response. Try again.', 502, cors);
    }

    // Only charge the rate limit on success
    await env.RATE_LIMIT_KV.put(rlKey, String(current + 1), { expirationTtl: 86400 });

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  },
};

function parseCritique(raw) {
  if (!raw) return null;
  // Find the outermost JSON object even if model wrapped it in prose or fences
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    if (
      obj &&
      Array.isArray(obj.voices) &&
      obj.voices.length === 3 &&
      obj.voices.every((v) => v && typeof v.name === 'string' && typeof v.critique === 'string') &&
      typeof obj.common_thread === 'string'
    ) {
      return obj;
    }
  } catch {}
  return null;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function jsonError(message, status, cors) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
