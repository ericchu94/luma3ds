'use strict';
const path = require('path');
const child_process = require('child-process-promise');
const fs = require('mz/fs');
fs.copy = require('fs-extra-promise').copyAsync;
fs.mkdirs = require('fs-extra-promise').mkdirsAsync;
fs.remove = require('fs-extra-promise').removeAsync;

const cheerio = require('cheerio');
const rp = require('request-promise');
const request = require('request');
const unzip = require('unzip2');
const Zip = require('node-7z');

const Koa = require('koa');
const send = require('koa-send');
const cors = require('koa-cors');
const convert = require('koa-convert');
const views = require('koa-views');
const router = require('koa-router')();
const app = new Koa();

const LATEST_HOST = 'http://astronautlevel2.github.io'
const LATEST_PAGE = `${LATEST_HOST}/AuReiNand/`
const RELEASE_HOST = 'https://github.com'
const RELEASE_PAGE = `${RELEASE_HOST}/AuroraWright/AuReiNand/releases`

const MAX_CHARS = 37;
const PAYLOAD = 'arm9loaderhax.bin'
const LATEST = 'latest.bin';
const RELEASE = 'release.bin';
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

app.use(views(__dirname + '/views', {
  map: {
    html: 'ejs',
  },
}));

router.get('*', (ctx, next) => {
  logger.info(`Serving ${ctx.req.url}`);
  return next();
});

router.get('/', (ctx, next) => {
  return ctx.render('index', {
    placeholder: PAYLOAD,
    maxLength: MAX_CHARS,
    url: `http://${ctx.host}/`,
    latest: path.basename(last_latest_src),
    release: path.basename(last_release_src),
  });
});

router.get(['/latest/*', '/release/*'], (ctx, next) => {
  if (ctx.req.url.startsWith('/latest/'))
    ctx.version = LATEST;
  else
    ctx.version = RELEASE;
  ctx.payload = ctx.params[0];
  if (ctx.payload == 0)
    ctx.payload = PAYLOAD;
  return next();
}, (ctx, next) => {
  const id = counter;
  counter++;
  const tmpDir = id.toString();
  ctx.tmpDir = tmpDir;
  logger.info(`Creating directory ${tmpDir}`, { payload: ctx.payload });
  return fs.mkdirs(tmpDir).then(next);
}, (ctx, next) => {
  const tmp = path.join(ctx.tmpDir, PAYLOAD);
  ctx.tmp = tmp;
  logger.info(`Copying ${ctx.version} to ${tmp}`, { payload: ctx.payload });
  return fs.copy(ctx.version, tmp).then(next);
}, (ctx, next) => {
  logger.info(`Running ${PATH_CHANGER} on ${ctx.tmp}`, { payload: ctx.payload });
  const cpPromise = child_process.execFile(PATH_CHANGER, [ctx.tmp]);
  const stdin = cpPromise.childProcess.stdin;
  stdin.write(ctx.payload);
  stdin.end();
  return cpPromise.then(next);
}, (ctx, next) => {
  logger.info(`Sending ${ctx.tmp}`, { payload: ctx.payload });
  return send(ctx, ctx.tmp).then(next);
}, (ctx) => {
  logger.info(`Deleting ${ctx.tmpDir}`, { payload: ctx.payload });
  return fs.remove(ctx.tmpDir);
});

app.use(router.routes());
app.use(router.allowedMethods());

let last_latest_src = null;
let last_release_src = null;

function update() {
  rp(LATEST_PAGE).then(data => {
    const $ = cheerio.load(data);
    return `${LATEST_HOST}${$('tr td a').attr('href')}`;
  }).then(src => {
    if (last_latest_src == src)
      logger.info(`${LATEST} is up to date`);
    else {
      last_latest_src = src;
      return new Promise((resolve, reject) => {
        const dest = '.'
        const r = request(src);
        r.on('error', reject);
        const writeStream = unzip.Extract({ path: dest });
        writeStream.on('close', () => {
          resolve(dest);
        });
        r.pipe(writeStream);
      }).then(output => {
        const folder = path.join(output, 'out');
        const file = path.join(folder, 'arm9loaderhax.bin');
        return fs.rename(file, LATEST).then(() => {
          return folder;
        });
      }).then((folder) => {
        return fs.remove(folder);
      }).then(() => {
        logger.info(`Updated ${LATEST}`);
      }, err => {
        logger.warn(`Failed to update ${LATEST}: ${err}`);
      });
    }
  });

  rp(RELEASE_PAGE).then(data => {
    const $ = cheerio.load(data);
    return `${RELEASE_HOST}${$('.release-downloads a').attr('href')}`;
  }).then(src => {
    if (last_release_src == src)
      logger.info(`${RELEASE} is up to date`);
    else {
      last_release_src = src;
      return new Promise((resolve, reject) => {
        const dest = 'release.7z'
        const r = request(src);
        r.on('error', reject);
        const writeStream = fs.createWriteStream(dest);
        writeStream.on('finish', () => {
          resolve(dest);
        });
        r.pipe(writeStream);
      }).then(file => {
        const dest = 'out';
        const zip = new Zip();
        return zip.extract(file, dest).then(() => {
          return fs.unlink(file);
        }).then(() => {
          return '.';
        });
      }).then(output => {
        const folder = path.join(output, 'out');
        const file = path.join(folder, 'arm9loaderhax.bin');
        return fs.rename(file, RELEASE).then(() => {
          return folder;
        });
      }).then((folder) => {
        return fs.remove(folder);
      }).then(() => {
        logger.info(`Updated ${RELEASE}`);
      }, err => {
        logger.warn(`Failed to update ${RELEASE}: ${err}`);
      });
    }
  });
}

update();
setInterval(update, 10 * 60 * 1000);

app.listen(3000);
