import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3008';

export const options = {
  discardResponseBodies: true,
  scenarios: {
    // Simula usuarios navegando por el frontend
    web_pages: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 250 },
        { duration: '30s', target: 300 },
        { duration: '30s', target: 350 },
        { duration: '30s', target: 400 },
        { duration: '30s', target: 0 },
      ],
      exec: 'webScenario',
    },

    // Simula intentos de login concurrentes contra DB
    login_api: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: 25 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 75 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 125 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 0 },
      ],
      exec: 'loginScenario',
      startTime: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    checks: ['rate>0.95'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const pageEndpoints = ['/', '/login', '/register', '/config'];

export function webScenario() {
  const endpoint = pageEndpoints[Math.floor(Math.random() * pageEndpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);
  check(res, {
    'web status ok': (r) => r.status >= 200 && r.status < 400,
  });
  sleep(0.3);
}

export function loginScenario() {
  const payload = JSON.stringify({
    correo: `stress_${__VU}_${__ITER}@example.com`,
    password: 'incorrect_password',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  check(res, {
    'login responds': (r) => r.status === 401 || r.status === 200,
    'login not 5xx': (r) => r.status < 500,
  });
  sleep(0.2);
}
