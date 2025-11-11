const os = require('os');
const config = require('./config');

const requestsByEndpoint = {};
const requestsByMethod = {GET: 0, POST: 0, PUT: 0, DELETE: 0, OTHER: 0}
let totalRequests = 0;

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
    requestsByEndpoint[endpoint] = (requestsByEndpoint[endpoint] || 0) +  1;

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
        const cents = price;
        revenueCents += cents;
    } else {
        creationFailures += 1;
    }

    recordLatency('[FACTORY] /api/order/verify', latencyMs)
}

function getCpuUsagePercentage() {
    const load = os.loadavg()[0] || 0;
    const cpus = os.cpus().length || 1;
    return Number(((load / cpus) * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
    const total = os.totalmem() || 1;
    const free = os.freemem() || 0;
    const used = total - free;
    return Number(((used / total)* 100).toFixed(2))
}

function createMetric(name, value, unit, type, valueKey, attributes = {}) {
    attributes = { ...attributes, source: config.source || 'service'};
    const metric = {
        name,
        unit,
        [type]: {
            dataPoints: [
                {
                    [valueKey]: value,
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

function gatherMetrics() {
    const metrics = [];

    metrics.push(createMetric('requests_total', totalRequests, '1', 'sum', 'asInt'));
    Object.keys(requestsByMethod).forEach((m) => {
        metrics.push(createMetric('requests_by_method', requestsByMethod[m], '1', 'sum', 'asInt', {method: m}));
    });
    Object.keys(requestsByEndpoint).forEach((ep) => {
        metrics.push(createMetric('requests_by_endpoint', requestsByEndpoint[ep], '1', 'sum', 'asInt', {endpoint: ep}));    
    });

    metrics.push(createMetric('auth_success', authSuccess, '1', 'sum', 'asInt'));
    metrics.push(createMetric('auth_failure', authFailure, '1', 'sum', 'asInt'));
    
    metrics.push(createMetric('active_users', activeUsers.size, '1', 'gauge', 'asInt'));

    metrics.push(createMetric('pizzas_sold', pizzasSold, '1', 'sum','asInt'));
    metrics.push(createMetric('pizza_failures', creationFailures, '1', 'sum', 'asInt'));
    metrics.push(createMetric('revenue', revenueCents, 'cents', 'sum', 'asInt'));

    metrics.push(createMetric('cpu_usage', getCpuUsagePercentage(), 'percent', 'gauge', 'asDouble'));
    metrics.push(createMetric('memory_usage', getMemoryUsagePercentage(), 'percent', 'gauge', 'asDouble'));

    Object.keys(latency).forEach((ep) => {
        const {sumMs, count, maxMs} = latency[ep];
        const avg = count > 0 ? Math.round(sumMs / count) : 0;
        metrics.push(createMetric('Latency_average', avg, 'ms', 'gauge', 'asInt', {endpoint: ep}));
        metrics.push(createMetric('latency_max', maxMs, 'ms', 'gauge', 'asInt', {endpoint: ep}));
        metrics.push(createMetric('Latency_count', count, '1', 'sum', 'asInt', {endpoint: ep}));
    });

    return metrics;
}

async function sendMetrics(metrics) {
    const body = {
        resourceMetrics: [{
            scopeMetrics: [{
                metrics
            }]
        }]
    };
    try {
        await fetch(config.metrics.url, {
            method: 'POST',
            headers: {
                Authorization: config.metrics.apiKey ? `Bearer ${config.metrics.apiKey}` : undefined,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            });
        } catch (err) {
            console.error('Error sending metrics ', err);
        }
}

const intervalMs = config.metricsInterval || 60 * 1000;

async function reportAndReset() {
    try {
        const snapshot = gatherMetrics();
        await sendMetrics(snapshot);
        console.log('Reporting metrics...');

setInterval(reportAndReset, intervalMs);

module.exports = {
    requestTracker,
    recordAuthAttempt,
    trackActiveUserAdd,
    trackActiveUserRemove,
    recordPizzaPurchase,
    gatherMetrics,
    reportAndReset,
    getCpuUsagePercentage,
    getMemoryUsagePercentage
}