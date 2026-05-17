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
  /** Populated at read time from mirror-deployer when the wallet is also a pump.fun deployer. */
  deployerRep?: DeployerRepSummary;
}

export interface DeployerRepSummary {
  archetype: string;
  archetypeLabel: string;
  archetypeEmoji: string;
  reputationScore: number;
  totalLaunches: number;
  graduated: number;
  rugged: number;
}

export interface Subscription {
  id: string;
  subscriberWallet: string;
  creatorWallet: string;
  tier: string;
  active: boolean;
  startDate: number;
  endDate: number;
  paymentSignature?: string;
}

export interface MarketplaceStats {
  totalListings: number;
  totalSubscriptions: number;
  totalVolumeSol: number;
}
