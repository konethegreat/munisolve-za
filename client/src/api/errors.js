// Normalises the API's flat error envelope into one typed error:
// { success: false, errorCode, message, requestId, errors? }

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.errorCode = options.errorCode ?? 'UNKNOWN_ERROR';
    this.requestId = options.requestId ?? null;
    this.details = options.details ?? null;
    this.errors = options.errors ?? null;
    this.cause = options.cause ?? null;
  }

  // A short reference people can quote to support without exposing internals.
  get reference() {
    if (this.requestId) return `Reference ${this.requestId}`;
    if (this.errorCode && this.errorCode !== 'UNKNOWN_ERROR') return `Code ${this.errorCode}`;
    return null;
  }
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] ?? null;
}

export function normalizeApiError(error, fallbackMessage = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError) return error;

  const response = error?.response ?? null;
  const body = response?.data;
  const status = response?.status ?? 0;
  const requestId =
    (body && typeof body === 'object' ? body.requestId : null) ??
    headerValue(response?.headers, 'x-request-id');

  if (body && typeof body === 'object' && body.success === false) {
    return new ApiError(body.message || fallbackMessage, {
      status,
      errorCode: body.errorCode || 'API_ERROR',
      requestId,
      details: body.details ?? null,
      errors: Array.isArray(body.errors) ? body.errors : null,
      cause: error,
    });
  }

  if (status === 0 && (error?.message || error?.code || error?.isAxiosError)) {
    return new ApiError(
      'Cannot reach the MuniSolve API. Check your connection and try again.',
      { status, errorCode: 'NETWORK_ERROR', cause: error },
    );
  }

  return new ApiError(body?.message || fallbackMessage, {
    status,
    errorCode: 'HTTP_ERROR',
    requestId,
    cause: error,
  });
}

export function errorMessage(error, fallbackMessage) {
  return normalizeApiError(error, fallbackMessage).message;
}
