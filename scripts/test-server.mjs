import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.SEED_DEMO = 'false';
const { createApp } = await import('../server/index.mjs');
const dir = await mkdtemp(join(tmpdir(),'trailbook-browser-'));
const server = createApp({databasePath:join(dir,'test.sqlite')});
server.listen(3101,'127.0.0.1');
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => server.close(async () => { await rm(dir,{recursive:true,force:true}); process.exit(0); }));
