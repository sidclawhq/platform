/**
 * Barrel for consumers that need both the scope catalog and the route map —
 * i.e. apps/api's auth middleware.
 *
 * Anything that only needs the vocabulary (the dashboard picker, the api-keys
 * Zod schema, packages/shared's own enums) should import from './catalog.js'
 * instead. packages/sdk bundles @sidclaw/shared with tsup `noExternal`, so
 * pulling the route table in through the main entry point would inline all of
 * it into every published SDK artifact.
 */
export * from './catalog.js';
export * from './routes.js';
