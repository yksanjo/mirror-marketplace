import { NextResponse } from "next/server";
import { subscribe } from "@/lib/marketplace";

export async function POST(req: Request) {
  try {
    const { subscriberWallet, creatorWallet, tier } = await req.json();

    if (!subscriberWallet || !creatorWallet || !tier) {
      return NextResponse.json(
        { error: "subscriberWallet, creatorWallet, and tier are required" },
        { status: 400 }
      );
    }

    const subscription = subscribe(subscriberWallet, creatorWallet, tier);
    return NextResponse.json({ subscription });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Subscription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
