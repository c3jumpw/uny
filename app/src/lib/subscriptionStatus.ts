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

export type DisplayStatus =
  | "cut_off"
  | "cutoff_recommended"
  | "escalated"
  | "warning"
  | "grace"
  | "active"
  | "never_paid"
  | "cancelled";

export type StatusRow = {
  user_id: string;
  last_payment_at: string | null;
  last_payment_failed_at: string | null;
  subscription_state: string; // 'active' | 'lapsed' | 'cancelled' | 'never_paid'
  automations_active: boolean;
  cut_off_at: string | null;
};

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
    return {
      status: "never_paid",
      label: "Never paid",
      color: "#7c7568",
      bg: "rgba(60,60,60,.15)",
      daysLapsed: null,
      priority: 1,
      actionHint: "Awaiting first payment",
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
