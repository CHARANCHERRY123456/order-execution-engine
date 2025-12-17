import dotenv from 'dotenv';
dotenv.config();

type NodeEnv = 'development' | 'production' | 'test' | string;

function parsePort(value: string | undefined, fallback = 3000): number {
    const n = value ? Number(value) : NaN;
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
}

export interface Env {
    PORT: number;
    NODE_ENV: NodeEnv;
}

export const env: Env = {
    PORT: parsePort(process.env.PORT),
    NODE_ENV: (process.env.NODE_ENV as NodeEnv) ?? 'development',
};

export default env;
