// A deliberately tiny in-process counter, not a metrics library - the user
// asked explicitly not to introduce Prometheus/OpenTelemetry/Grafana for
// this. GET /metrics (monitoring.controller.ts) exposes this as JSON; if a
// real metrics backend is adopted later, this is the one place that would
// need to start pushing to it instead of just counting in memory.
//
// Process-local only, same caveat as apps/worker's subprocessLimiter.ts
// in-memory counters - with N horizontally-scaled apps/api replicas, each
// replica reports only its own share of requests, not a cluster-wide total.
// Fine for this endpoint's purpose (a quick "is this instance under load"
// signal), not a substitute for a real aggregated metrics backend.
class MetricsRegistry {
  private totalRequests = 0;
  private readonly requestsByStatusClass: Record<string, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };

  recordRequest(statusCode: number): void {
    this.totalRequests += 1;
    const bucket = `${Math.floor(statusCode / 100)}xx`;
    if (bucket in this.requestsByStatusClass) {
      this.requestsByStatusClass[bucket] += 1;
    } else {
      this.requestsByStatusClass.other += 1;
    }
  }

  snapshot() {
    return {
      totalRequests: this.totalRequests,
      byStatusClass: { ...this.requestsByStatusClass },
    };
  }
}

// One instance per process, imported by both the middleware (writer) and
// the controller (reader) - a NestJS provider would work equally well here,
// but this has no dependencies of its own and no lifecycle to manage, so a
// module-level singleton (same pattern as packages/storage's lazy S3Client)
// is simpler.
export const metricsRegistry = new MetricsRegistry();
