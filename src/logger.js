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

    factoryRequest(url, requestBody, responseBody, status) {
        const logData = {
            service: 'pizza-factory',
            url,
            requestBody,
            responseBody,
            status
        }

        const level = this.statusToLogLevel(status);
        this.log(level, 'factory', logData)
    }

    exception(error) {
        const logData = {
            message: error.message,
            stack: error.stack
        };

        this.log('error', 'exception', logData)
    }

    log(level, type, logData) {
        const labels = {
            component: config.source,
            level,
            type
        };
        const sanitizedData = this.sanitize(logData);
        const values = [this.nowString(), sanitizedData];

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

    sanitize(logData) {
        let str = JSON.stringify(logData);

        const redactions = [
            /"password"\s*:\s*"[^"]*"/gi,
            /"token"\s*:\s*"[^"]*"/gi,
            /"authorization"\s*:\s*"[^"]*"/gi,
            /"auth"\s*:\s*"[^"]*"/gi,
            /"email"\s*:\s*"[^"]*"/gi  
        ];

        redactions.forEach(pattern => {
            str = str.replace(pattern, (match) => {
                const key = match.split(':')[0];
                return `${key}: "${this.sanitized}`
            })
        })

        return str;
    }

    sendLogToGrafana(event) {
        const body = JSON.stringify(event);
        fetch(`${config.url}`, {
            method: 'post',
            body: body,
            headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.userId}:${config.apiKey}`,
            },
        }).then((res) => {
            if (!res.ok) console.log('Failed to send log to Grafana');
        });
    }
}