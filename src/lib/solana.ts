import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET ?? "";
const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? "500");
const MAX_TX_AGE_MS = 10 * 60 * 1000;
const MIN_LAMPORT_TOLERANCE = 1000;

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, "confirmed");
  return connection;
}

export function platformFeeBps(): number {
  return PLATFORM_FEE_BPS;
}

export function platformFeeWallet(): string {
  return PLATFORM_FEE_WALLET;
}

export function isValidPubkey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export interface PaymentSplit {
  creatorLamports: number;
  feeLamports: number;
}

export function splitForPrice(priceSol: number): PaymentSplit {
  const total = Math.round(priceSol * LAMPORTS_PER_SOL);
  const feeLamports = Math.floor((total * PLATFORM_FEE_BPS) / 10_000);
  const creatorLamports = total - feeLamports;
  return { creatorLamports, feeLamports };
}

interface SystemTransferInfo {
  source: string;
  destination: string;
  lamports: number;
}

function asSystemTransfer(
  ix: ParsedInstruction | PartiallyDecodedInstruction
): SystemTransferInfo | null {
  if (!("parsed" in ix) || !ix.parsed) return null;
  if (ix.program !== "system") return null;
  const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
  if (parsed.type !== "transfer") return null;
  const info = parsed.info ?? {};
  const source = String(info.source ?? "");
  const destination = String(info.destination ?? "");
  const lamports = Number(info.lamports ?? 0);
  if (!source || !destination || !Number.isFinite(lamports)) return null;
  return { source, destination, lamports };
}

export interface VerifyPaymentArgs {
  signature: string;
  subscriberWallet: string;
  creatorWallet: string;
  priceSol: number;
}

export async function verifyPayment(args: VerifyPaymentArgs): Promise<void> {
  const { signature, subscriberWallet, creatorWallet, priceSol } = args;
  if (priceSol <= 0) return;
  if (!PLATFORM_FEE_WALLET) {
    throw new Error("PLATFORM_FEE_WALLET is not configured on the server");
  }
  if (
    !isValidPubkey(subscriberWallet) ||
    !isValidPubkey(creatorWallet) ||
    !isValidPubkey(PLATFORM_FEE_WALLET)
  ) {
    throw new Error("Invalid wallet address in payment");
  }

  const conn = getConnection();
  const tx = await conn.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) throw new Error("Payment transaction not found or not yet confirmed");
  if (tx.meta?.err) throw new Error("Payment transaction failed on-chain");

  const blockTimeMs = tx.blockTime ? tx.blockTime * 1000 : 0;
  if (blockTimeMs && Date.now() - blockTimeMs > MAX_TX_AGE_MS) {
    throw new Error("Payment transaction is older than 10 minutes; submit a fresh payment");
  }

  const { creatorLamports, feeLamports } = splitForPrice(priceSol);
  const transfers = tx.transaction.message.instructions
    .map(asSystemTransfer)
    .filter((t): t is SystemTransferInfo => t !== null);

  const toCreator = transfers.find(
    (t) =>
      t.source === subscriberWallet &&
      t.destination === creatorWallet &&
      t.lamports + MIN_LAMPORT_TOLERANCE >= creatorLamports
  );
  if (!toCreator) {
    throw new Error(
      `Payment must include a transfer of ~${creatorLamports} lamports from ${subscriberWallet} to ${creatorWallet}`
    );
  }

  if (feeLamports > 0) {
    const toFee = transfers.find(
      (t) =>
        t.source === subscriberWallet &&
        t.destination === PLATFORM_FEE_WALLET &&
        t.lamports + MIN_LAMPORT_TOLERANCE >= feeLamports
    );
    if (!toFee) {
      throw new Error(
        `Payment must include a platform fee transfer of ~${feeLamports} lamports to ${PLATFORM_FEE_WALLET}`
      );
    }
  }
}

export interface ListingProofArgs {
  wallet: string;
  message: string;
  signature: string;
  maxAgeMs?: number;
}

const LISTING_MESSAGE_PREFIX = "mirror-marketplace::list::";

export function buildListingMessage(wallet: string, unixSeconds: number): string {
  return `${LISTING_MESSAGE_PREFIX}${wallet}::${unixSeconds}`;
}

export function verifyListingProof(args: ListingProofArgs): void {
  const { wallet, message, signature } = args;
  const maxAgeMs = args.maxAgeMs ?? 5 * 60 * 1000;
  if (!isValidPubkey(wallet)) throw new Error("Invalid wallet address");

  const prefix = `${LISTING_MESSAGE_PREFIX}${wallet}::`;
  if (!message.startsWith(prefix)) {
    throw new Error("Listing message format is invalid");
  }
  const tsString = message.slice(prefix.length);
  const ts = Number(tsString);
  if (!Number.isFinite(ts)) throw new Error("Listing message timestamp invalid");
  const ageMs = Math.abs(Date.now() - ts * 1000);
  if (ageMs > maxAgeMs) {
    throw new Error("Listing proof expired; sign a fresh message and retry");
  }

  let sigBytes: Uint8Array;
  try {
    sigBytes = bs58.decode(signature);
  } catch {
    throw new Error("Signature is not valid base58");
  }
  const pubkeyBytes = new PublicKey(wallet).toBytes();
  const messageBytes = new TextEncoder().encode(message);
  const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
  if (!ok) throw new Error("Listing proof signature is invalid for this wallet");
}
