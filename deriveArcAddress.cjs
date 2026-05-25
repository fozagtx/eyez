#!/usr/bin/env node
require("dotenv/config");

const { privateKeyToAccount } = require("viem/accounts");

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const rawKey =
  args[0] ||
  process.env.EVM_PRIVATE_KEY ||
  process.env.ARC_PRIVATE_KEY ||
  process.env.FACILITATOR_PRIVATE_KEY;

if (!rawKey) {
  console.error(
    "Usage: pnpm derive:address -- 0x<private_key>\nOr set EVM_PRIVATE_KEY in .env.",
  );
  process.exit(1);
}

const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

try {
  const account = privateKeyToAccount(privateKey);
  console.log(account.address);
} catch (err) {
  console.error(`Could not derive Arc address: ${err.message}`);
  process.exit(1);
}
