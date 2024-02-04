import { WebServerEngine } from '@alterior/web-server';
import { FastifyEngine } from './fastify-engine';

export * from './event';
export * from './fastify-engine';

WebServerEngine.default = FastifyEngine;