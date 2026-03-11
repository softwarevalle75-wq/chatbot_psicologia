/* global __ENV */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3008';

export const options = {
  discardResponseBodies: true,
  scenarios: {
    public_web_extreme: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '30s', target: 400 },
        { duration: '30s', target: 600 },
        { duration: '30s', target: 800 },
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 1200 },
        { duration: '30s', target: 1500 },
        { duration: '30s', target: 1500 },
        { duration: '30s', target: 0 },
      ],
      exec: 'publicScenario',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    checks: ['rate>0.95'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const endpoints = ['/', '/login', '/register', '/config', '/consentimiento', '/sociodemografico'];

export function publicScenario() {
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);

  check(res, {
    'public status ok': (r) => r.status >= 200 && r.status < 400,
  });

  sleep(0.15);
}
