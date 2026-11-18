// When this browser last opened the tour, so new steps can be flagged.
// Per-viewer convenience only: if storage is unavailable, nothing is
// flagged and nothing breaks.
const KEY = "unybase-tour-seen";

export function readTourSeen(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeTourSeen(date: string) {
  try {
    localStorage.setItem(KEY, date);
  } catch {
    /* storage blocked */
  }
}
