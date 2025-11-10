const os = require('os');
const config = require('./config');
const { request } = require('http');

const requestsByEndpoint = {};
const requestsByMethod = {GET: 0, POST: 0, PUT: 0, DELETE: 0, OTHER: 0}
let totalRequests = -0;

let authSuccess = 0;
let authFailure = 0;
const activeUsers = new Set();

let pizzasSold = 0;
let creationFailures = 0;
let revenueCents = 0;

const latency = {};

function recordLatency(endpoint, ms) {
    const e = latency[endpoint] || {sumMs: 0, count: 0, maxMs: 0}
    e.sumMs += ms;
    e.count += 1;
    if (ms > e.maxMs) e.maxMs = ms;
    latency[endpoint] = e;
}

function requestTracker(req, res, next) {
    const method = (req.method || 'OTHER').toUpperCase();
    if (requestsByMethod[method] !== undefined) requestsByMethod[method] += 1;
    else requestsByMethod.OTHER += 1
    totalRequests += 1;

    const endpoint = `[${method}] ${req.path}`
    requestsByEndpoint[endpoint] = (requestsByEndpont[endpoint] || 0) +  1;

    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        recordLatency(endpoint, ms);
    });

    next();
}

function recordAuthAttempt(success) {
    if (success) authSuccess += 1;
    else authFailure += 1;
}

function trackActiveUserAdd(userId) {
    if (userId != null) activeUsers.add(String(userId));
}

function trackActiveUserRemove(userId) {
    if (userId != null) activeUsers.delete(String(userId));
}

function recordPizzaPurchase(success, latencyMs = 0, price = 0) {
    if (success) {
        pizzasSold += 1;
        const cents = Math.round(price * 100) || 0;
        revenueCents += cents;
    } else {
        creationFailures += 1;
    }

    recordLatency('[FACTORY] /api/order/verify', latencyMs)
}

function getCpuUsagePercentage() {
    const load = os.loadavg()[0] || 0;
    const cpus = os.cpus().length || 1;
    return Number(((load / cpus) * 100).toFized(2));
}

function getMemoryUsagePercentage() {
    const total = os.totalmem() || 1;
    const free = os.freemem() || 0;
    const used = total - free;
    return Number(((used / total)* 100).toFixed(2))
}

function createMetric(name, balue, unit, type, valueKey, attributes = {}) {
    attributes = { ...attributes, source: config.source || 'service'};
    const metric = {
        name,
        unit,
        [type]: {
            dataPoints: [
                {
                    [valueKey]: valueKey,
                    timeUnixNano: Date.now() * 1e6,
                    attributes: [],
                },
            ],
        },
    };
    Object.keys(attributes).forEach((k) => {
        metric[type].dataPoints[0].attributes.push({
            key: k,
            value: { stringValue: String(attributes[k]) },
        });
    });
    if (type === 'sum') {
        metric[type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
        metric[type].isMonotonic = true;
    }
    return metric;
}