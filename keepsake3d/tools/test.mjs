import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
await fs.mkdir(path.join(root,'dev/qa-output'),{recursive:true});
for(const [entry,name] of [['plush_engine','plush-engine'],['fur_strands','fur'],['exhibit_motion','exhibit-motion']]){
  await build({entryPoints:[path.join(root,`src/${entry}.js`)],bundle:true,format:'esm',packages:'external',platform:'node',outfile:path.join(root,`dev/generated-${name}.mjs`)});
}
await import('./offline_plush_verify.mjs');
