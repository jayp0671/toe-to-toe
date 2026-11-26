import { serviceClientFromEnv } from '../_shared/db.ts';
import { createApiHandler } from './handler.ts';

Deno.serve(createApiHandler({ db: serviceClientFromEnv() }));
