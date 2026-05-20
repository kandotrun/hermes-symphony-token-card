import { NextRequest, NextResponse } from "next/server";
import { getUsage, renderCard } from "@/src/lib/usage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind: raw } = await params;
  const kind = raw.replace(/\.svg$/, "").toLowerCase();
  const svg = renderCard(kind, await getUsage());
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } });
}
