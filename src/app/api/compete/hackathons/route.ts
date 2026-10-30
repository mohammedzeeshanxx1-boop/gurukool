import { NextResponse } from "next/server";

// Live hackathons from Devpost's free public JSON endpoint (the same one devpost.com/hackathons uses).
// No API key needed. Fetched server-side and cached for 15 minutes to stay polite.
const DEVPOST = "https://devpost.com/api/hackathons";

export const dynamic = "force-dynamic";

type RawHackathon = {
  id?: number; title?: string; url?: string; organization_name?: string;
  displayed_location?: { location?: string }; open_state?: string;
  submission_period_dates?: string; time_left_to_submission?: string;
  themes?: { name?: string }[]; prize_amount?: string; registrations_count?: number;
  thumbnail_url?: string; invite_only?: boolean;
};

const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const absUrl = (u = "") => (u.startsWith("//") ? `https:${u}` : u);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("q") ?? "").slice(0, 80);
  const pages = Math.min(Math.max(Number(searchParams.get("pages")) || 2, 1), 3);

  try {
    const all: RawHackathon[] = [];
    let total = 0;
    for (let page = 1; page <= pages; page++) {
      const qs = new URLSearchParams();
      qs.append("status[]", "open");
      qs.append("status[]", "upcoming");
      qs.set("order_by", "deadline");
      qs.set("page", String(page));
      if (search) qs.set("search", search);
      const res = await fetch(`${DEVPOST}?${qs}`, {
        headers: { Accept: "application/json", "User-Agent": "GURUKOOL-edu-platform/1.0" },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`Devpost responded ${res.status}`);
      const data = await res.json();
      const list: RawHackathon[] = Array.isArray(data?.hackathons) ? data.hackathons : [];
      total = Number(data?.meta?.total_count) || total;
      all.push(...list);
      if (list.length === 0 || all.length >= total) break;
    }

    const hackathons = all
      .filter((h) => h.title && h.url && !h.invite_only)
      .map((h) => ({
        id: String(h.id ?? h.url),
        title: h.title!,
        url: absUrl(h.url!),
        organization: h.organization_name ?? "",
        location: h.displayed_location?.location ?? "Online",
        state: h.open_state ?? "",
        dates: h.submission_period_dates ?? "",
        timeLeft: h.time_left_to_submission ?? "",
        themes: (h.themes ?? []).map((t) => t.name ?? "").filter(Boolean),
        prize: stripHtml(h.prize_amount),
        registrations: h.registrations_count ?? 0,
        thumbnail: absUrl(h.thumbnail_url ?? ""),
      }));

    return NextResponse.json({ source: "devpost", fetchedAt: new Date().toISOString(), total, hackathons });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    return NextResponse.json(
      { error: `Could not load live hackathons from Devpost: ${err.cause?.code ?? err.message}`, code: "LIVE_UNAVAILABLE" },
      { status: 502 }
    );
  }
}
