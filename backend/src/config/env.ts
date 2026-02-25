import dotenv from 'dotenv';

dotenv.config();

const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

function must(key: string, fallback = '') {
  const value = process.env[key] ?? fallback;
  if (isProd && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  JWT_ACCESS_SECRET: must('JWT_ACCESS_SECRET', 'dev-access-secret'),
  JWT_REFRESH_SECRET: must('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  JWT_ACCESS_TTL_MINUTES: Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15),
  JWT_REFRESH_TTL_DAYS: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 7),
  MONGO_URI: process.env.MONGO_URI ?? '',
  REDIS_URL: process.env.REDIS_URL ?? '',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
