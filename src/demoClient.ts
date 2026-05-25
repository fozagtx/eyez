import "dotenv/config";
import {
  ARC_NETWORK,
  createArcPaymentClient,
  getClientPrivateKey,
} from "./arc.js";

const EVM_PRIVATE_KEY = getClientPrivateKey();
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const NETWORK = ARC_NETWORK;

if (!EVM_PRIVATE_KEY) {
  console.error("ERROR: EVM_PRIVATE_KEY or ARC_PRIVATE_KEY not set in .env");
  process.exit(1);
}

const targetUrl = process.argv[2] || "https://x.com/circle";

interface CaptureDemoResponse {
  title?: string;
  captureTimeMs?: number;
  content?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  if (!EVM_PRIVATE_KEY) {
    throw new Error("EVM_PRIVATE_KEY or ARC_PRIVATE_KEY not set in .env");
  }

  const captureEndpoint = `${SERVER_URL}/capture?url=${encodeURIComponent(targetUrl)}`;

  // Setup x402 client
  const { address, client, httpClient } =
    createArcPaymentClient(EVM_PRIVATE_KEY);

  console.log(`Target URL: ${targetUrl}`);
  console.log(`Capture endpoint: ${captureEndpoint}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Paying from: ${address}`);

  // Step 1: Request without payment; expect 402.
  console.log("\n--- Step 1: Request without payment ---");
  const firstTry = await fetch(captureEndpoint);
  console.log(`Response: ${firstTry.status} ${firstTry.statusText}`);

  if (firstTry.status !== 402) {
    console.log("No payment required! Response:", await firstTry.text());
    return;
  }

  // Step 2: Extract payment requirements from 402 response
  console.log("\n--- Step 2: Create payment ---");
  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstTry.headers.get(name),
  );
  console.log("Payment required:", JSON.stringify(paymentRequired, null, 2));

  // Step 3: Create payment payload
  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  // Step 4: Send paid request
  console.log("\n--- Step 3: Send paid request ---");
  const paymentHeaders =
    httpClient.encodePaymentSignatureHeader(paymentPayload);
  const start = Date.now();
  const paidResponse = await fetch(captureEndpoint, {
    method: "GET",
    headers: paymentHeaders,
  });
  const elapsed = Date.now() - start;

  // Step 5: Show results
  console.log(`\n--- Result (${elapsed}ms) ---`);
  console.log(`Status: ${paidResponse.status}`);

  const paymentResponse = (() => {
    try {
      return httpClient.getPaymentSettleResponse((name) =>
        paidResponse.headers.get(name),
      );
    } catch {
      return null;
    }
  })();
  if (paymentResponse) {
    console.log("Settlement:", JSON.stringify(paymentResponse, null, 2));
  }

  const data = (await paidResponse.json()) as CaptureDemoResponse;
  console.log(`\nTitle: ${data.title}`);
  console.log(`Capture time: ${data.captureTimeMs}ms`);
  console.log(`Content length: ${data.content?.length} chars`);
  console.log(`\nContent preview:\n${data.content?.substring(0, 600)}`);
}

main().catch((err) => {
  console.error("Client error:", getErrorMessage(err));
  process.exit(1);
});
