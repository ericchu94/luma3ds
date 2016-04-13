'use strict';
const child_process = require('child-process-promise');
const fs = require('mz/fs');
fs.copy = require('fs-extra-promise').copyAsync;
const path = require('path');

const Koa = require('koa');
const app = new Koa();
const send = require('koa-send');

const MAX_CHARS = 37;
const FILES = 'files';
const TMP = 'tmp';
const DEFAULT_PAYLOAD = 'arm9loaderhax.bin';
const DEFAULT_PAYLOAD_PATH = path.join(FILES, DEFAULT_PAYLOAD);
const PATH_CHANGER = './pathchanger';
let counter = 0;

app.use(ctx => {
  const payload = ctx.request.url.slice(1, MAX_CHARS + 1);

  if (payload.length == 0) {
    ctx.body = `<input maxlength="${MAX_CHARS}" placeholder="${DEFAULT_PAYLOAD}" type="text" id="path" /><input type="button" value="Download" onclick="window.location.href = document.getElementById('path').value" />`;
    return;
  }

  console.log(`[${payload}] Serving`);
  const file = path.join(FILES, payload);
  fs.exists(file).then(exists => {
    if (!exists) {
      const id = counter;
      counter++;
      const tmp = path.join(TMP, id.toString());

      console.log(`[${payload}] Copying ${DEFAULT_PAYLOAD} to ${tmp}`);
      return fs.copy(DEFAULT_PAYLOAD_PATH, tmp).then(() => {
        console.log(`[${payload}] Running ${PATH_CHANGER} on ${tmp}`);
        const cpPromise = child_process.execFile(PATH_CHANGER, [tmp]);
        const stdin = cpPromise.childProcess.stdin;
        stdin.write(payload);
        stdin.end();
        return cpPromise;
      }).then(() => {
        console.log(`[${payload}] Renaming ${tmp} to ${file}`);
        return fs.rename(tmp, file);
      });;
    } else {
      console.log(`[${payload}] Found`);
    }
  }).then(() => {
    console.log(`[${payload}] Sending`);
    console.log(ctx, file);
    send(ctx, file);
  }).catch(err => {
    console.log(err);
  });
});

app.listen(3000);
