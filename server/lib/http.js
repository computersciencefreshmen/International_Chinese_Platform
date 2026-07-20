export class HttpError extends Error {
  constructor(statusCode, code, message, data = null, options = {}) {
    super(message, options)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
    this.data = data
  }
}

export function envelope(code, msg, data = null) {
  return {
    code,
    msg,
    data: data === undefined ? null : data
  }
}

export function success(data = null, msg = 'ok', code = 0) {
  return envelope(code, msg, data)
}

export function failure(code, msg, data = null) {
  return envelope(code, msg, data)
}

export function sendSuccess(reply, data = null, options = {}) {
  const { statusCode = 200, code = 0, msg = 'ok' } = options
  return reply.code(statusCode).send(success(data, msg, code))
}

export function sendFailure(reply, options = {}) {
  const {
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    msg = 'Internal server error',
    data = null
  } = options

  return reply.code(statusCode).send(failure(code, msg, data))
}

export function createHttpError(
  statusCode,
  code,
  message,
  data = null,
  options = {}
) {
  return new HttpError(statusCode, code, message, data, options)
}

export function errorDescriptor(error) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      msg: error.message,
      data: error.data
    }
  }

  if (error?.validation) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      msg: 'Invalid request',
      data: null
    }
  }

  if (
    Number.isInteger(error?.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return {
      statusCode: error.statusCode,
      code: error.code || 'REQUEST_ERROR',
      msg: error.statusCode === 404 ? 'Route not found' : 'Request failed',
      data: null
    }
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    msg: 'Internal server error',
    data: null
  }
}
