export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('validation_error', 400, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('unauthorized', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super('forbidden', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('not_found', 404, `${resource} '${id}' not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('conflict', 409, message);
  }
}
