# Critique worker

Cloudflare Worker that proxies a UI critique request to Anthropic's Claude API. Rate-limited per IP per day via Cloudflare KV. CORS-locked to the ayoomole sites.

## Deploy (one-time, ~10 minutes)

```bash
# 1. From repo root
cd workers/critique

# 2. Install wrangler if you don't have it
npm install -g wrangler

# 3. Log in to Cloudflare (browser opens; sign in / sign up for free)
wrangler login

# 4. Create the KV namespace used for rate limiting
wrangler kv namespace create RATE_LIMIT_KV
# → prints something like: id = "abc123def..."
# Copy that id into wrangler.toml, replacing REPLACE_WITH_KV_NAMESPACE_ID

# 5. Set your Anthropic key as a secret (prompts you to paste; never logged)
wrangler secret put ANTHROPIC_API_KEY

# 6. Deploy
wrangler deploy
# → prints the worker URL, e.g.
#   https://critique.<your-cf-subdomain>.workers.dev
```

Take that URL and paste it into `src/pages/play/critique-simulator.astro` as the `WORKER_URL` constant.

## Re-deploying after code changes

```bash
cd workers/critique
wrangler deploy
```

## Adjusting limits

- **Rate limit per IP per day:** edit `RATE_LIMIT` in `index.js`. Currently 5.
- **Max image size:** edit `MAX_PAYLOAD_BYTES` in `index.js`. Currently ~6MB (room for a 5MB image after base64).
- **Allowed origins:** edit `ALLOWED_ORIGINS` in `index.js`. Must include the site domain that calls the worker.

## Cost ceiling

Set a spending limit on your Anthropic key (console.anthropic.com → Settings → Limits). $5/month is plenty for showcase traffic — each critique costs roughly $0.003 with Claude Sonnet 4.5.

Cloudflare Workers free tier covers 100k requests/day, which you will not hit.
