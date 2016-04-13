'use strict';
const path = require('path');
const child_process = require('child-process-promise');
const fs = require('mz/fs');
fs.copy = require('fs-extra-promise').copyAsync;
fs.mkdirs = require('fs-extra-promise').mkdirsAsync;

const Koa = require('koa');
const send = require('koa-send');
const cors = require('koa-cors');
const convert = require('koa-convert');
const app = new Koa();

const MAX_CHARS = 37;
const FILES = 'files';
const TMP = 'tmp';
const DEFAULT_PAYLOAD = 'arm9loaderhax.bin';
const DEFAULT_PAYLOAD_PATH = path.join(FILES, DEFAULT_PAYLOAD);
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
    ctx.body = `<input onkeyup="if (event.keyCode == 13) window.location.href = '${url}' + event.target.value" maxlength="${MAX_CHARS}" placeholder="${DEFAULT_PAYLOAD}" type="text" />`;
    return;
  }

  return next();
});

app.use((ctx, next) => {
  console.log(`[${ctx.payload}] Serving`);
  const file = path.join(FILES, ctx.payload);
  ctx.file = file;
  return fs.exists(file).then(exists => {
    ctx.exists = exists;
    return next();
  });
});

app.use((ctx, next) => {
  if (!ctx.exists) {
    const id = counter;
    counter++;
    const tmp = path.join(TMP, id.toString());

    console.log(`[${ctx.payload}] Copying ${DEFAULT_PAYLOAD} to ${tmp}`);
    return fs.copy(DEFAULT_PAYLOAD_PATH, tmp).then(() => {
      console.log(`[${ctx.payload}] Running ${PATH_CHANGER} on ${tmp}`);
      const cpPromise = child_process.execFile(PATH_CHANGER, [tmp]);
      const stdin = cpPromise.childProcess.stdin;
      stdin.write(ctx.payload);
      stdin.end();
      return cpPromise;
    }).then(() => {
      console.log(`[${ctx.payload}] Renaming ${tmp} to ${ctx.file}`);
      const dir = path.dirname(ctx.file);

      return fs.mkdirs(dir);
    }).then(() => {
      return fs.rename(tmp, ctx.file).then(next);
    });
  } else {
    console.log(`[${ctx.payload}] Found`);
    return next();
  }
});

app.use(ctx => {
  console.log(`[${ctx.payload}] Sending`);
  return send(ctx, ctx.file);
});

app.listen(3000);
