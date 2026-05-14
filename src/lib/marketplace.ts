import { loadListings, saveListings, loadSubs, saveSubs } from "./db";
import { getDeployerRep } from "./deployerRep";
import type {
  MarketplaceStats,
  MirrorListing,
  Subscription,
} from "./marketplace-types";

export type {
  MarketplaceStats,
  MirrorListing,
  Subscription,
  DeployerRepSummary,
} from "./marketplace-types";

const SEED_LISTINGS: MirrorListing[] = [
  {
    id: "mirror_seed_1",
    wallet: "GvyLS9WFxUBzoiVPKTJAR2bGLocnoEVWRYh4D8i5z7m1",
    username: "@solanawhale",
    bio: "5 years trading. Early hunter specializing in sub-100k mcap entries.",
    verified: true,
    tiers: [
      { tier: "basic",   priceSol: 0.1, benefits: ["Real-time trade alerts", "Entry reasoning"] },
      { tier: "premium", priceSol: 0.5, benefits: ["All basic", "Exit signals", "Weekly alpha call"] },
      { tier: "whale",   priceSol: 2.0, benefits: ["All premium", "Direct DM access", "Portfolio mirror"] },
    ],
    stats: { totalTrades: 847, winRate: 68, followers: 14 },
    totalVolumeSol: 12.4,
    createdAt: Date.now(),
  },
  {
    id: "mirror_seed_2",
    wallet: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    username: "@memelord",
    bio: "Memecoin specialist. Pump.fun graduate hunter. Bundle detection on launch.",
    verified: false,
    tiers: [
      { tier: "basic",   priceSol: 0.05, benefits: ["Trade alerts", "Meme analysis"] },
      { tier: "premium", priceSol: 0.25, benefits: ["All basic", "Pre-launch intel", "Bundle detection"] },
    ],
    stats: { totalTrades: 234, winRate: 72, followers: 38 },
    totalVolumeSol: 5.1,
    createdAt: Date.now(),
  },
  {
    id: "mirror_seed_3",
    wallet: "GDfnEsia2WLAW5t8yx2X5j2mkfA74i5kwGdDuZHt7XmG",
    username: "@diamondhands",
    bio: "Long-horizon position trader. 30+ day average hold. Boring is alpha.",
    verified: true,
    tiers: [
      { tier: "free",    priceSol: 0,    benefits: ["Public theses (1 week delay)"] },
      { tier: "premium", priceSol: 0.75, benefits: ["Real-time entries", "Conviction notes", "Macro thesis"] },
    ],
    stats: { totalTrades: 92, winRate: 81, followers: 207 },
    totalVolumeSol: 41.8,
    createdAt: Date.now(),
  },
];

async function maybeSeed(): Promise<void> {
  const map = await loadListings();
  if (map.size > 0) return;
  for (const l of SEED_LISTINGS) map.set(l.id, l);
  await saveListings();
}

export async function getListings(): Promise<MirrorListing[]> {
  await maybeSeed();
  const map = await loadListings();
  const sorted = Array.from(map.values()).sort(
    (a, b) => b.stats.followers - a.stats.followers
  );
  return Promise.all(
    sorted.map(async (listing) => {
      const rep = await getDeployerRep(listing.wallet);
      return rep ? { ...listing, deployerRep: rep } : listing;
    })
  );
}

export async function getStats(): Promise<MarketplaceStats> {
  await maybeSeed();
  const listings = await loadListings();
  const subs = await loadSubs();
  const allSubs = Array.from(subs.values()).flat();
  const totalVolume = Array.from(listings.values()).reduce(
    (s, l) => s + l.totalVolumeSol,
    0
  );
  return {
    totalListings: listings.size,
    totalSubscriptions: allSubs.filter((s) => s.active).length,
    totalVolumeSol: Math.round(totalVolume * 1000) / 1000,
  };
}

export async function addListing(
  listing: MirrorListing
): Promise<MirrorListing> {
  const map = await loadListings();
  map.set(listing.id, listing);
  await saveListings();
  return listing;
}

export async function subscribe(
  subscriberWallet: string,
  creatorWallet: string,
  tier: string
): Promise<Subscription> {
  const sub: Subscription = {
    id: `sub_${subscriberWallet}_${creatorWallet}_${Date.now()}`,
    subscriberWallet,
    creatorWallet,
    tier,
    active: true,
    startDate: Date.now(),
    endDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  const subs = await loadSubs();
  const userSubs = subs.get(subscriberWallet) ?? [];
  userSubs.push(sub);
  subs.set(subscriberWallet, userSubs);
  await saveSubs();

  const listings = await loadListings();
  for (const listing of listings.values()) {
    if (listing.wallet === creatorWallet) {
      listing.stats.followers++;
      await saveListings();
      break;
    }
  }

  return sub;
}
