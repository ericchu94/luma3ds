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

const winston = require('winston');
const logger = new (winston.Logger) ({
  transports: [
    new (winston.transports.Console) ({
      timestamp: () => {
        return new Date();
      },
      colorize: true,
    }),
    new (winston.transports.File) ({
      filename: 'arn.log',
      timestamp: () => {
        return new Date();
      },
    }),
  ],
});

let counter = 0;

app.use(convert(cors({
  origin: '*',
})));

app.use((ctx, next) => {
  const payload = ctx.request.url.slice(1, MAX_CHARS + 1);
  ctx.payload = payload;


  if (payload.length == 0) {
    logger.info('Serving /');
    const url = `http://${ctx.host}/`;
    ctx.body = `<p>sdmc:/ <input onkeyup="if (event.keyCode == 13) window.location.href = '${url}' + event.target.value" maxlength="${MAX_CHARS}" placeholder="${DEFAULT_PAYLOAD}" type="text" /> <input type="button" value="Press enter you shit" disabled /></p><p>Download the latest AuReiNand with customized payload path!</p><p><strong>Examples:</strong></p><ul><li>arm9payload.bin</li><li>a9lh/AuReiNand.bin</li><li>arm9select/default.bin</li></ul><p><strong>Notes:</strong></p><ul><li>Do not put a leading slash</li><li>Use forward slashes</li><li>Path can be 37 characters max</li></ul><p>Check out #3dshacks on Rizon for more information.</p><p>Binary from <a href="http://astronautlevel2.github.io/AuReiNand/">http://astronautlevel2.github.io/AuReiNand/</a></p><p>Source code here: <a href="https://github.com/ericchu94/arn">GitHub</a></p>`;
    return;
  }

  return next();
});

app.use((ctx, next) => {
  const id = counter;
  counter++;
  const tmpDir = id.toString();
  ctx.tmpDir = tmpDir;
  logger.info(`Creating directory ${tmpDir}`, { payload: ctx.payload });
  return fs.mkdirs(tmpDir).then(next);
});

app.use((ctx, next) => {
  const tmp = path.join(ctx.tmpDir, DEFAULT_PAYLOAD);
  ctx.tmp = tmp;
  logger.info(`Copying ${DEFAULT_PAYLOAD} to ${tmp}`, { payload: ctx.payload });
  return fs.copy(DEFAULT_PAYLOAD, tmp).then(next);
});

app.use((ctx, next) => {
  logger.info(`Running ${PATH_CHANGER} on ${ctx.tmp}`, { payload: ctx.payload });
  const cpPromise = child_process.execFile(PATH_CHANGER, [ctx.tmp]);
  const stdin = cpPromise.childProcess.stdin;
  stdin.write(ctx.payload);
  stdin.end();
  return cpPromise.then(next);
});

app.use((ctx, next) => {
  logger.info(`Sending ${ctx.tmp}`, { payload: ctx.payload });
  return send(ctx, ctx.tmp).then(next);
});

app.use((ctx) => {
  logger.info(`Deleting ${ctx.tmpDir}`, { payload: ctx.payload });
  return fs.remove(ctx.tmpDir);
});

function update() {
  logger.info('Updating binary');
  child_process.execFile('./get.sh').then(() => {
    logger.info('Binary updated');
  });
}

update();
setInterval(update, 10 * 60 * 1000);

app.listen(3000);
