import "dotenv/config";
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress } from "viem";
import {
  ARC_NETWORK,
  ARC_PAYMENT_PRICE,
  PRICE,
  REFUND_AMOUNT_USDC,
  createArcFacilitator,
  getFacilitatorPrivateKey,
} from "./arc.js";
import { captureUrl, closeBrowser } from "./captureEngine.js";
import { isFailedCapture, sendRefund } from "./refund.js";

const PORT = process.env.PORT || 3001;
const NETWORK = ARC_NETWORK;
const PAY_TO = process.env.PAY_TO ? getAddress(process.env.PAY_TO) : null;
const FACILITATOR_PRIVATE_KEY = getFacilitatorPrivateKey();

if (!PAY_TO) {
  console.error("ERROR: PAY_TO not set in .env");
  process.exit(1);
}

if (!FACILITATOR_PRIVATE_KEY) {
  console.error("ERROR: FACILITATOR_PRIVATE_KEY not set in .env");
  process.exit(1);
}

function isAllowedUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const blocked = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
    if (blocked.includes(parsed.hostname)) return false;
    if (parsed.hostname.startsWith("[")) return false; // block all IPv6 literals
    const parts = parsed.hostname.split(".");
    if (parts[0] === "10") return false;
    if (parts[0] === "172" && +parts[1] >= 16 && +parts[1] <= 31) return false;
    if (parts[0] === "192" && parts[1] === "168") return false;
    if (parts[0] === "169" && parts[1] === "254") return false;
    return true;
  } catch {
    return false;
  }
}

// Extract payer from the x402 payment header for Arc EVM refunds.
function getPayerAddress(req) {
  try {
    const header = req.get("payment-signature") || req.get("x-payment");
    if (!header) return null;

    const normalized = header
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(header.length / 4) * 4, "=");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString());
    const payload = decoded?.payload || decoded?.paymentPayload?.payload;
    const payer =
      payload?.authorization?.from || payload?.permit2Authorization?.from;

    return payer ? getAddress(payer) : null;
  } catch {
    return null;
  }
}

const app = express();
const facilitator = createArcFacilitator(FACILITATOR_PRIVATE_KEY);

// Info endpoint (free)
app.get("/", (_, res) =>
  res.json({
    service: "eyez",
    description: "Pay per capture headless browser API on Arc x402",
    price: PRICE,
    network: NETWORK,
    usage: "GET /capture?url=<encoded_url>",
  }),
);

// Health check (free)
app.get("/health", (_, res) => res.json({ status: "ok" }));

// URL validation runs before payment to reject SSRF attempts early.
app.use("/capture", (req, res, next) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing ?url= parameter" });
  let decoded;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return res.status(400).json({ error: "Malformed URL encoding" });
  }
  if (!isAllowedUrl(decoded)) {
    return res
      .status(400)
      .json({ error: "URL not allowed — only public http/https URLs" });
  }
  req.decodedUrl = decoded;
  next();
});

// x402 payment middleware protects /capture.
app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /capture": {
        accepts: {
          scheme: "exact",
          price: ARC_PAYMENT_PRICE,
          network: NETWORK,
          payTo: PAY_TO,
          maxTimeoutSeconds: 60,
        },
        description: "Capture a JS-heavy webpage and return extracted content",
      },
    },
    facilitator,
    [{ network: NETWORK, server: new ExactEvmScheme() }],
  ),
);

// Protected capture endpoint
app.get("/capture", async (req, res) => {
  const decoded = req.decodedUrl;

  try {
    console.log(`Capturing: ${decoded}`);
    const start = Date.now();
    const result = await captureUrl(decoded);
    const elapsed = Date.now() - start;

    const failReason = isFailedCapture(result.content, result.title);
    if (failReason) {
      const payerAddress = getPayerAddress(req);
      let refund = null;
      if (payerAddress) {
        console.log(`Bad capture (${failReason}) for ${decoded} - refunding ${payerAddress}`);
        const refundHash = await sendRefund(payerAddress, REFUND_AMOUNT_USDC, `refund:${failReason}`);
        refund = refundHash
          ? { transaction: refundHash, amount: `${REFUND_AMOUNT_USDC} USDC`, reason: failReason }
          : { error: "Refund failed - contact support", reason: failReason };
      }

      return res.json({
        ...result,
        captureTimeMs: elapsed,
        payment: { price: PRICE, network: NETWORK },
        refund,
      });
    }

    res.json({
      ...result,
      captureTimeMs: elapsed,
      payment: { price: PRICE, network: NETWORK },
    });
  } catch (err) {
    console.error(`Capture failed for ${decoded}:`, err.message);
    if (err.message.includes("Too many concurrent")) {
      return res.status(503).json({ error: err.message });
    }
    // Attempt refund on crash
    const payerAddress = getPayerAddress(req);
    let refund = null;
    if (payerAddress) {
      const refundHash = await sendRefund(payerAddress, REFUND_AMOUNT_USDC, "refund:capture_crash");
      refund = refundHash
        ? { transaction: refundHash, amount: `${REFUND_AMOUNT_USDC} USDC`, reason: "capture_crash" }
        : { error: "Refund failed - contact support" };
    }
    res.status(500).json({ error: "Capture failed", message: err.message, refund });
  }
});

const server = app.listen(Number(PORT), () => {
  console.log(`eyez listening on http://localhost:${PORT}`);
  console.log(`  Pay ${PRICE} USDC on Arc Testnet (${NETWORK}) per capture`);
  console.log(`  Payments go to ${PAY_TO}`);
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    console.log(`${sig} received, shutting down...`);
    server.close();
    await closeBrowser();
    process.exit(0);
  });
}
