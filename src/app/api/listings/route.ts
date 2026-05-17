import { NextResponse } from "next/server";
import { addListing, getListings, getStats } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "stats") {
    return NextResponse.json({ stats: await getStats() });
  }

  return NextResponse.json({ listings: await getListings() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    if (!body.proof || typeof body.proof !== "object") {
      return NextResponse.json(
        {
          error:
            "Listing requires a wallet-ownership proof. Sign the canonical message and include it as `proof`.",
        },
        { status: 400 }
      );
    }
    const listing = await addListing(body);
    return NextResponse.json({ listing });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to add listing";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
