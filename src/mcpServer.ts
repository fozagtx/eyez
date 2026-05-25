#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createArcPaymentClient,
  getClientPrivateKey,
} from "./arc.js";

type ArcPaymentClient = ReturnType<typeof createArcPaymentClient>;

interface PaidCaptureResult {
  title?: string;
  url?: string;
  capturedAt?: string;
  captureTimeMs?: number;
  payment?: {
    price?: string;
    network?: string;
  };
  refund?: {
    amount?: string;
    reason?: string;
    transaction?: string;
  };
  content?: string;
}

const EVM_PRIVATE_KEY = getClientPrivateKey();
const SERVER_URL =
  process.env.EYEZ_URL ||
  "http://localhost:3001";

// Setup x402 payment client
let httpClient: ArcPaymentClient["httpClient"] | null = null;
let client: ArcPaymentClient["client"] | null = null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getPaymentClient(): {
  client: ArcPaymentClient["client"] | null;
  httpClient: ArcPaymentClient["httpClient"] | null;
} {
  if (!client && EVM_PRIVATE_KEY) {
    const paymentClient = createArcPaymentClient(EVM_PRIVATE_KEY);
    client = paymentClient.client;
    httpClient = paymentClient.httpClient;
  }
  return { client, httpClient };
}

async function paidCapture(url: string): Promise<PaidCaptureResult> {
  const { client, httpClient } = getPaymentClient();
  if (!client || !httpClient) {
    throw new Error("EVM_PRIVATE_KEY or ARC_PRIVATE_KEY not set - cannot make x402 payments");
  }

  const captureEndpoint = `${SERVER_URL}/capture?url=${encodeURIComponent(url)}`;

  // Step 1: Get 402 response
  const firstTry = await fetch(captureEndpoint);
  if (firstTry.status !== 402) {
    return (await firstTry.json()) as PaidCaptureResult;
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

  return (await resp.json()) as PaidCaptureResult;
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
        content: [{ type: "text", text: `Error: ${getErrorMessage(err)}` }],
        isError: true,
      };
    }
  },
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
