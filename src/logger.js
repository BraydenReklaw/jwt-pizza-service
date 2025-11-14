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

    statusToLogLevel(status) {
        if (status >= 500) return 'error';
        if (status >= 400) return 'warn';
        return 'info';
    }
}