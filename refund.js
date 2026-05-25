import { getAddress } from "viem";
import {
  ARC_USDC_ABI,
  ARC_USDC_ADDRESS,
  createArcPublicClient,
  createArcWalletClient,
  getRefundPrivateKey,
  parseUsdcUnits,
} from "./arc.js";

const BLOCKED_PATTERNS = [
  "you've been blocked",
  "you have been blocked",
  "blocked by network security",
  "access denied",
  "please log in",
  "log in to",
  "sign in to",
  "enable javascript",
  "just a moment...",
  "checking your browser",
  "performing security verification",
  "ray id:",
  "cloudflare",
  "attention required",
  "please verify you are a human",
  "this page doesn't exist",
];

export function isFailedCapture(content, title) {
  if (!content || content.length < 100) return "empty_content";

  const lower = content.toLowerCase();
  const titleLower = (title || "").toLowerCase();

  // Check title for block signals
  if (titleLower === "just a moment..." || titleLower === "blocked") {
    return "blocked_page";
  }

  // Check content for block/login patterns
  for (const pattern of BLOCKED_PATTERNS) {
    // Only flag if the blocked pattern is a large portion of the content
    // (avoid false positives on pages that mention "log in" in a nav bar)
    if (lower.includes(pattern) && content.length < 500) {
      return "blocked_page";
    }
  }

  return null;
}

export async function sendRefund(payerAddress, amount, memo) {
  void memo;

  const refundPrivateKey = getRefundPrivateKey();
  if (!refundPrivateKey) {
    console.error("REFUND_PRIVATE_KEY not set - cannot send refund");
    return null;
  }

  try {
    const to = getAddress(payerAddress);
    const walletClient = createArcWalletClient(refundPrivateKey);
    const publicClient = createArcPublicClient();
    const hash = await walletClient.writeContract({
      address: ARC_USDC_ADDRESS,
      abi: ARC_USDC_ABI,
      functionName: "transfer",
      args: [to, parseUsdcUnits(amount)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== "success") {
      console.error(`Refund reverted for ${to}: ${hash}`);
      return null;
    }

    console.log(`Refund sent to ${to}: ${hash}`);
    return hash;
  } catch (err) {
    console.error(`Refund failed for ${payerAddress}:`, err.message);
    return null;
  }
}
