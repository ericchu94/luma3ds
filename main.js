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

const Koa = require('koa');
const send = require('koa-send');
const cors = require('koa-cors');
const convert = require('koa-convert');
const views = require('koa-views');
const router = require('koa-router')();
const serve = require('koa-static');
const app = new Koa();

const PORT = process.env.PORT || 3000;
const UPDATE_INTERVAL = process.env.UPDATE_INTERVAL || 10;

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || null;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || null;

const LATEST_HOST = 'http://astronautlevel2.github.io'
const LATEST_PAGE = `${LATEST_HOST}/AuReiNand/`
const RELEASE_PAGE = `https://api.github.com/repos/AuroraWright/AuReiNand/releases/latest?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}`;
const COMMITS_PAGE = `https://api.github.com/repos/AuroraWright/AuReiNand/commits?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}`;
const TAGS_PAGE = `https://api.github.com/repos/AuroraWright/AuReiNand/tags?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}`;

const MAX_CHARS = 37;
const PAYLOAD = 'arm9loaderhax.bin'
const LATEST = 'latest.bin';
const RELEASE = 'release.bin';
const PATH_CHANGER = './pathchanger';
const PATTERN = 'sdmc:/'

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

router.get('/assets/*', serve('.'));

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
  logger.info(`Changing payload path on ${ctx.tmp}`, { payload: ctx.payload });
  return fs.open(ctx.tmp, 'r+').then(fd => {
    return fs.readFile(fd).then(data => {
      const buf = Buffer.from(PATTERN, 'utf16le');
      const index = data.indexOf(buf);
      if (index == -1)
        throw new Error(`Failed to find ${PATTERN} in ${ctx.tmp}`);
      return index + buf.length;
    }).then(offset => {
      const buf = Buffer.alloc(MAX_CHARS * 2);
      buf.write(ctx.payload, 'utf16le');
      return fs.write(fd, buf, 0, buf.length, offset);
    }).then(() => {
      return fs.close(fd);
    });
  }).then(next);
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
  rp({
    url: COMMITS_PAGE,
    headers: {
      'User-Agent': 'ericchu94/arn',
      'Accept': 'application/vnd.github.v3+json',
    },
  }).then(data => {
    const commits = JSON.parse(data);
    const commit = commits[0].sha.substring(0, 7);
    return {
      src: commit,
      commit: commit,
    };
  }).then(info => {
    if (last_latest_src == info.src)
      logger.info(`${LATEST} is up to date`);
    else {
      last_latest_src = info.src;
      return rp(LATEST_PAGE).then(data => {
        const $ = cheerio.load(data);
        return `${LATEST_HOST}${$('tr td a').filter((i, el) => {
          return $(el).text().includes(info.commit);
        }).attr('href')}`;
      }).then(src => {
        return new Promise((resolve, reject) => {
          const dest = 'tmp_latest'
          const r = request(src);
          r.on('error', reject);
          const writeStream = unzip.Extract({ path: dest });
          writeStream.on('close', () => {
            resolve(dest);
          });
          r.pipe(writeStream);
        });
      }).then(output => {
        const folder = path.join(output, 'out');
        const file = path.join(folder, 'arm9loaderhax.bin');
        return fs.rename(file, LATEST).then(() => {
          return output;
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

  rp({
    url: RELEASE_PAGE,
    headers: {
      'User-Agent': 'ericchu94/arn',
      'Accept': 'application/vnd.github.v3+json',
    },
  }).then(data => {
    const release = JSON.parse(data);
    const tagName = release.tag_name;
    const name = release.name;
    return rp({
      url: TAGS_PAGE,
      headers: {
        'User-Agent': 'ericchu94/arn',
        'Accept': 'application/vnd.github.v3+json',
      },
    }).then(data => {
      const tags = JSON.parse(data);
      for (let tag of tags) {
        if (tag.name == tagName) {
          const commit = tag.commit.sha.substring(0, 7);
          return {
            src: `${name} - ${commit}`,
            commit: commit,
          }
        }
      }
      throw new Error('Failed to get sha of release');
    });
  }).then(info => {
    if (last_release_src == info.src)
      logger.info(`${RELEASE} is up to date`);
    else {
      last_release_src = info.src;
      return rp(LATEST_PAGE).then(data => {
        const $ = cheerio.load(data);
        return `${LATEST_HOST}${$('tr td a').filter((i, el) => {
          return $(el).text().includes(info.commit);
        }).attr('href')}`;
      }).then(src => {
        return new Promise((resolve, reject) => {
          const dest = 'tmp_release'
          const r = request(src);
          r.on('error', reject);
          const writeStream = unzip.Extract({ path: dest });
          writeStream.on('close', () => {
            resolve(dest);
          });
          r.pipe(writeStream);
        });
      }).then(output => {
        const folder = path.join(output, 'out');
        const file = path.join(folder, 'arm9loaderhax.bin');
        return fs.rename(file, RELEASE).then(() => {
          return output;
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
setInterval(update, UPDATE_INTERVAL * 60 * 1000);

app.listen(PORT);
