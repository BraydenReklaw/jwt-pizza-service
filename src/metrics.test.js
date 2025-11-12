/**
 * @jest-environment node
 */
jest.useFakeTimers();

const mockConfig = {
  metrics: {
    source: 'testSource',
    url: 'http://mock-url',
    apiKey: 'test-key',
  },
};
jest.mock('./config', () => mockConfig);

jest.mock('systeminformation', () => ({
  currentLoad: jest.fn(() => Promise.resolve({ currentLoad: 42.1234 })),
}));

jest.mock('os', () => ({
  totalmem: jest.fn(() => 1000),
  freemem: jest.fn(() => 400),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
  })
);

const metrics = require('./metrics'); // your file’s name

describe('metrics full coverage', () => {
  it('covers everything', async () => {
    // ---- requestTracker ----
    const req = { method: 'GET', path: '/test' };
    const res = {
      on: (event, fn) => {
        if (event === 'finish') fn();
      },
    };
    const next = jest.fn();
    metrics.requestTracker(req, res, next);
    expect(next).toHaveBeenCalled();

    // ---- recordAuthAttempt ----
    metrics.recordAuthAttempt(true);
    metrics.recordAuthAttempt(false);

    // ---- Active user tracking ----
    metrics.trackActiveUserAdd('user1');
    metrics.trackActiveUserRemove('user1');

    // ---- Pizza purchase tracking ----
    metrics.recordPizzaPurchase(true, 50, 10);
    metrics.recordPizzaPurchase(false, 100, 0);

    // ---- Latency recording ----
    // indirectly covered, but call directly too
    metrics.createMetric('test', 123, 'unit', 'sum', 'asInt', { foo: 'bar' });

    // ---- Memory & CPU usage ----
    const mem = metrics.getMemoryUsagePercentage();
    expect(mem).toBe('60.00');
    const cpu = await metrics.getCpuUsagePercentage();
    expect(cpu).toBe('42.12');

    // ---- sendMetricToGrafana success ----
    await metrics.sendMetricToGrafana([{ name: 'testMetric' }]);
    expect(global.fetch).toHaveBeenCalled();

    // ---- sendMetricToGrafana failure path ----
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await metrics.sendMetricToGrafana([{ name: 'failMetric' }]);

    // ---- trigger the setInterval ----
    jest.advanceTimersByTime(15000);
    await Promise.resolve(); // let async code run

    // Done — all code paths touched
  });
});
