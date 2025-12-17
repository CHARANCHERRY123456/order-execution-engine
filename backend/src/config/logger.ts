import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? 'info';

// export a plain options object suitable for Fastify's `logger` option
export const loggerOptions = isProd
    ? { level }
    : { level, transport: { target: 'pino-pretty', options: { colorize: true } } };

// also export a pino logger instance in case other modules want to log directly
export const logger = pino(loggerOptions as pino.LoggerOptions);

export default loggerOptions;