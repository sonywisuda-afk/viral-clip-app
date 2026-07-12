export type AlertSeverity = 'warning' | 'critical';

export interface AlertDefinition {
  id: string;
  severity: AlertSeverity;
  message: string;
}

export interface Alert extends AlertDefinition {
  since: string;
}

// The "internal alert state" the user asked for - not a background
// scheduler (there is deliberately no timer or external sink here, per
// this project's explicit "foundation only" scope), just an in-memory
// record of when each currently-true condition FIRST became true, kept
// across calls to GET /alerts so a caller polling that endpoint can show
// "backlogged since 14:02" instead of only "backlogged: true" with no
// duration. Cleared the moment a condition stops being true - if it
// recurs later, that's a new incident with a new `since`, not a
// resumption of the old one.
//
// Process-local, same caveat as metrics-registry.ts and
// apps/worker's subprocessLimiter.ts - restarting apps/api resets every
// alert's `since` to "now" the next time it's still true, even if it had
// already been active for hours. Acceptable for a foundation with no
// external sink yet; revisit if/when alerts start being persisted or
// forwarded somewhere that survives a restart.
class AlertStateTracker {
  private readonly active = new Map<string, string>();

  evaluate(currentlyTrue: AlertDefinition[]): Alert[] {
    const now = new Date().toISOString();
    const currentIds = new Set(currentlyTrue.map((alert) => alert.id));

    for (const id of currentIds) {
      if (!this.active.has(id)) {
        this.active.set(id, now);
      }
    }
    for (const id of [...this.active.keys()]) {
      if (!currentIds.has(id)) {
        this.active.delete(id);
      }
    }

    return currentlyTrue.map((alert) => ({ ...alert, since: this.active.get(alert.id) ?? now }));
  }
}

export const alertStateTracker = new AlertStateTracker();
