import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../errors.js';

type Role = 'admin' | 'reviewer' | 'viewer';

/**
 * Creates a Fastify preHandler that checks if the authenticated user has one of the required roles.
 * Returns 403 if the user's role is not in the allowed list.
 *
 * For API key auth (SDK calls), role check is skipped — API keys have scope-based auth (P4.3).
 * Role enforcement only applies to session-authenticated users (dashboard).
 */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // Skip role check for API key auth (no userRole set)
    if (!request.userRole) return;

    if (!roles.includes(request.userRole as Role)) {
      throw new ForbiddenError(
        `This action requires one of these roles: ${roles.join(', ')}. Your role: ${request.userRole}`
      );
    }
  };
}
