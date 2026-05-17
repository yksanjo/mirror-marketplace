import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export interface BuildSubscribeTxArgs {
  subscriber: PublicKey;
  creator: PublicKey;
  feeWallet: PublicKey;
  priceSol: number;
  feeBps: number;
}

export function buildSubscribeTx(args: BuildSubscribeTxArgs): Transaction {
  const total = Math.round(args.priceSol * LAMPORTS_PER_SOL);
  const feeLamports = Math.floor((total * args.feeBps) / 10_000);
  const creatorLamports = total - feeLamports;

  const tx = new Transaction();
  tx.add(
    SystemProgram.transfer({
      fromPubkey: args.subscriber,
      toPubkey: args.creator,
      lamports: creatorLamports,
    })
  );
  if (feeLamports > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: args.subscriber,
        toPubkey: args.feeWallet,
        lamports: feeLamports,
      })
    );
  }
  return tx;
}
