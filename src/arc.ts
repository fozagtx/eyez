import { x402Facilitator } from "@x402/core/facilitator";
import type { FacilitatorClient } from "@x402/core/server";
import type { Network, SupportedResponse } from "@x402/core/types";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { toClientEvmSigner, toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme as registerExactEvmClientScheme } from "@x402/evm/exact/client";
import { registerExactEvmScheme as registerExactEvmFacilitatorScheme } from "@x402/evm/exact/facilitator";
import {
  type Hex,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  getAddress,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const ARC_CHAIN_ID = 5042002;
export const ARC_NETWORK = `eip155:${ARC_CHAIN_ID}` as Network;
export const ARC_RPC_URL =
  process.env.ARC_RPC_URL ||
  process.env.RPC ||
  "https://rpc.testnet.arc.network";
export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
export const ARC_USDC_ADDRESS = getAddress(
  process.env.ARC_USDC_ADDRESS ||
    "0x3600000000000000000000000000000000000000",
);
export const ARC_USDC_DECIMALS = 6;
export const ARC_USDC_NAME = "USDC";
export const ARC_USDC_VERSION = "2";
export const PRICE_USDC = process.env.PRICE_USDC || "0.001";
export const PRICE = `$${PRICE_USDC}`;
export const REFUND_AMOUNT_USDC =
  process.env.REFUND_AMOUNT_USDC || PRICE_USDC;

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: ARC_USDC_DECIMALS,
  },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: ARC_EXPLORER_URL },
  },
  testnet: true,
});

export const ARC_PAYMENT_PRICE = {
  amount: parseUsdcUnits(PRICE_USDC).toString(),
  asset: ARC_USDC_ADDRESS,
  extra: {
    name: ARC_USDC_NAME,
    version: ARC_USDC_VERSION,
  },
};

export const ARC_USDC_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function parseUsdcUnits(amount: bigint | number | string): bigint {
  return parseUnits(String(amount), ARC_USDC_DECIMALS);
}

export function formatUsdcUnits(amount: bigint | number | string): string {
  return formatUnits(BigInt(amount), ARC_USDC_DECIMALS);
}

export function normalizePrivateKey(privateKey?: string | null): Hex | null {
  if (!privateKey) return null;
  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
}

export function getClientPrivateKey(): Hex | null {
  return normalizePrivateKey(
    process.env.EVM_PRIVATE_KEY || process.env.ARC_PRIVATE_KEY,
  );
}

export function getFacilitatorPrivateKey(): Hex | null {
  return normalizePrivateKey(
    process.env.FACILITATOR_PRIVATE_KEY ||
      process.env.ARC_FACILITATOR_PRIVATE_KEY,
  );
}

export function getRefundPrivateKey(): Hex | null {
  return normalizePrivateKey(
    process.env.REFUND_PRIVATE_KEY ||
      process.env.SERVER_PRIVATE_KEY ||
      process.env.FACILITATOR_PRIVATE_KEY ||
      process.env.ARC_FACILITATOR_PRIVATE_KEY,
  );
}

export function createArcPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });
}

export function createArcWalletClient(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });
}

export function createArcPaymentClient(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createArcPublicClient();
  const client = new x402Client();

  registerExactEvmClientScheme(client, {
    signer: toClientEvmSigner(account, publicClient),
    networks: [ARC_NETWORK],
    schemeOptions: {
      [ARC_CHAIN_ID]: { rpcUrl: ARC_RPC_URL },
    },
  });

  return {
    address: account.address,
    client,
    httpClient: new x402HTTPClient(client),
  };
}

export function createArcFacilitator(privateKey: Hex): FacilitatorClient {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createArcPublicClient();
  const walletClient = createArcWalletClient(privateKey);
  const facilitator = new x402Facilitator();

  registerExactEvmFacilitatorScheme(facilitator, {
    networks: ARC_NETWORK,
    signer: toFacilitatorEvmSigner({
      address: account.address,
      readContract: (args) => publicClient.readContract(args),
      verifyTypedData: (args) =>
        publicClient.verifyTypedData(
          args as unknown as Parameters<typeof publicClient.verifyTypedData>[0],
        ),
      writeContract: (args) => walletClient.writeContract(args),
      sendTransaction: (args) => walletClient.sendTransaction(args),
      waitForTransactionReceipt: (args) =>
        publicClient.waitForTransactionReceipt(args),
      getCode: (args) => publicClient.getCode(args),
    }),
  });

  return {
    verify: (paymentPayload, paymentRequirements) =>
      facilitator.verify(paymentPayload, paymentRequirements),
    settle: (paymentPayload, paymentRequirements) =>
      facilitator.settle(paymentPayload, paymentRequirements),
    getSupported: async () => facilitator.getSupported() as SupportedResponse,
  };
}
