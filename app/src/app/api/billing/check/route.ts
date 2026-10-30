import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, hasServiceRole } from "@/lib/supabase/service";
import { contactPaidTag, planFromTags, systemeConfigured } from "@/lib/systeme";
import { markPaid } from "@/lib/billing";
import { getAccess } from "@/lib/access";

// "I've already paid — check again".
//
// 1. Has the webhook already activated the account? Then done.
// 2. Otherwise ask systeme.io whether this email's contact carries a
//    paid tag (pull check), and activate if it does.
// The answer distinguishes "not paid yet" from "couldn't check", so
// the page never tells someone who paid that they haven't.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const access = await getAccess(supabase, user);
  if (access.status?.subscription_state === "active" || access.reason === "exempt") {
    return NextResponse.json({ paid: true, checked: true });
  }

  if (!systemeConfigured() || !hasServiceRole()) {
    return NextResponse.json({
      paid: false,
      checked: false,
      message:
        "Payment hasn't been confirmed yet. Confirmations usually arrive within a minute or two of checkout.",
    });
  }

  const r = await contactPaidTag(user.email, user.id);
  if (r.paid) {
    await markPaid(serviceClient(), {
        userId: user.id,
        email: user.email,
        plan: planFromTags(r.tags),
        source: "pull_check",
      });
    return NextResponse.json({ paid: true, checked: true });
  }

  return NextResponse.json({
    paid: false,
    checked: r.checked,
    message: r.checked
      ? `We can't see a payment for ${user.email} yet. If you just paid, give it a minute and check again.`
      : "We couldn't reach the payment system just now. Try again in a minute.",
  });
}
