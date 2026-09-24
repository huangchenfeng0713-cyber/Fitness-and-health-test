// 把 src/ 下的样式与脚本内联进单个 index.html，便于离线拷贝、微信/QQ 直接发送。
// 用法：node build.mjs            → 生成 ./index.html
//      node build.mjs --artifact out.html  → 另存一份去掉 <html>/<head>/<body> 外壳的页面片段
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
let html = readFileSync(join(src, 'index.html'), 'utf8');

function block(name, re, wrap) {
  const m = html.match(new RegExp(`<!-- build:${name} -->([\\s\\S]*?)<!-- /build:${name} -->`));
  if (!m) throw new Error(`缺少 build:${name} 标记`);
  const files = [...m[1].matchAll(re)].map((x) => x[1]);
  const body = files.map((f) => `/* ---- ${f} ---- */\n` + readFileSync(join(src, f), 'utf8')).join('\n');
  html = html.replace(m[0], () => wrap(body));
  return files;
}

const css = block('css', /href="([^"]+\.css)"/g, (b) => `<style>\n${b}\n</style>`);
const js = block('js', /src="([^"]+\.js)"/g, (b) => {
  if (/<\/script/i.test(b)) b = b.replace(/<\/script/gi, '<\\/script');
  return `<script>\n${b}\n</script>`;
});

writeFileSync(join(root, 'index.html'), html);
console.log(`index.html 已生成：${css.length} 个样式文件、${js.length} 个脚本文件，${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);

const i = process.argv.indexOf('--artifact');
if (i > 0 && process.argv[i + 1]) {
  const frag = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '')
    .replace(/<\/html>\s*/i, '')
    .replace(/<head>\s*/i, '')
    .replace(/<\/head>\s*/i, '')
    .replace(/<meta charset="utf-8">\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<body>\s*/i, '')
    .replace(/<\/body>\s*/i, '');
  writeFileSync(process.argv[i + 1], frag);
  console.log(`页面片段已写入 ${process.argv[i + 1]}`);
}
