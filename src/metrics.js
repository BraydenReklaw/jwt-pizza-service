const config = require('./config');
const si = require('systeminformation');
const os = require('os');


const requests = {}
let totalRequests = 0;
const methodRequests = { GET: 0, POST: 0, PUT: 0, DELETE: 0};

const authAttempts = { success: 0, failure: 0 }

const activeUsers = new Set();
let pizzascreated = 0;
let pizzasfailed = 0;
let profit = 0;

const latencyRecords = {}

function requestTracker(req, res, next) {
    const start = Date.now(); 
    const endpoint = `[${req.method}] ${req.path}`;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    totalRequests++;
    if (methodRequests[req.method] !== undefined) {
        methodRequests[req.method]++;
    } else {
        methodRequests[req.method] = 1;
    }

    res.on('finish', () => {
      const latencyMs = Date.now() - start;
      recordLatency(endpoint, latencyMs);
    })
    next();
}

function authAttempt(success) {
    if (success) {
        authAttempts.success++;
    } else {
        authAttempts.failure++;
    }
}

function trackActiveUserAdd(userId) {
    if (userId) {
        activeUsers.add(userId);
    }
}

function trackActiveUserRemove(userId) {
    if (userId) {
        activeUsers.delete(userId);
    }   
}

function recordPizzaPurchase(success, latencyMs, total) {
  if (success) {
    pizzascreated++;
    profit += total;
  } else {
    pizzasfailed++;
  }

  recordLatency('[FACTORY] /api/order/verify', latencyMs)
}

function recordLatency(endpoint, latencyMs) {
  const latency = latencyRecords[endpoint] || {sumMs: 0, count: 0, maxMs: 0}
  latency.sumMs += latencyMs;
  latency.count += 1;
  if (latencyMs > latency.maxMs) {
    latency.maxMs = latencyMs;
  }
  latencyRecords[endpoint] = latency;
}


async function getCpuUsagePercentage() {
  // const cpuUsage = os.loadavg()[0] / os.cpus().length;
  // return cpuUsage.toFixed(2) * 100;
  const load = await si.currentLoad();
  return load.currentLoad.toFixed(2);
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

setInterval(async () => {
    const metrics = [];

    metrics.push(createMetric('totalRequests', totalRequests, '1', 'sum', 'asInt', {}));
    Object.entries(methodRequests).forEach(([method, count]) => {
        metrics.push(createMetric('requestsByMethod', count, '1', 'sum', 'asInt', {method}));  
    })
    metrics.push(createMetric('activeUsers', activeUsers.size, '1', 'gauge', 'asInt', {}));

    metrics.push(createMetric('authAttemptsSuccess', authAttempts.success, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('authAttemptsFailure', authAttempts.failure, '1', 'sum', 'asInt', {}));

    const cpuUsage = parseFloat(await getCpuUsagePercentage());
    const memoryUsage = parseFloat(getMemoryUsagePercentage());

    // console.log(cpuUsage)

    metrics.push(createMetric('cpuUsagePercent', cpuUsage, '%', 'gauge', 'asDouble', {}));
    metrics.push(createMetric('memoryUsagePercent', memoryUsage, '%', 'gauge', 'asDouble', {}));

    metrics.push(createMetric('pizzasMade', pizzascreated, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('pizzasFailed', pizzasfailed, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('profit', profit, 'BTC', 'sum', 'asDouble', {}));

    Object.entries(latencyRecords).forEach(([endpoint, {sumMs, count, maxMs}]) => {
      const avg = count > 0 ? Math.round(sumMs / count) : 0;
      metrics.push(createMetric('LatencyAvgMs', avg, 'ms', 'gauge', 'asDouble', {endpoint}));
      metrics.push(createMetric('LatencyMaxMs', maxMs, 'ms', 'gauge', 'asDouble', {endpoint}));
      metrics.push(createMetric('LatencyCount', count, '1', 'sum', 'asInt', {endpoint}));
      latencyRecords[endpoint] = { sumMs: 0, count: 0, maxMs: 0 };
    })
    sendMetricToGrafana(metrics)
    console.log('pushed to grafana')
    
}, 15000) //every 15 seconds

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
        
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}


module.exports = {
    requestTracker,
    recordAuthAttempt: authAttempt,
    trackActiveUserAdd,
    trackActiveUserRemove,
    recordPizzaPurchase,
    // testing functions
    getCpuUsagePercentage,
    getMemoryUsagePercentage,
    createMetric,
    sendMetricToGrafana
}