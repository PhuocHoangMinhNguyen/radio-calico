import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
    errors: ['rate<0.01'],            // Custom error rate
  },
};

// Base URL - can be overridden with K6_BASE_URL environment variable
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';

// Sample test data
const songs = [
  { title: 'Test Song 1', artist: 'Test Artist 1' },
  { title: 'Test Song 2', artist: 'Test Artist 2' },
  { title: 'Test Song 3', artist: 'Test Artist 3' },
  { title: 'Test Song 4', artist: 'Test Artist 4' },
  { title: 'Test Song 5', artist: 'Test Artist 5' },
];

export default function () {
  // Test 1: Health Check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  const healthCheck = check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check returns healthy status': (r) => {
      try {
        return JSON.parse(r.body).status === 'healthy';
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!healthCheck);

  sleep(1);

  // Test 2: GET ratings
  const song = songs[Math.floor(Math.random() * songs.length)];
  const getRatingsRes = http.get(
    `${BASE_URL}/api/ratings?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`
  );
  const getRatingsCheck = check(getRatingsRes, {
    'GET ratings status is 200': (r) => r.status === 200,
    'GET ratings returns valid data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.thumbs_up === 'number' && typeof body.thumbs_down === 'number';
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!getRatingsCheck);

  sleep(1);

  // Test 3: POST rating (with 30% probability to avoid excessive DB writes)
  if (Math.random() < 0.3) {
    const rating = Math.random() < 0.5 ? 'up' : 'down';
    const postRatingsRes = http.post(
      `${BASE_URL}/api/ratings`,
      JSON.stringify({
        title: song.title,
        artist: song.artist,
        rating: rating,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const postRatingsCheck = check(postRatingsRes, {
      'POST ratings status is 200': (r) => r.status === 200,
      'POST ratings returns success': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!postRatingsCheck);
  }

  sleep(2);

  // Test 4: Error logging (with 10% probability)
  if (Math.random() < 0.1) {
    const errorLogRes = http.post(
      `${BASE_URL}/api/errors`,
      JSON.stringify({
        message: 'Load test error message',
        source: 'app',
        severity: 'info',
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const errorLogCheck = check(errorLogRes, {
      'POST errors status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
    errorRate.add(!errorLogCheck);
  }

  sleep(1);
}

// Setup function - runs once before the test
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log('Test configuration:');
  console.log('  - Ramp up to 100 concurrent users over 3.5 minutes');
  console.log('  - Maintain 100 users for 1 minute');
  console.log('  - Ramp down over 30 seconds');
  console.log('  - Total duration: 5 minutes');
  console.log('');
  console.log('Success criteria:');
  console.log('  - 95% of requests complete in <500ms');
  console.log('  - Error rate <1%');
  console.log('');
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Load test completed');
}
