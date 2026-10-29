// Compute display status from stored subscription state.
//
// Design principle: nothing auto-cuts. This function tells the
// admin what to *look at*; the cutoff toggle is always manual.
//
// Timing matrix (days since last_payment_failed_at):
//   payment current            -> Active            (green)
//   0-3 days                   -> Grace period      (yellow)
//   4-7 days                   -> Warning           (orange)
//   8-14 days                  -> Escalated         (red)
//   15+ days                   -> Cutoff recommended (dark red, top of list)
//   admin flipped toggle       -> Cut off           (grey)
//   never paid                 -> Never paid        (muted)
//   cancelled by client        -> Cancelled         (grey)
//   manual trial (admin-set)   -> On trial / Trial ends in Nd / Trial ended

export type DisplayStatus =
  | "cut_off"
  | "cutoff_recommended"
  | "escalated"
  | "warning"
  | "grace"
  | "active"
  | "never_paid"
  | "exempt"
  | "signup_incomplete"
  | "trial"
  | "trial_ending"
  | "trial_expired"
  | "cancelled";

export type StatusRow = {
  user_id: string;
  last_payment_at: string | null;
  last_payment_failed_at: string | null;
  subscription_state: string; // 'active' | 'lapsed' | 'cancelled' | 'never_paid'
  automations_active: boolean;
  cut_off_at: string | null;
  billing_exempt?: boolean | null;
  exempt_reason?: string | null;
  intended_plan?: string | null;
  plan_selected_at?: string | null;
  created_at?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_note?: string | null;
  trial_converted_at?: string | null;
  intended_cycle?: string | null;
};

// A trial counts while it has an end date, has not been converted
// into a paid subscription, and the account is not already paying.
export type TrialState = {
  onTrial: boolean;
  expired: boolean;
  daysLeft: number | null;
  endsAt: string | null;
};

export function trialState(row: StatusRow): TrialState {
  if (!row.trial_ends_at || row.trial_converted_at || row.subscription_state === "active") {
    return { onTrial: false, expired: false, daysLeft: null, endsAt: null };
  }
  const ms = new Date(row.trial_ends_at).getTime() - Date.now();
  const daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return {
    onTrial: ms > 0,
    expired: ms <= 0,
    daysLeft: ms > 0 ? daysLeft : Math.floor(ms / (24 * 60 * 60 * 1000)),
    endsAt: row.trial_ends_at,
  };
}

// Someone who signed up and never picked a plan is a different
// problem from someone who picked one and never paid. The first is
// a stalled funnel we can nudge; the second is a billing issue.
// Collapsing both into "never_paid" hides the one we can actually
// act on, so it gets its own state and its own clock.
export type SignupState = {
  incomplete: boolean;
  daysSinceSignup: number | null;
  /** Which nudge step is due, or null if none is. */
  nudgeStep: 1 | 2 | 3 | null;
};

const NUDGE_DAYS: Array<{ day: number; step: 1 | 2 | 3 }> = [
  { day: 1, step: 1 },
  { day: 3, step: 2 },
  { day: 7, step: 3 },
];

export function signupState(row: StatusRow): SignupState {
  // Exempt accounts never chose a plan and never will. Nudging them
  // about it would be noise aimed at ourselves.
  if (row.billing_exempt || trialState(row).onTrial) {
    return { incomplete: false, daysSinceSignup: null, nudgeStep: null };
  }
  const hasPlan = Boolean(row.intended_plan || row.plan_selected_at);
  const hasPaid = Boolean(row.last_payment_at) || row.subscription_state === "active";
  if (hasPlan || hasPaid) {
    return { incomplete: false, daysSinceSignup: null, nudgeStep: null };
  }
  if (!row.created_at) {
    return { incomplete: true, daysSinceSignup: null, nudgeStep: null };
  }
  const days = Math.floor(
    (Date.now() - new Date(row.created_at).getTime()) / (24 * 60 * 60 * 1000)
  );
  // The due step is the largest threshold the account has passed.
  // After day 7 we stop: three unanswered emails is enough.
  let nudgeStep: 1 | 2 | 3 | null = null;
  for (const n of NUDGE_DAYS) {
    if (days >= n.day) nudgeStep = n.step;
  }
  return { incomplete: true, daysSinceSignup: days, nudgeStep };
}

