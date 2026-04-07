export const DEFAULT_API_URL = 'https://iqac-system.onrender.com/api';

const normalizeUrl = (value) => String(value ?? '').trim().replace(/\/+$/, '');

export const ensureApiBaseUrl = (value, fallback = DEFAULT_API_URL) => {
  const normalizedValue = normalizeUrl(value);
  const normalizedFallback = normalizeUrl(fallback) || DEFAULT_API_URL;
  const candidate = normalizedValue || normalizedFallback;

  return /\/api$/i.test(candidate) ? candidate : `${candidate}/api`;
};

export const resolveApiBaseUrl = (env = {}, fallback = DEFAULT_API_URL) =>
  ensureApiBaseUrl(env.VITE_API_URL || env.VITE_API_BASE_URL, fallback);

export const resolveApiOrigin = (env = {}, fallback = DEFAULT_API_URL) =>
  resolveApiBaseUrl(env, fallback).replace(/\/api$/i, '');
