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