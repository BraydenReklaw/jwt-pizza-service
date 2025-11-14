const config = require('./config.json')

class Logger {
    constructor() {
        this.sanitized = '**Hidden**'
    }

    httpLogger = (req, res, next) => {
        let send = res.send;
        res.send = (resBody) => {
        const logData = {
            service: 'pizza-service',
            authorized: !!req.headers.authorization,
            path: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode,
            reqBody: JSON.stringify(req.body),
            resBody: JSON.stringify(resBody),
        };
        const level = this.statusToLogLevel(res.statusCode);
        this.log(level, 'http', logData);
        res.send = send;
        return res.send(resBody);
        };
        next();
    };

    db(queryString, params = []) {
        const logData = {
            sql: queryString,
            params: params
        }
        this.log('info', 'database', logData)
    }

    log(level, type, logData) {
        const labels = {
            component: config.source,
            level,
            type
        };
        const sanitized = this.sanitized(logData);
        const values = [this.nowString(), sanitized];

        const logEvent = {
            streams: [{
                stream: labels,
                values: [values]
            }]
        };

        this.sendLogToGrafana(logEvent);
    }

    statusToLogLevel(status) {
        if (status >= 500) return 'error';
        if (status >= 400) return 'warn';
        return 'info';
    }

    nowString() {
        return (Math.floor(Date.now()) *  1000000).toString()
    }
}