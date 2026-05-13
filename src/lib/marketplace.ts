export interface MirrorListing {
  id: string;
  wallet: string;
  username: string;
  bio: string;
  verified: boolean;
  tiers: Array<{
    tier: "free" | "basic" | "premium" | "whale";
    priceSol: number;
    benefits: string[];
  }>;
  stats: {
    totalTrades: number;
    winRate: number;
    followers: number;
  };
  totalVolumeSol: number;
  createdAt: number;
}

export interface MarketplaceStats {
  totalListings: number;
  totalSubscriptions: number;
  totalVolumeSol: number;
}

// In-memory store (replace with DB in production)
const listings = new Map<string, MirrorListing>();
const subscriptions = new Map<string, any[]>();

export function getListings(): MirrorListing[] {
  return Array.from(listings.values()).sort((a, b) => b.stats.followers - a.stats.followers);
}

export function getStats(): MarketplaceStats {
  const allListings = Array.from(listings.values());
  const allSubs = Array.from(subscriptions.values()).flat();
  const totalVolume = allListings.reduce((s, l) => s + l.totalVolumeSol, 0);

  return {
    totalListings: allListings.length,
    totalSubscriptions: allSubs.filter((s: any) => s.active).length,
    totalVolumeSol: Math.round(totalVolume * 1000) / 1000,
  };
}

export function addListing(listing: MirrorListing): MirrorListing {
  listings.set(listing.id, listing);
  return listing;
}

export function subscribe(
  subscriberWallet: string,
  creatorWallet: string,
  tier: string
): any {
  const sub = {
    id: `sub_${subscriberWallet}_${creatorWallet}_${Date.now()}`,
    subscriberWallet,
    creatorWallet,
    tier,
    active: true,
    startDate: Date.now(),
    endDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  const userSubs = subscriptions.get(subscriberWallet) ?? [];
  userSubs.push(sub);
  subscriptions.set(subscriberWallet, userSubs);

  // Update follower count
  for (const [, listing] of listings) {
    if (listing.wallet === creatorWallet) {
      listing.stats.followers++;
      break;
    }
  }

  return sub;
}

// Seed some example listings
addListing({
  id: "mirror_example1",
  wallet: "GvyLS9WFxUBzoiVPKTJAR2bGLocnoEVWRYh4D8i5z7m1",
  username: "@solanawhale",
  bio: "5 years trading. Early hunter specializing in sub-100k mcap entries.",
  verified: true,
  tiers: [
    { tier: "basic", priceSol: 0.1, benefits: ["Real-time trade alerts", "Entry reasoning"] },
    { tier: "premium", priceSol: 0.5, benefits: ["All basic", "Exit signals", "Weekly alpha call"] },
    { tier: "whale", priceSol: 2.0, benefits: ["All premium", "Direct DM access", "Portfolio mirror"] },
  ],
  stats: { totalTrades: 847, winRate: 68, followers: 0 },
  totalVolumeSol: 0,
  createdAt: Date.now(),
});

addListing({
  id: "mirror_example2",
  wallet: "DEVRUGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  username: "@memelord",
  bio: "Memecoin specialist. 90% win rate on fresh launches.",
  verified: false,
  tiers: [
    { tier: "basic", priceSol: 0.05, benefits: ["Trade alerts", "Meme analysis"] },
    { tier: "premium", priceSol: 0.25, benefits: ["All basic", "Pre-launch intel", "Bundle detection"] },
  ],
  stats: { totalTrades: 234, winRate: 72, followers: 0 },
  totalVolumeSol: 0,
  createdAt: Date.now(),
});
