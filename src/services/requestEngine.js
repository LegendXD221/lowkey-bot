'use strict';
const axios = require('axios');
const { getSecret, loadEnv } = require('../config/env');
const { createSafeAxiosConfig, assertSafeUrl } = require('../security/ssrfProtection');
const { deepGet, safeJsonParse } = require('../utils/formatters');
const { ProviderError } = require('../utils/errors');
const { getLogger } = require('../utils/logger');
const log = getLogger();

function applyEncoding(value, encodingType) {
  if (value == null) return value;
  const s = String(value);
  switch (encodingType) {
    case 'url': return encodeURIComponent(s);
    case 'base64': return Buffer.from(s, 'utf8').toString('base64');
    case 'base64url': return Buffer.from(s, 'utf8').toString('base64url');
    default: return s;
  }
}
function buildAuthHeaders(provider) {
  const headers = { ...(provider.custom_headers || {}) };
  const secret = provider.secret_env_key ? getSecret(provider.secret_env_key) : null;
  if (provider.authentication_type === 'bearer' && secret) headers['Authorization'] = `Bearer ${secret}`;
  if (provider.authentication_type === 'api_key_header' && secret) headers['X-API-Key'] = secret;
  return headers;
}
function buildUrl(provider, targetUrl) {
  const endpoint = provider.endpoint;
  const endpointUrl = new URL(endpoint);
  if (provider.authentication_type === 'api_key_query') {
    const secret = getSecret(provider.secret_env_key);
    if (secret) endpointUrl.searchParams.set('api_key', secret);
  }
  const encoded = applyEncoding(targetUrl, provider.encoding_type);
  const param = provider.url_parameter || 'url';
  if (provider.http_method === 'GET') {
    const u = endpointUrl;
    // URLSearchParams performs transport escaping. Passing an already
    // percent-encoded value would turn `%2F` into `%252F`.
    u.searchParams.set(param, provider.encoding_type === 'url' ? targetUrl : encoded);
    return u.toString();
  }
  return endpointUrl.toString();
}
function buildBody(provider, targetUrl) {
  if (provider.http_method !== 'POST') return undefined;
  const encoded = applyEncoding(targetUrl, provider.encoding_type);
  if (provider.request_body_template) {
    let tpl = provider.request_body_template;
    tpl = tpl.replace(/\{\{\s*url\s*\}\}/gi, encoded);
    tpl = tpl.replace(/\{\{\s*raw_url\s*\}\}/gi, targetUrl);
    return safeJsonParse(tpl, { [provider.url_parameter || 'url']: encoded });
  }
  return { [provider.url_parameter || 'url']: encoded };
}
function extractResult(provider, data, status) {
  if (status < 200 || status >= 300) throw new ProviderError(`Upstream HTTP ${status}`, 'HTTP_ERROR', status);
  if (provider.response_format === 'url') {
    const text = typeof data === 'string' ? data.trim() : String(data);
    try {
      const parsed = new URL(text);
      if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return text;
    } catch (_) { /* convert malformed provider output into a typed provider error */ }
    throw new ProviderError('Response did not contain a valid URL', 'INVALID_RESPONSE');
  }
  if (provider.response_format === 'text') return typeof data === 'string' ? data : JSON.stringify(data);
  const body = typeof data === 'string' ? safeJsonParse(data, null) : data;
  if (body == null) throw new ProviderError('Empty or invalid JSON response', 'INVALID_RESPONSE');
  if (body.error || body.success === false || body.status === 'error') {
    throw new ProviderError(body.message || body.error || 'Provider returned error payload', 'PROVIDER_ERROR');
  }
  let result = provider.response_path ? deepGet(body, provider.response_path) : (body.url || body.result || body.link || body.data?.url || body.data);
  if (!result) throw new ProviderError('Could not extract result from response path', 'INVALID_RESPONSE');
  if (typeof result === 'object') result = result.url || result.link || result.result || JSON.stringify(result);
  const out = String(result).trim();
  if (!out) throw new ProviderError('Empty extracted result', 'INVALID_RESPONSE');
  return out;
}
async function requestWithSafeRedirects(config, maxRedirects) {
  let currentUrl = config.url;
  let currentConfig = { ...config, maxRedirects: 0 };
  for (let redirectCount = 0; ; redirectCount++) {
    await assertSafeUrl(currentUrl);
    const response = await axios({ ...currentConfig, url: currentUrl });
    const location = response.headers?.location;
    if (response.status < 300 || response.status >= 400 || !location) return response;
    if (redirectCount >= maxRedirects) {
      throw Object.assign(new ProviderError('Too many redirects', 'REDIRECT_LIMIT', 502), { httpStatus: response.status });
    }
    const nextUrl = new URL(location, currentUrl).toString();
    await assertSafeUrl(nextUrl);
    const currentOrigin = new URL(currentUrl).origin;
    const nextOrigin = new URL(nextUrl).origin;
    if (currentOrigin !== nextOrigin) {
      const safeHeaders = {};
      for (const [key, value] of Object.entries(currentConfig.headers || {})) {
        if (!['authorization', 'cookie', 'proxy-authorization', 'x-api-key'].includes(key.toLowerCase())) safeHeaders[key] = value;
      }
      currentConfig = { ...currentConfig, headers: safeHeaders };
    }
    currentUrl = nextUrl;
    // Match common Axios/HTTP redirect semantics for POST requests.
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentConfig.method === 'POST')) {
      currentConfig = { ...currentConfig, method: 'GET', data: undefined };
    }
  }
}
async function executeRequest(provider, targetUrl) {
  const env = loadEnv();
  const url = buildUrl(provider, targetUrl);
  const headers = buildAuthHeaders(provider);
  const body = buildBody(provider, targetUrl);
  const timeout = provider.timeout_ms || env.DEFAULT_TIMEOUT_MS;
  const config = createSafeAxiosConfig({
    method: provider.http_method, url,
    headers: { 'User-Agent': 'LowkeyBot/1.0', Accept: 'application/json, text/plain, */*', ...headers },
    timeout, data: body, maxRedirects: 0
  });
  log.debug({ provider: provider.name, method: provider.http_method }, 'Request starting');
  const start = Date.now();
  let response;
  let lastErr;
  for (let attempt = 0; attempt <= env.MAX_RETRIES; attempt++) {
    try {
      await assertSafeUrl(provider.endpoint);
      await assertSafeUrl(targetUrl);
      await assertSafeUrl(url);
      response = await requestWithSafeRedirects(config, env.MAX_REDIRECTS);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (err instanceof ProviderError) {
        err.latency = Date.now() - start;
        throw err;
      }
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isNetwork = ['ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT'].includes(err.code);
      if (attempt < env.MAX_RETRIES && (isNetwork || isTimeout)) {
        await new Promise(r => setTimeout(r, (250 * (2 ** attempt)) + Math.random() * 250));
        continue;
      }
      const latency = Date.now() - start;
      if (isTimeout)
        throw Object.assign(new ProviderError('Request timed out', 'TIMEOUT', 504), { latency });
      throw Object.assign(new ProviderError(err.message || 'Network error', 'NETWORK', 502), { latency });
    }
  }
  if (lastErr && !response) {
    const latency = Date.now() - start;
    throw Object.assign(new ProviderError(lastErr.message || 'Network error', 'NETWORK', 502), { latency });
  }
  const latency = Date.now() - start;
  try {
    const result = extractResult(provider, response.data, response.status);
    return { result, latency, httpStatus: response.status, providerId: provider.id, providerName: provider.name };
  } catch (err) {
    err.latency = latency; err.httpStatus = response.status; throw err;
  }
}
module.exports = { executeRequest, applyEncoding, buildUrl, buildBody, extractResult, buildAuthHeaders };