export type StatusMeta = {
  status: DisplayStatus;
  label: string;
  color: string; // css color from our tokens
  bg: string;
  daysLapsed: number | null;
  priority: number; // for sorting: higher = show first
  actionHint: string;
};

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

export function computeStatus(row: StatusRow): StatusMeta {
  // An explicit cutoff still wins over exemption: if someone
  // deliberately paused an internal workspace, that decision should
  // be visible rather than masked by the exemption badge.
  if (!row.automations_active || row.cut_off_at) {
    return {
      status: "cut_off",
      label: "Cut off",
      color: "#9C9488",
      bg: "rgba(60,60,60,.35)",
      daysLapsed: null,
      priority: 5,
      actionHint: "Restore when payment resumes",
    };
  }

  // Exemption suppresses the entire billing ladder. Internal
  // workspaces have no lapse clock, so there is nothing to escalate.
  if (row.billing_exempt) {
    return {
      status: "exempt",
      label: "Internal — no billing",
      color: "#b79be8",
      bg: "rgba(150,110,220,.15)",
      daysLapsed: null,
      priority: 2,
      actionHint:
        row.exempt_reason?.trim() ||
        "Billing-exempt internal account. Payment tracking does not apply.",
    };
  }

  // Manual trials sit above the never-paid / cancelled branches: a
  // prospect on a trial is neither, and the admin needs to see the
  // trial clock rather than "awaiting first payment".
  const trial = trialState(row);
  if (trial.onTrial || trial.expired) {
    const d = trial.daysLeft ?? 0;
    if (trial.expired) {
      const ago = Math.abs(d);
      return {
        status: "trial_expired",
        label: ago === 0 ? "Trial ended today" : `Trial ended ${ago}d ago`,
        color: "#ffb066",
        bg: "rgba(200,120,40,.22)",
        daysLapsed: ago,
        priority: 70,
        actionHint:
          "Trial is over and no payment has arrived. They now see the plan picker when they log in. Extend, convert or follow up.",
      };
    }
    if (d <= 3) {
      return {
        status: "trial_ending",
        label: d <= 1 ? "Trial ends tomorrow" : `Trial ends in ${d}d`,
        color: "#ffd76a",
        bg: "rgba(200,170,50,.15)",
        daysLapsed: null,
        priority: 50,
        actionHint: row.trial_note?.trim() || "Trial ending soon. Good moment to check in.",
      };
    }
    return {
      status: "trial",
      label: `On trial — ${d}d left`,
      color: "#6ec8d8",
      bg: "rgba(90,190,215,.15)",
      daysLapsed: null,
      priority: 8,
      actionHint: row.trial_note?.trim() || "Manual trial granted by an admin.",
    };
  }

  if (row.subscription_state === "cancelled") {
    return {
      status: "cancelled",
      label: "Cancelled",
      color: "#9C9488",
      bg: "rgba(60,60,60,.25)",
      daysLapsed: null,
      priority: 4,
      actionHint: "Client cancelled subscription",
    };
  }

  if (row.subscription_state === "never_paid" && !row.last_payment_at) {
    const signup = signupState(row);
    if (signup.incomplete) {
      const d = signup.daysSinceSignup;
      return {
        status: "signup_incomplete",
        label: d === null ? "No plan chosen" : `No plan chosen — ${d}d`,
        color: "#8fb8d8",
        bg: "rgba(90,169,230,.14)",
        daysLapsed: d,
        // Above "never paid" but below any billing problem: worth a
        // nudge, not worth interrupting a cutoff review for.
        priority: d !== null && d >= 7 ? 35 : 15,
        actionHint:
          "Signed up but never chose a plan. Automated nudges go out on days 1, 3 and 7.",
      };
    }
    return {
      status: "never_paid",
      label: "Awaiting first payment",
      color: "#7c7568",
      bg: "rgba(60,60,60,.15)",
      daysLapsed: null,
      priority: 1,
      actionHint: "Plan chosen, first payment not received yet",
    };
  }

  if (row.last_payment_failed_at) {
    const days = Math.floor(
      (Date.now() - new Date(row.last_payment_failed_at).getTime()) / DAYS_TO_MS
    );
    if (days >= 15) {
      return {
        status: "cutoff_recommended",
        label: `${days}d lapsed — cutoff recommended`,
        color: "#ffb3b3",
        bg: "rgba(180,30,30,.35)",
        daysLapsed: days,
        priority: 100,
        actionHint: "Client has been non-paying 15+ days. Review and cutoff.",
      };
    }
    if (days >= 8) {
      return {
        status: "escalated",
        label: `${days}d lapsed — escalated`,
        color: "#ff8080",
        bg: "rgba(180,60,60,.25)",
        daysLapsed: days,
        priority: 80,
        actionHint: "Contact client. Approaching cutoff recommendation.",
      };
    }
    if (days >= 4) {
      return {
        status: "warning",
        label: `${days}d lapsed — warning`,
        color: "#ffb066",
        bg: "rgba(200,120,40,.2)",
        daysLapsed: days,
        priority: 60,
        actionHint: "Check with client on payment status.",
      };
    }
    return {
      status: "grace",
      label: `${days}d lapsed — grace period`,
      color: "#ffd76a",
      bg: "rgba(200,170,50,.15)",
      daysLapsed: days,
      priority: 40,
      actionHint: "Monitor. Payment may retry automatically.",
    };
  }

  return {
    status: "active",
    label: "Active",
    color: "#7CC084",
    bg: "rgba(120,180,120,.15)",
    daysLapsed: null,
    priority: 10,
    actionHint: "Paying on schedule",
  };
}

