// Write path: each iteration upserts one full year of daily yields (365/366 rows) for one plant.
// Every VU owns a distinct (plant, year) pair, so the test measures throughput rather than lock contention.
// Values alternate between iterations so that every request really writes (updates, not no-ops).
//   k6 run tests/load/bulk-ingest.js -e BASE_URL=http://localhost:8080 -e VUS=6
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const YEARS = [2024, 2025];
// Central Anatolia specific yield (kWh/kWp per month), same profile the demo baselines use.
const PROFILE = [72, 92, 135, 158, 182, 198, 210, 196, 162, 124, 86, 66];
const rowsWritten = new Counter('rows_written');

export const options = {
  scenarios: {
    ingest: { executor: 'constant-vus', vus: Number(__ENV.VUS || 6), duration: __ENV.DURATION || '60s' },
  },
  thresholds: { http_req_failed: ['rate<0.01'] },
};

export function setup() {
  const login = http.post(
    `${BASE}/api/v1/auth/token`,
    JSON.stringify({ tenant: 'anatolia-solar', email: 'engineer@anatolia-solar.demo', password: 'SolarOps!2026' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const token = login.json('accessToken');
  const plants = http.get(`${BASE}/api/v1/plants?pageSize=100`, { headers: { Authorization: `Bearer ${token}` } }).json('items');
  return { token, plants: plants.map((p) => ({ id: p.id, kwp: p.installedCapacityKwp })) };
}

export default function (data) {
  const slot = (__VU - 1) % (data.plants.length * YEARS.length);
  const plant = data.plants[slot % data.plants.length];
  const year = YEARS[Math.floor(slot / data.plants.length)];

  const entries = [];
  for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) {
    const month = d.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const kwhPerKwp = (PROFILE[month] / daysInMonth) * (0.95 + (__ITER % 2) * 0.01);
    entries.push({ date: d.toISOString().slice(0, 10), energyKwh: Math.round(plant.kwp * kwhPerKwp * 10) / 10 });
  }

  const res = http.put(`${BASE}/api/v1/plants/${plant.id}/daily-yields`, JSON.stringify({ entries, source: 'Telemetry' }), {
    headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' },
  });

  if (check(res, { 'status is 200': (r) => r.status === 200 })) {
    rowsWritten.add(res.json('created') + res.json('updated'));
  }
}
