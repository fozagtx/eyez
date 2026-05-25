---
title: eyez
emoji: 👁️
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
---

# eyez

Pay per capture browser API powered by x402 payments on Arc Testnet USDC.

## Why Agents Need This

Most agents can fetch HTML, but many modern sites need a browser engine before useful text appears. eyez gives agents a paid HTTP endpoint for that heavier browser work without asking every agent runtime to ship Chromium and system dependencies.

An agent pays `0.001 USDC` and receives structured page content: title, description, headings, links, text, timing, and payment metadata.

## Network

| Field | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| x402 network | `eip155:5042002` |
| Currency | `USDC` |
| USDC asset | `0x3600000000000000000000000000000000000000` |
| Explorer | `https://testnet.arcscan.app` |

## API

### `GET /`

Free service info.

### `GET /health`

Free health check.

### `GET /capture?url=<encoded_url>`

Paid endpoint. Public `http` and `https` URLs only.

Example response:

```json
{
  "title": "Example Domain",
  "description": "",
  "headings": [{ "level": "H1", "text": "Example Domain" }],
  "links": [{ "text": "Learn more", "href": "https://www.iana.org/domains/example" }],
  "content": "Example Domain...",
  "url": "https://example.com",
  "capturedAt": "2026-05-25T12:00:00.000Z",
  "captureTimeMs": 3325,
  "payment": { "price": "$0.001", "network": "eip155:5042002" }
}
```

## Setup

```bash
npm install
cp .env.example .env
```

Set:

```bash
PAY_TO=0xYourPublicAddress
FACILITATOR_PRIVATE_KEY=your_private_key
EVM_PRIVATE_KEY=your_private_key
```

Optional RPC:

```bash
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
```

## Run

```bash
npm start
```

In another shell:

```bash
npm run demo -- https://example.com
```

To refresh demo logs:

```bash
SERVER_URL=http://localhost:3001 npm run demo:logs -- https://x.com/circle
```

The generated files live in `demoOutput/`.

## MCP

Example MCP config:

```json
{
  "mcpServers": {
    "eyez": {
      "command": "node",
      "args": ["/path/to/eyez/mcpServer.js"],
      "env": {
        "EVM_PRIVATE_KEY": "0x...",
        "EYEZ_URL": "http://localhost:3001"
      }
    }
  }
}
```

The MCP tool is `capturePage`.