export function sortByPriority<T extends { statusMeta: StatusMeta }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.statusMeta.priority !== a.statusMeta.priority)
      return b.statusMeta.priority - a.statusMeta.priority;
    return (b.statusMeta.daysLapsed ?? 0) - (a.statusMeta.daysLapsed ?? 0);
  });
}

// ---------------------------------------------------------------
// Paywall
// ---------------------------------------------------------------
//
// Who has to choose and pay for a plan before using the dashboard.
// Only accounts that have never paid (or cancelled) are gated.
// Lapsed and cut-off accounts keep the dashboard: they are on the
// billing ladder, where a human makes the call, and locking them out
// would contradict "nothing auto-cuts".

export type AccessReason =
  | "admin"
  | "exempt"
  | "paying"
  | "billing_issue"
  | "trial"
  | "collaborator"
  | "needs_plan"
  | "trial_ended"
  | "cancelled";

export function accessFor(
  row: StatusRow | null,
  opts: { isAdmin: boolean; isCollaborator?: boolean }
): { allowed: boolean; reason: AccessReason } {
  if (opts.isAdmin) return { allowed: true, reason: "admin" };
  if (row?.billing_exempt) return { allowed: true, reason: "exempt" };
  if (row && (row.subscription_state === "active" || row.trial_converted_at)) {
    return { allowed: true, reason: "paying" };
  }
  if (row && (row.subscription_state === "lapsed" || row.cut_off_at || !row.automations_active)) {
    return { allowed: true, reason: "billing_issue" };
  }
  const trial = row ? trialState(row) : null;
  if (trial?.onTrial) return { allowed: true, reason: "trial" };
  // Someone a client shared credentials with needs to read them
  // without buying a plan of their own.
  if (opts.isCollaborator) return { allowed: true, reason: "collaborator" };
  if (trial?.expired) return { allowed: false, reason: "trial_ended" };
  if (row?.subscription_state === "cancelled") return { allowed: false, reason: "cancelled" };
  return { allowed: false, reason: "needs_plan" };
}
