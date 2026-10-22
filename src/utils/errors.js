'use strict';
class AppError extends Error {
  constructor(message, code = 'APP_ERROR', status = 400) {
    super(message); this.name = 'AppError'; this.code = code; this.status = status;
  }
}
class ValidationError extends AppError { constructor(m) { super(m, 'VALIDATION_ERROR', 400); this.name = 'ValidationError'; } }
class UnauthorizedError extends AppError { constructor(m = 'You are not authorized to use this command.') { super(m, 'UNAUTHORIZED', 403); this.name = 'UnauthorizedError'; } }
class NotFoundError extends AppError { constructor(m) { super(m, 'NOT_FOUND', 404); this.name = 'NotFoundError'; } }
class ProviderError extends AppError { constructor(m, category = 'PROVIDER_FAILURE', status = 502) { super(m, category, status); this.name = 'ProviderError'; this.category = category; } }
class RateLimitError extends AppError { constructor(m = 'Rate limit exceeded. Please slow down.', retryAfterSeconds = null) { super(m, 'RATE_LIMIT', 429); this.name = 'RateLimitError'; this.retryAfterSeconds = retryAfterSeconds; } }
class MaintenanceError extends AppError { constructor(m = 'Bot is currently under maintenance.') { super(m, 'MAINTENANCE', 503); this.name = 'MaintenanceError'; } }
class UnsupportedUrlError extends AppError { constructor() { super("Link Unsupported — Lowkey doesn't currently support this link.", 'UNSUPPORTED_URL', 400); this.name = 'UnsupportedUrlError'; } }
class InvalidUrlError extends AppError { constructor() { super('Invalid Link — Please provide a valid HTTP or HTTPS URL.', 'INVALID_URL', 400); this.name = 'InvalidUrlError'; } }
class BypassUnavailableError extends AppError { constructor() { super('Bypass Unavailable — All compatible providers failed. Please try again later.', 'BYPASS_UNAVAILABLE', 503); this.name = 'BypassUnavailableError'; } }
module.exports = { AppError, ValidationError, UnauthorizedError, NotFoundError, ProviderError, RateLimitError, MaintenanceError, UnsupportedUrlError, InvalidUrlError, BypassUnavailableError };
