import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { yearlySavingPercent } from "@/lib/plans";
import tour from "@/lib/tour.json";
import { TourClient, type TourTrack } from "@/components/TourClient";

// Getting started: a step-by-step tour of every screen, with real
// screenshots, one track per kind of user. The content lives in
// src/lib/tour.json (steps) and src/lib/shotNotes.json (callouts);
// scripts/check-guide.mjs keeps both in step with the app on every
// build, and the screenshots are re-taken by CI on every push.

export const metadata = { title: "Getting started — UnyBase" };

export default async function TourPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; step?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user?.email);
  const sp = await searchParams;

  // Admin tracks only for the roles they describe.
  const tracks = (tour.tracks as TourTrack[]).filter((t) => t.roles.includes(role));
  const preferred = role === "super_admin" ? "super" : role === "technical_admin" ? "tech" : "client";
  const initialTrack = tracks.some((t) => t.id === sp.track) ? sp.track! : preferred;
  const initialStep = Math.max(0, (Number(sp.step) || 1) - 1);

  return (
    <TourClient
      tracks={tracks}
      updated={tour.updated}
      initialTrack={initialTrack}
      initialStep={initialStep}
      vars={{ save: yearlySavingPercent() }}
    />
  );
}
