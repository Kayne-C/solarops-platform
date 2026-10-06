// Portfolio dashboard under sustained load (HybridCache L1 + Redis L2, tag invalidation).
//   k6 run tests/load/dashboard-read.js -e BASE_URL=http://localhost:8080 -e RATE=500
// Raise the per-tenant rate limit first (RateLimiting__TenantPermitsPerSecond), otherwise
// the noisy-neighbour limiter will — correctly — answer 429.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  scenarios: {
    dashboard: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 500),
      timeUnit: '1s',
      duration: __ENV.DURATION || '60s',
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<50', 'p(99)<100'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE}/api/v1/auth/token`,
    JSON.stringify({ tenant: 'anatolia-solar', email: 'engineer@anatolia-solar.demo', password: 'SolarOps!2026' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.json('accessToken') };
}

export default function (data) {
  const now = new Date();
  const res = http.get(
    `${BASE}/api/v1/portfolio/performance?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`,
    { headers: { Authorization: `Bearer ${data.token}` } },
  );
  check(res, { 'status is 200': (r) => r.status === 200 });
}
