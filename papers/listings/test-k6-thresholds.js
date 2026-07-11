// Source: tests/load/fastpath-audit.js (lines 83-90)
// Listing id: test-k6-thresholds
// Caption: k6 fastpath audit SLO thresholds (p95 latency bounds)
  thresholds: {
    health_latency: ["p(95)<500", "p(99)<1000"],
    webhook_happy_latency: ["p(95)<3000", "p(99)<5000"],
    webhook_invalid_latency: ["p(95)<500"],
    webhook_auth_fail_latency: ["p(95)<500"],
    webhook_success_rate: ["rate>0.80"], // >80% reach hoox-success status (gateway accepted)
    errors_total: ["count<1000"],
  },
