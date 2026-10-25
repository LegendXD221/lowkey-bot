# Lowkey

Premium Discord bypass bot with intelligent multi-provider routing, Neon PostgreSQL, circuit breakers, domain filters, and automatic channel unlock.

**v1.1.0**

## Features

- Slash commands for users and owners
- Configurable GET/POST API providers (auth, encoding, response-path extraction)
- **Domain patterns** per provider (`/api-patterns`) — prefer specific matchers
- Health-aware routing + circuit breakers + automatic failover
- Concurrency limits + one-shot network retry
- Service detection (Linkvertise, LootLabs, MediaFire, …)
- Autobypass channels (per-guild)
- Maintenance mode that survives restarts
- **Open Result / Mobile Copy / PC Copy** buttons on success
- Animated neon-pulse custom emoji pack with Unicode fallbacks and slot-aware installation
- SSRF protection, rate limits, secret redaction
- Structured logging, result cache, metrics

## Requirements

- Node.js 18+
- Neon (or any) PostgreSQL
- Discord application + bot token with **Message Content** intent

## Setup

```bash
cd lowkey
npm install
cp .env.example .env
# fill DISCORD_TOKEN, CLIENT_ID, DATABASE_URL, BOT_OWNER_IDS
npm run migrate
npm run deploy-commands
npm start
```

## Docker

```bash
docker build -t lowkey .
docker run --env-file .env -p 3000:3000 lowkey
```

## Hosting panel deployment

The bot can run on Pterodactyl, a VPS, Docker, or another always-on Node.js hosting panel. Install dependencies and start it with:

```bash
npm ci --omit=dev
npm start
```

Configure the environment variables from `.env.example`. The bot exposes `GET /health` as a liveness endpoint and `GET /ready` as a startup-readiness diagnostic. Set `PORT` to the port assigned by your hosting panel, then point UptimeRobot at `https://your-domain.example/health` if the health server is publicly reachable.

Slash commands synchronize automatically from the Discord `ready` event after startup. Text commands are also available with the default `-` prefix, such as `-bypass <url>` and `-health`; set `COMMAND_PREFIX` to change it. Keep the bot process running continuously and allow outbound HTTPS/WebSocket connections to Discord on port 443.

## Owner workflow

1. `/addapi` — register provider
2. `/api-patterns provider: patterns:linkvertise.com,loot-link.com` — scope it
3. `/testapi` — verify (secrets never shown)
4. `/toggleapi` / `/api-priority` — control routing
5. `/autobypass` — enable channel auto-processing
6. `/status` — dashboard
7. `/maintenance` — take offline for users
8. `/autobypass-global` — pause or resume automatic processing globally
9. `/api-reset` — reset a provider circuit after resolving an outage
10. `/emoji-setup` / `/emoji-status` — install and inspect the visual pack

## User commands

| Command | Description |
|---|---|
| `/bypass url:` | Unlock a supported link |
| `/inspect url:` | Validate and inspect a link without bypassing it |
| `/health` | Check bot, database, and WebSocket health |
| `/providers` | Known services + active provider count |
| `/help` | Command list |
| `/ping` | Latency |
| `/about` | Version / features |
| `/serverinfo` | Server details |
| `/invite` | Invite link |
| `/stats` | Public counters |
| `/privacy` | Data handling |

## Storage (Neon ~1 GB)

Defaults are tuned for small databases:

- Cache TTL **180s**, hard cap **2000** rows
- Automatic purge every **5 minutes** (expired cache + stale rate buckets)
- `/db-stats` — live size
- `/db-cleanup` — force purge

Avoid storing large response bodies; only result URLs are cached (max ~4 KB/entry).

## Tests

```bash
npm test
```

## License

MIT
