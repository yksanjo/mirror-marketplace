import type { DeployerRepSummary } from "./marketplace-types";

const DEPLOYER_API_URL =
  process.env.DEPLOYER_API_URL ?? "http://127.0.0.1:3032";
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;

type CacheEntry = { value: DeployerRepSummary | null; expires: number };
const cache = new Map<string, CacheEntry>();

interface DeployerApiResponse {
  deployer?: {
    archetype: string;
    archetypeLabel: string;
    archetypeEmoji: string;
    reputation: { overall: number };
    stats: { totalLaunches: number; graduated: number; rugged: number };
  };
}

export async function getDeployerRep(
  wallet: string
): Promise<DeployerRepSummary | null> {
  const cached = cache.get(wallet);
  if (cached && cached.expires > Date.now()) return cached.value;

  const value = await fetchOnce(wallet);
  cache.set(wallet, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

async function fetchOnce(wallet: string): Promise<DeployerRepSummary | null> {
  try {
    const res = await fetch(`${DEPLOYER_API_URL}/api/deployer/${wallet}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DeployerApiResponse;
    if (!data.deployer || data.deployer.stats.totalLaunches === 0) return null;
    return {
      archetype: data.deployer.archetype,
      archetypeLabel: data.deployer.archetypeLabel,
      archetypeEmoji: data.deployer.archetypeEmoji,
      reputationScore: data.deployer.reputation.overall,
      totalLaunches: data.deployer.stats.totalLaunches,
      graduated: data.deployer.stats.graduated,
      rugged: data.deployer.stats.rugged,
    };
  } catch {
    return null;
  }
}
