#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createArcPaymentClient,
  getClientPrivateKey,
} from "./arc.js";

const EVM_PRIVATE_KEY = getClientPrivateKey();
const SERVER_URL =
  process.env.EYEZ_URL ||
  "http://localhost:3001";

// Setup x402 payment client
let httpClient = null;
let client = null;

function getPaymentClient() {
  if (!client && EVM_PRIVATE_KEY) {
    const paymentClient = createArcPaymentClient(EVM_PRIVATE_KEY);
    client = paymentClient.client;
    httpClient = paymentClient.httpClient;
  }
  return { client, httpClient };
}

async function paidCapture(url) {
  const { client, httpClient } = getPaymentClient();
  if (!client) {
    throw new Error("EVM_PRIVATE_KEY or ARC_PRIVATE_KEY not set - cannot make x402 payments");
  }

  const captureEndpoint = `${SERVER_URL}/capture?url=${encodeURIComponent(url)}`;

  // Step 1: Get 402 response
  const firstTry = await fetch(captureEndpoint);
  if (firstTry.status !== 402) {
    return await firstTry.json();
  }

  // Step 2: Create payment
  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstTry.headers.get(name),
  );

  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  // Step 3: Send paid request
  const headers = httpClient.encodePaymentSignatureHeader(paymentPayload);
  const resp = await fetch(captureEndpoint, { method: "GET", headers });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Capture failed (${resp.status}): ${text}`);
  }

  return await resp.json();
}

// Create MCP server
const server = new McpServer({
  name: "eyez",
  version: "1.0.0",
});

server.tool(
  "capturePage",
  "Capture a JavaScript-heavy webpage using a headless browser. Pays $0.001 USDC on Arc per request via x402. Use this when standard HTTP fetch returns empty content from SPAs, Twitter/X, LinkedIn, DeFi apps, or Cloudflare-protected sites.",
  {
    url: z.string().url().describe("The URL to capture (must be public http/https)"),
  },
  async ({ url }) => {
    try {
      const result = await paidCapture(url);
      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\nURL: ${result.url}\nCaptured: ${result.capturedAt}\nCapture time: ${result.captureTimeMs}ms\nPayment: ${result.payment?.price} on ${result.payment?.network}${result.refund ? `\nRefund: ${result.refund.amount} - ${result.refund.reason} (tx: ${result.refund.transaction})` : ""}\n\n${result.content}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
