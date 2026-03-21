import fp from 'fastify-plugin';
import { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

async function errorHandlerPluginImpl(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | AppError | Error, request, reply) => {
    const requestId = request.id;

    // Handle our typed errors
    if (error instanceof AppError) {
      request.log.warn({ err: error, request_id: requestId }, error.message);
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        status: error.statusCode,
        details: error.details,
        request_id: requestId,
      });
    }

    // Handle Fastify validation errors
    if ('validation' in error && error.validation) {
      request.log.warn({ err: error, request_id: requestId }, 'Validation error');
      return reply.status(400).send({
        error: 'validation_error',
        message: error.message,
        status: 400,
        details: { validation: error.validation },
        request_id: requestId,
      });
    }

    // Handle Zod validation errors (from .parse() in route handlers)
    if (error instanceof ZodError) {
      request.log.warn({ err: error, request_id: requestId }, 'Zod validation error');
      return reply.status(400).send({
        error: 'validation_error',
        message: error.issues.map(e => `${e.path.map(String).join('.')}: ${e.message}`).join('; '),
        status: 400,
        details: { issues: error.issues },
        request_id: requestId,
      });
    }

    // Handle JSON parse errors from malformed request bodies
    if ('statusCode' in error && (error as FastifyError).statusCode === 400 && error.message?.includes('JSON')) {
      request.log.warn({ err: error, request_id: requestId }, 'JSON parse error');
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Invalid JSON in request body',
        status: 400,
        request_id: requestId,
      });
    }

    if (error instanceof SyntaxError) {
      request.log.warn({ err: error, request_id: requestId }, 'JSON syntax error');
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Invalid JSON in request body',
        status: 400,
        request_id: requestId,
      });
    }

    // Unhandled errors — log full stack, return sanitized
    request.log.error({ err: error, request_id: requestId }, 'Unhandled error');
    return reply.status(500).send({
      error: 'internal_error',
      message: 'An unexpected error occurred',
      status: 500,
      request_id: requestId,
    });
  });
}

export const errorHandlerPlugin = fp(errorHandlerPluginImpl, { name: 'error-handler-plugin' });
