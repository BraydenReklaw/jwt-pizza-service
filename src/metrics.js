const config = require('./config');

const requests = {}
let totalRequests = 0;
const methodRequests = { GET: 0, POST: 0, PUT: 0, DELETE: 0};

const authAttempts = { success: 0, failure: 0 }

const activeUsers = new Set();

function requestTracker(req, res, next) {
    const endpoint = `[${req.method}] ${req.path}`;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    totalRequests++;
    if (methodRequests[req.method] !== undefined) {
        methodRequests[req.method]++;
    } else {
        methodRequests[req.method] = 1;
    }
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

setInterval(() => {
    const metrics = [];

    metrics.push(createMetric('totalRequests', totalRequests, '1', 'sum', 'asInt', {}));
    Object.entries(methodRequests).forEach(([method, count]) => {
        metrics.push(createMetric('requestsByMethod', count, '1', 'sum', 'asInt', {method}));  
    })
    metrics.push(createMetric('activeUsers', activeUsers.size, '1', 'gauge', 'asInt', {}));

    metrics.push(createMetric('authAttemptsSuccess', authAttempts.success, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('authAttemptsFailure', authAttempts.failure, '1', 'sum', 'asInt', {}));

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
    trackActiveUserRemove
}