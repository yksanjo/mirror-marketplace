"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { MirrorListing, MarketplaceStats } from "@/lib/marketplace";
import { buildSubscribeTx } from "@/lib/payment-client";

const FEE_WALLET = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET ?? "";
const FEE_BPS = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? "500");

type SubKey = `${string}:${string}`;

interface SubState {
  status: "idle" | "signing" | "confirming" | "registering" | "done" | "error";
  message?: string;
  signature?: string;
}

export default function Home() {
  const [listings, setListings] = useState<MirrorListing[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [subStates, setSubStates] = useState<Record<SubKey, SubState>>({});

  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);
    try {
      const [listingsRes, statsRes] = await Promise.all([
        fetch("/api/listings"),
        fetch("/api/listings?action=stats"),
      ]);
      const listingsData = (await listingsRes.json()) as { listings?: MirrorListing[] };
      const statsData = (await statsRes.json()) as { stats?: MarketplaceStats };
      setListings(listingsData.listings ?? []);
      setStats(statsData.stats ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function setSub(key: SubKey, state: SubState) {
    setSubStates((prev) => ({ ...prev, [key]: state }));
  }

  async function handleSubscribe(
    listing: MirrorListing,
    tier: MirrorListing["tiers"][number]
  ) {
    const key: SubKey = `${listing.wallet}:${tier.tier}`;

    if (tier.priceSol === 0) {
      setSub(key, { status: "registering" });
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriberWallet: publicKey?.toBase58() ?? "anonymous",
            creatorWallet: listing.wallet,
            tier: tier.tier,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setSub(key, { status: "done", message: "Subscribed (free tier)" });
        loadListings();
      } catch (err) {
        setSub(key, {
          status: "error",
          message: err instanceof Error ? err.message : "Failed",
        });
      }
      return;
    }

    if (!connected || !publicKey) {
      setSub(key, { status: "error", message: "Connect your wallet first" });
      return;
    }
    if (!FEE_WALLET) {
      setSub(key, {
        status: "error",
        message: "Platform fee wallet not configured (NEXT_PUBLIC_PLATFORM_FEE_WALLET)",
      });
      return;
    }

    let feeWalletPk: PublicKey;
    let creatorPk: PublicKey;
    try {
      feeWalletPk = new PublicKey(FEE_WALLET);
      creatorPk = new PublicKey(listing.wallet);
    } catch {
      setSub(key, { status: "error", message: "Invalid wallet address on listing or fee wallet" });
      return;
    }

    try {
      setSub(key, { status: "signing", message: "Approve in wallet…" });
      const tx = buildSubscribeTx({
        subscriber: publicKey,
        creator: creatorPk,
        feeWallet: feeWalletPk,
        priceSol: tier.priceSol,
        feeBps: FEE_BPS,
      });
      const signature = await sendTransaction(tx, connection);

      setSub(key, {
        status: "confirming",
        message: "Waiting for on-chain confirmation…",
        signature,
      });
      const latest = await connection.getLatestBlockhash();
      const confirmation = await connection.confirmTransaction(
        { signature, ...latest },
        "confirmed"
      );
      if (confirmation.value.err) throw new Error("Transaction failed on-chain");

      setSub(key, {
        status: "registering",
        message: "Recording subscription…",
        signature,
      });
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberWallet: publicKey.toBase58(),
          creatorWallet: listing.wallet,
          tier: tier.tier,
          paymentSignature: signature,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Server rejected subscription");

      setSub(key, {
        status: "done",
        message: "Subscribed!",
        signature,
      });
      loadListings();
    } catch (err) {
      setSub(key, {
        status: "error",
        message: err instanceof Error ? err.message : "Subscription failed",
      });
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground mb-6">
            <span className="size-1.5 rounded-full bg-pink" />
            Subscribe to trading alpha
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-4">
            Mirror Marketplace
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Subscribe to top Solana traders. Get AI-generated trade theses in real-time.
            Performance-verified. On-chain transparent.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
            <Stat label="Total Traders" value={String(stats.totalListings)} />
            <Stat label="Active Subs" value={String(stats.totalSubscriptions)} />
            <Stat label="Total Volume" value={`${stats.totalVolumeSol} SOL`} />
            <Stat label="Platform Fee" value={`${FEE_BPS / 100}%`} />
          </div>
        )}

        {/* Listings Grid */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-4xl mb-4">🏪</p>
            <p>Loading marketplace...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-4xl mb-4">🏪</p>
            <p>No traders listed yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {listings.map((listing, i) => (
              <div
                key={listing.id ?? i}
                className="rounded-xl border border-border bg-muted/20 p-6 hover:border-accent/50 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{listing.username}</h3>
                      {listing.verified && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald/20 text-emerald">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{listing.bio}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Trades</div>
                    <div className="font-medium">{listing.stats?.totalTrades ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                    <div className="font-medium">{listing.stats?.winRate ?? 0}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Followers</div>
                    <div className="font-medium">{listing.stats?.followers ?? 0}</div>
                  </div>
                </div>

                {listing.deployerRep && (
                  <a
                    href={`https://mirror-deployer.musicailab.com/deployer/${listing.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-emerald/30 bg-emerald/5 hover:bg-emerald/10 transition"
                    title="Click to see full deployer history on Mirror Deployer"
                  >
                    <span className="text-lg shrink-0">{listing.deployerRep.archetypeEmoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-wider text-emerald">
                        Also a pump.fun deployer
                      </div>
                      <div className="text-sm text-foreground truncate">
                        {listing.deployerRep.archetypeLabel}{" · "}
                        <span className="text-muted-foreground">
                          {listing.deployerRep.graduated}/{listing.deployerRep.totalLaunches} graduated
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">Rep</div>
                      <div className="text-sm font-semibold text-emerald">
                        {listing.deployerRep.reputationScore.toFixed(0)}
                      </div>
                    </div>
                  </a>
                )}

                <div className="space-y-2">
                  {listing.tiers?.map((tier, j) => {
                    const key: SubKey = `${listing.wallet}:${tier.tier}`;
                    const state = subStates[key];
                    const busy =
                      state?.status === "signing" ||
                      state?.status === "confirming" ||
                      state?.status === "registering";

                    return (
                      <div
                        key={j}
                        className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/30"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium capitalize">{tier.tier}</div>
                            <div className="text-xs text-muted-foreground">
                              {tier.benefits?.join(", ")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{tier.priceSol} SOL</div>
                            <div className="text-xs text-muted-foreground">/month</div>
                          </div>
                        </div>
                        <button
                          disabled={busy}
                          onClick={() => handleSubscribe(listing, tier)}
                          className="px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                        >
                          {busy ? "Working…" : state?.status === "done" ? "Subscribed ✓" : "Subscribe"}
                        </button>
                        {state?.message && (
                          <div
                            className={`text-xs ${
                              state.status === "error" ? "text-pink" : "text-muted-foreground"
                            }`}
                          >
                            {state.message}
                            {state.signature && (
                              <>
                                {" "}
                                <a
                                  href={`https://solscan.io/tx/${state.signature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  view tx
                                </a>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-medium mt-1">{value}</div>
    </div>
  );
}
