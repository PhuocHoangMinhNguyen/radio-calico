import http from 'k6/http';
import { check, sleep } from 'k6';

// Quick test configuration - 10 seconds only
export const options = {
  stages: [
    { duration: '5s', target: 5 },   // Ramp up to 5 users
    { duration: '5s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // More lenient for quick test
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health check OK': (r) => r.status === 200,
  });

  sleep(1);

  // Test GET ratings
  const getRatingsRes = http.get(
    `${BASE_URL}/api/ratings?title=TestSong&artist=TestArtist`
  );
  check(getRatingsRes, {
    'GET ratings OK': (r) => r.status === 200,
  });

  sleep(1);
}

export function setup() {
  console.log('Quick load test (10 seconds) against ' + BASE_URL);
}
