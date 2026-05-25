<div align="center">
  <img src="./docs/images/arcIcon.svg" alt="Arc Logo" width="200"/>
</div>

<br/>

Pay per capture Model Context Protocol (MCP) server that enables AI agents to capture JavaScript-heavy webpages through x402 payments on Arc Testnet USDC.

![Agent vision flow: sense, see, think, interact](./docs/images/agentVisionFlow.png)

## Space Config

| Field | Value |
| --- | --- |
| title | `eyez` |
| emoji | `👁️` |
| colorFrom | `blue` |
| colorTo | `purple` |
| sdk | `docker` |
| app_port | `7860` |

## How Agents Use eyez

The hosted MCP endpoint is:

```text
https://pima5-eyez.hf.space/mcp
```

An MCP-capable agent connects to that endpoint, discovers the `capturePage` tool, and calls it whenever normal HTTP fetch is not enough.

```json
{
  "tool": "capturePage",
  "arguments": {
    "url": "https://example.com"
  }
}
```

The flow is:

1. The user asks the agent to inspect a public webpage.
2. The agent calls `capturePage` with the page URL.
3. eyez requests the paid `/capture` endpoint.
4. x402 payment is created and settled on Arc Testnet USDC.
5. eyez opens the page in a browser, waits for JavaScript content, extracts structured text, and returns it to the agent.
6. The agent uses the returned title, headings, links, and content in its answer or workflow.

Returned content looks like:

```json
{
  "title": "Example Domain",
  "url": "https://example.com",
  "capturedAt": "2026-05-25T12:00:00.000Z",
  "captureTimeMs": 3325,
  "payment": {
    "price": "$0.001",
    "network": "eip155:5042002"
  },
  "content": "Example Domain..."
}
```

For the public Hugging Face Space, payments use the wallet configured in the Space secrets. For production use, add auth or per-user payment keys before opening access broadly.

## What It Provides

- JavaScript-heavy webpage capture
- Paid browser captures through x402
- Structured page extraction for titles, descriptions, headings, links, and text
- MCP tool support with `capturePage`
- Arc Testnet USDC payments
- Automatic refund attempts for failed captures
- Demo scripts for capture testing and log generation
- Docker deployment support

---

## API

### `GET /`

Free service information.

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

---

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Server Configuration
PORT=3001

# Network Configuration
ARC_RPC_URL=https://rpc.testnet.arc.network

# Payment Configuration
PAY_TO=0xYourPublicAddress
FACILITATOR_PRIVATE_KEY=0xYourPrivateKey
EVM_PRIVATE_KEY=0xYourPrivateKey

# Optional Refund Configuration
REFUND_PRIVATE_KEY=0xYourPrivateKey

# Optional Price Configuration
PRICE_USDC=0.001
REFUND_AMOUNT_USDC=0.001
```

See `.env.example` for a template.

---

## Network Information

### Arc Testnet

- **Network:** Arc Testnet
- **Chain ID:** `5042002`
- **x402 Network:** `eip155:5042002`
- **RPC URL:** `https://rpc.testnet.arc.network`
- **Explorer:** `https://testnet.arcscan.app`
- **Native Token:** USDC
- **USDC Asset:** `0x3600000000000000000000000000000000000000`

---

## Project Structure

```text
eyez/
├── docs/                  # Static documentation and demo logs
│   ├── demoOutput/
│   ├── images/
│   ├── index.html
│   └── eyez.html
├── src/
│   ├── arc.ts             # Arc Testnet and x402 helpers
│   ├── captureEngine.ts   # Browser capture engine
│   ├── demoClient.ts      # Demo capture client
│   ├── mcpServer.ts       # MCP server with capturePage tool
│   ├── refund.ts          # Refund handling
│   ├── saveDemo.ts        # Demo log generator
│   └── server.ts          # Express API and x402 payment middleware
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── WALLET.md
├── deriveArcAddress.cjs
├── eyezMcpStdio.example.json
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── smithery.yaml
```

---

## Docker Support

Build and run with Docker:

```bash
# Build Docker image
docker build -t eyez .

# Run container
docker run --rm -p 7860:7860 --env-file .env -e PORT=7860 eyez
```

---

## Deployment

### Hugging Face Spaces

This repository is ready for a Docker Space. The active Space uses:

```yaml
sdk: docker
app_port: 7860
```

Set these Space secrets before starting the app:

- `PAY_TO`
- `FACILITATOR_PRIVATE_KEY`
- `EVM_PRIVATE_KEY`

Optional Space secrets:

- `ARC_RPC_URL`
- `RPC`
- `REFUND_PRIVATE_KEY`
- `PRICE_USDC`
- `REFUND_AMOUNT_USDC`

After the Space builds, test:

```bash
curl https://pima5-eyez.hf.space/health
```

### MCP Server

Deploy the server on any platform that supports Docker containers.

**Important:** Set `PAY_TO`, `FACILITATOR_PRIVATE_KEY`, and `EVM_PRIVATE_KEY` as environment variables in your deployment platform. Do not hardcode private keys in the Dockerfile.

### Documentation Site

The `docs/` folder contains a static HTML documentation site.

**Quick Deploy:**

- GitHub Pages
- Vercel
- Netlify
- Any static host that can serve the `docs/` directory

---

## Resources

- [Arc Testnet Explorer](https://testnet.arcscan.app)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [x402](https://www.x402.org/)

---

## License

MIT License

---

## Security Considerations

**Important Security Notes:**

1. **Private Keys:** Never commit `FACILITATOR_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, or `REFUND_PRIVATE_KEY` to version control
2. **Environment Variables:** Use secure secret management for production
3. **API Access:** Limit MCP server access to trusted agents
4. **Payment Address:** Verify `PAY_TO` before accepting payments
5. **Testnet First:** Always test capture and payment flows on Arc Testnet

---

## Troubleshooting

### Connection Issues

- Verify `ARC_RPC_URL` is accessible
- Confirm the server is running on the expected `PORT`
- Ensure `EYEZ_URL` points to the running server when using MCP

### Payment Failures

- Verify `PAY_TO` is a valid Arc-compatible EVM address
- Check `FACILITATOR_PRIVATE_KEY` is set on the server
- Check `EVM_PRIVATE_KEY` is set for demo and MCP clients
- Ensure the client wallet has enough Arc Testnet USDC

### Capture Failures

- Use a public `http` or `https` URL
- Test with `https://example.com`
- Review generated logs in `docs/demoOutput/`

---

<div align="center">
  <p>Made for agent-friendly browser capture on Arc</p>
</div>
