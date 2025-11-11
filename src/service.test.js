global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

jest.mock('os', () => {
    const originalOs = jest.requireActual('os');
    return {
      ...originalOs,           // keep all real functions
      loadavg: jest.fn(() => [1, 0.5, 0.3]),
      cpus: jest.fn(() => [{}, {}]),
      totalmem: jest.fn(() => 1000),
      freemem: jest.fn(() => 400),
    };
  });
  
const request = require('supertest');
const app = require('./service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
});

test('login', async () => {
  expect(testUserAuthToken).toBeDefined();
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
  expect(password).toBe('a');
});



// Mock fetch so sendMetrics doesn't actually do anything

const metrics = require('./metrics');

describe('metrics module', () => {
  test('full coverage dummy run', async () => {
    // Call requestTracker with dummy request/res/next
    const req = { method: 'GET', path: '/test' };
    const res = { on: jest.fn((event, cb) => cb()) };
    const next = jest.fn();
    metrics.requestTracker(req, res, next);
    expect(next).toHaveBeenCalled();

    // Record auth attempts
    metrics.recordAuthAttempt(true);
    metrics.recordAuthAttempt(false);

    // Track active users
    metrics.trackActiveUserAdd(123);
    metrics.trackActiveUserRemove(123);

    // Record pizza purchases
    metrics.recordPizzaPurchase(true, 10, 4.99);
    metrics.recordPizzaPurchase(false, 5, 0);

    // Trigger gatherMetrics
    const snapshot = require('./metrics').gatherMetrics?.() || [];
    expect(snapshot.length).toBeGreaterThan(0);

    // Trigger reportAndReset
    await metrics.reportAndReset();

  // OS helpers now return predictable numbers
    expect(typeof metrics.getCpuUsagePercentage()).toBe('number');
    expect(typeof metrics.getMemoryUsagePercentage()).toBe('number');
  });
});
