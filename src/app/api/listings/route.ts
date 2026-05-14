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
    const listing = await addListing(body);
    return NextResponse.json({ listing });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to add listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
