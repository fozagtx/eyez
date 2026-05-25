# Wallet Setup

eyez uses Arc Testnet USDC through x402.

## Required Values

Add these to `.env`:

```bash
PAY_TO=0xYourPublicAddress
FACILITATOR_PRIVATE_KEY=0xYourServerPrivateKey
EVM_PRIVATE_KEY=0xYourClientPrivateKey
```

`PAY_TO` is the public address that receives paid capture payments. `FACILITATOR_PRIVATE_KEY` settles x402 payments for the API. `EVM_PRIVATE_KEY` is only used by the demo client and MCP client.

## Arc RPC

Canteen can provide an Arc Testnet RPC URL:

```bash
arc-canteen rpc-url
```

Then set one of:

```bash
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
RPC=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
```

`ARC_RPC_URL` takes priority over `RPC`.

## Derive A Public Address

To derive the public address for a private key:

```bash
pnpm derive:address -- 0xYourPrivateKey
```

Never commit `.env` or real private keys. `.env.example` must stay placeholder-only.
