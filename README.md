This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## RTX AI Server

MovieSeeker can use the locally installed `qwen3.5:9b` model to translate a
Thai or English natural-language request into the site's existing TMDB Genre
and keyword filters. It also evaluates story-level conditions that Genre
cannot prove, such as `ตอนจบไม่เศร้า`, after the TMDB candidate list is ready.
For those conditions the RTX service researches plot information through the
public MediaWiki API, returns true/false/unknown facts, and MovieSeeker only
keeps titles that satisfy every requested condition with sufficient
confidence. Confidence-qualified facts are tied to the title/year identity
and cached in Supabase so later searches can reuse them without running the
model again.

Interactive requests are never queued: if the AI server is offline, busy,
times out, or returns an invalid response, the Next.js route immediately uses
the deterministic Genre result instead.

The browser never calls Ollama or the RTX machine directly:

```text
Browser -> Vercel /api/search/intent   -> private RTX endpoint -> Ollama
                                  \-> Genre fallback (no queue)

Browser -> Vercel /api/search/semantic -> Supabase fact cache
                                      -> private RTX endpoint
                                         -> Wikipedia plot research -> Ollama
                                      \-> Genre fallback (no queue)
```

### Run locally

Ollama must already be running with `qwen3.5:9b`. Set a long random shared
secret in the terminal that starts the AI server, then run:

```powershell
$env:MOVIESEEKER_AI_TOKEN="replace-with-a-long-random-secret"
npm run ai:server
```

The server binds to `127.0.0.1:4317`, warms the model, exposes `GET /health`,
and accepts authenticated `POST /v1/intent` and `POST /v1/semantic-filter`
requests. It handles one LLM request at a time; concurrent requests receive
`503`, which deliberately activates the Genre fallback instead of building a
backlog.

For local Next.js development, copy the relevant values from `.env.example`
into `.env.local` and set:

```text
MOVIESEEKER_AI_SERVER_URL=http://127.0.0.1:4317
MOVIESEEKER_AI_SERVER_TOKEN=replace-with-the-same-secret
```

For the public Vercel deployment, `MOVIESEEKER_AI_SERVER_URL` must be an HTTPS
tunnel to this local service and the matching token must be set as a server-side
Vercel environment variable. Do not expose Ollama port 11434 or put either
token in a `NEXT_PUBLIC_` variable.

### Start the public RTX server on Windows

After `cloudflared` is installed, the Windows host can start the complete public
AI path with one command:

```powershell
npm run ai:public
```

The script stores the shared token with Windows DPAPI under the current user's
local application data, starts Ollama/Qwen and the authenticated AI service,
creates a Cloudflare Quick Tunnel, updates the two Vercel Production secrets,
and redeploys the current production alias. It never writes the token to Git.

Quick Tunnel URLs change whenever the connector restarts, so the script updates
Vercel and redeploys on each start. A named Cloudflare Tunnel on a domain owned
by the project should replace this temporary connector before high-traffic
production use. If startup or connectivity fails, Vercel continues with the
deterministic Genre fallback and does not queue AI requests.
