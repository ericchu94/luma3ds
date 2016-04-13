'use strict';
const path = require('path');
const child_process = require('child-process-promise');
const fs = require('mz/fs');
fs.copy = require('fs-extra-promise').copyAsync;
fs.mkdirs = require('fs-extra-promise').mkdirsAsync;
fs.remove = require('fs-extra-promise').removeAsync;

const Koa = require('koa');
const send = require('koa-send');
const cors = require('koa-cors');
const convert = require('koa-convert');
const app = new Koa();

const MAX_CHARS = 37;
const DEFAULT_PAYLOAD = 'arm9loaderhax.bin';
const PATH_CHANGER = './pathchanger';

let counter = 0;

app.use(convert(cors({
  origin: '*',
})));

app.use((ctx, next) => {
  const payload = ctx.request.url.slice(1, MAX_CHARS + 1);
  ctx.payload = payload;


  if (payload.length == 0) {
    const url = `http://${ctx.host}/`;
    ctx.body = `<p><input onkeyup="if (event.keyCode == 13) window.location.href = '${url}' + event.target.value" maxlength="${MAX_CHARS}" placeholder="${DEFAULT_PAYLOAD}" type="text" /> <input type="button" value="Press enter you shit" disabled /></p><p>Download the latest AuReiNand with customized payload path!</p><p><strong>Note:</strong> omit the root (do not put a leading slash)</p><p>Check out #3dshacks on Rizon for more information.</p><p>Binary from <a href="http://astronautlevel2.github.io/AuReiNand/">http://astronautlevel2.github.io/AuReiNand/</a></p><p>Source code here: <a href="https://github.com/ericchu94/arn">GitHub</a></p>`;
    return;
  }

  return next();
});

app.use((ctx, next) => {
  const id = counter;
  counter++;
  const tmpDir = id.toString();
  ctx.tmpDir = tmpDir;
  console.log(`[${ctx.payload}] Creating directory ${tmpDir}`);
  return fs.mkdirs(tmpDir).then(next);
});

app.use((ctx, next) => {
  const tmp = path.join(ctx.tmpDir, DEFAULT_PAYLOAD);
  ctx.tmp = tmp;
  console.log(`[${ctx.payload}] Copying ${DEFAULT_PAYLOAD} to ${tmp}`);
  return fs.copy(DEFAULT_PAYLOAD, tmp).then(next);
});

app.use((ctx, next) => {
  console.log(`[${ctx.payload}] Running ${PATH_CHANGER} on ${ctx.tmp}`);
  const cpPromise = child_process.execFile(PATH_CHANGER, [ctx.tmp]);
  const stdin = cpPromise.childProcess.stdin;
  stdin.write(ctx.payload);
  stdin.end();
  return cpPromise.then(next);
});

app.use((ctx, next) => {
  console.log(`[${ctx.payload}] Sending`);
  return send(ctx, ctx.tmp).then(next);
});

app.use((ctx) => {
  console.log(`[${ctx.payload}] Deleting ${ctx.tmpDir}`);
  return fs.remove(ctx.tmpDir);
});

setInterval(function () {
  console.log('Updating binary');
  child_process.execFile('./get.sh').then(() => {
    console.log('Binary updated');
  });
}, 10 * 60 * 1000);

app.listen(3000);
