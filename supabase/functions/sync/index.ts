import { serviceClientFromEnv } from '../_shared/db.ts';
import { createSyncHandler } from './handler.ts';

// Where outdated Shortcuts get the new version (426). Set with `supabase secrets set SHORTCUT_URL=...`.
const shortcutUrl = Deno.env.get('SHORTCUT_URL') ?? 'the link in Profile → Sync setup';

Deno.serve(createSyncHandler({ db: serviceClientFromEnv(), shortcutUrl }));
