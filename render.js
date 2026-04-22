'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegStatic);

const ROOT = __dirname;
const ADS_DIR = path.join(ROOT, 'ads');
const EXPORTS_DIR = path.join(ROOT, 'exports');
const TMP_DIR = path.join(ROOT, '.render-tmp');

const TOTAL_FRAMES = 120;
const MIN_BYTES = 10 * 1024;
const VIEWPORT = { width: 1080, height: 1920, deviceScaleFactor: 1 };
const STABILIZE_MS = 5000;
const FPS = 30;
const FRAME_DELAY = 0;

const CONCURRENCY = 4;

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const GOTO_TIMEOUT_MS = 30000;
const BROWSER_LAUNCH_MS = 60000;
const NEW_PAGE_MS = 20000;
const GOTO_WATCHDOG_MS = GOTO_TIMEOUT_MS + 5000;
const CAPTURE_WATCHDOG_MS = 30 * 60 * 1000;
const ENCODE_WATCHDOG_MS = 15 * 60 * 1000;

function hasAdSignals(html) {
  return (
    html.includes('Short intent video ad') ||
    html.includes('CALL NOW') ||
    html.includes('cta-panel')
  );
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`STUCK STEP: ${label} (exceeded ${ms}ms)`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runPool(limit, items, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function workerFn() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const n = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => workerFn()));
  return results;
}

async function verifyDirWritable(dirLabel, dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
  const probe = path.join(dirPath, `.write-check-${process.pid}-${Date.now()}.tmp`);
  try {
    await fs.promises.writeFile(probe, 'ok', 'utf8');
    await fs.promises.unlink(probe);
    console.log(`[OK] Write access: ${dirLabel} → ${dirPath}`);
  } catch (err) {
    console.error(`[FAIL] No write access to ${dirLabel}: ${dirPath}`);
    console.error(err.stack || err);
    throw err;
  }
}

async function listAdsHtmlFiles() {
  let entries;
  try {
    entries = await fs.promises.readdir(ADS_DIR, { withFileTypes: true });
  } catch (err) {
    console.error('Could not read ads directory:', ADS_DIR);
    console.error(err.stack || err);
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.html')) continue;
    out.push(path.join(ADS_DIR, ent.name));
  }
  return out;
}

async function getValidAdFiles() {
  const paths = await listAdsHtmlFiles();
  const valid = [];
  for (const abs of paths) {
    let stat;
    try {
      stat = await fs.promises.stat(abs);
    } catch (err) {
      console.warn(`[skip] stat failed: ${abs}`, err.message);
      continue;
    }
    if (stat.size <= MIN_BYTES) continue;
    let text;
    try {
      text = await fs.promises.readFile(abs, 'utf8');
    } catch (err) {
      console.warn(`[skip] read failed: ${abs}`, err.message);
      continue;
    }
    if (!hasAdSignals(text)) continue;
    valid.push(abs);
  }
  valid.sort((a, b) => a.localeCompare(b));
  return valid;
}

function encodeVideo(framesDir, outPath) {
  const stderrLines = [];
  const fpsStr = String(FPS);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(framesDir, 'frame_%04d.png'))
      .inputOptions(['-framerate', fpsStr, '-start_number', '1'])
      .videoCodec('libx264')
      .outputOptions([
        '-vf',
        'scale=1080:1920',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-crf',
        '23',
      ])
      .output(outPath)
      .on('start', (cmd) => console.log('FFMPEG CMD:', cmd))
      .on('stderr', (line) => {
        if (line && String(line).trim()) stderrLines.push(String(line).trim());
      })
      .on('end', () => resolve())
      .on('error', (err) => {
        const tail = stderrLines.slice(-40).join('\n');
        const msg = `${err.message}\n--- ffmpeg stderr (last lines) ---\n${tail || '(none)'}`;
        reject(new Error(msg));
      })
      .run();
  });
}

async function countPngFrames(framesDir) {
  const names = await fs.promises.readdir(framesDir);
  return names.filter((n) => n.endsWith('.png')).length;
}

async function rmDir(dir) {
  await fs.promises.rm(dir, { recursive: true, force: true });
}

async function renderOneFile(browser, file) {
  const filename = path.basename(file, '.html');
  const framesDir = path.join(TMP_DIR, `${filename}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const outPath = path.join(EXPORTS_DIR, `${filename}.mp4`);
  let page;

  try {
    console.log('STEP 5: opening page');
    page = await withTimeout(browser.newPage(), NEW_PAGE_MS, 'newPage()');
    await page.setViewport(VIEWPORT);

    const fileUrl = pathToFileURL(file).href;
    await withTimeout(
      page.goto(fileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: GOTO_TIMEOUT_MS,
      }),
      GOTO_WATCHDOG_MS,
      `page.goto(domcontentloaded, ${GOTO_TIMEOUT_MS}ms)`,
    );
    console.log('STEP 6: page loaded');
    await new Promise((r) => setTimeout(r, STABILIZE_MS));

    await page.evaluate(() => {
      document.querySelectorAll('video').forEach((v) => {
        v.pause();
        v.currentTime = 0;
      });
    });
    await page.evaluate(() => {
      document.body.classList.add('render-ready');
    });

    console.log(
      `STEP 7: static-frame test — 1 screenshot, duplicate to ${TOTAL_FRAMES} frames (FRAME_DELAY=${FRAME_DELAY})`,
    );
    await fs.promises.mkdir(framesDir, { recursive: true });

    await withTimeout(
      (async () => {
        const firstPath = path.join(framesDir, 'frame_0001.png');
        await page.screenshot({ path: firstPath, type: 'png' });
        console.log('  captured frame 1/1');
        for (let n = 2; n <= TOTAL_FRAMES; n++) {
          const dest = path.join(framesDir, `frame_${String(n).padStart(4, '0')}.png`);
          await fs.promises.copyFile(firstPath, dest);
          if (n % 60 === 0 || n === TOTAL_FRAMES) {
            console.log(`  duplicated: ${n}/${TOTAL_FRAMES}`);
          }
        }
      })(),
      CAPTURE_WATCHDOG_MS,
      'capture loop',
    );

    const count = await countPngFrames(framesDir);
    console.log('  frames on disk:', count);

    console.log('STEP 8: encoding');
    await withTimeout(encodeVideo(framesDir, outPath), ENCODE_WATCHDOG_MS, 'ffmpeg encode');

    try {
      await rmDir(framesDir);
      console.log('  cleaned temp frames:', framesDir);
    } catch (err) {
      console.warn('  could not remove temp frames:', framesDir, err.message);
    }

    console.log('STEP 9: done', outPath);
    return { ok: true, outPath };
  } catch (err) {
    console.error('RENDER FAILED:', filename);
    console.error(err.stack || err);
    try {
      await fs.promises.access(framesDir);
      console.log('⚠️ Keeping frames for debugging:', framesDir);
    } catch {
      /* folder never created */
    }
    return { ok: false, file, error: err };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.warn('page.close():', e.message);
      }
    }
  }
}

async function main() {
  console.log('STEP 1: start');
  console.log('  cwd:', ROOT);
  console.log('  ads:', ADS_DIR);
  console.log('  concurrency:', CONCURRENCY);

  const files = await getValidAdFiles();
  console.log('STEP 2: found files —', files.length);
  console.log('  ', files);

  if (files.length === 0) {
    throw new Error('No valid ad files found');
  }

  await verifyDirWritable('exports', EXPORTS_DIR);
  await verifyDirWritable('tmp', TMP_DIR);

  console.log('STEP 3: launching browser');
  console.log('  executablePath (forced):', CHROME_PATH);
  try {
    fs.accessSync(CHROME_PATH, fs.constants.F_OK);
  } catch (err) {
    console.log('BROWSER FAILED TO LAUNCH');
    console.error('Chrome executable not found at:', CHROME_PATH);
    console.error(err.stack || err);
    throw new Error(`Chrome not found at ${CHROME_PATH}`);
  }

  const launchOpts = {
    headless: true,
    slowMo: 0,
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  };

  let browser;
  try {
    browser = await withTimeout(puppeteer.launch(launchOpts), BROWSER_LAUNCH_MS, 'puppeteer.launch()');
  } catch (err) {
    console.log('BROWSER FAILED TO LAUNCH');
    console.error(err.stack || err);
    throw err;
  }

  console.log('STEP 4: browser launched');

  const succeeded = [];
  const failed = [];

  try {
    const poolResults = await runPool(CONCURRENCY, files, async (file) => {
      console.log(`START file ${file}`);
      try {
        const result = await renderOneFile(browser, file);
        if (result.ok) {
          console.log(`DONE file ${file}`);
          return result;
        }
        console.log(`FAILED file ${file}`);
        return result;
      } catch (err) {
        console.log(`FAILED file ${file}`);
        return { ok: false, file, error: err };
      }
    });

    for (const result of poolResults) {
      if (result && result.ok) succeeded.push(result.outPath);
      else if (result && !result.ok) failed.push({ file: result.file, error: result.error });
    }
  } finally {
    console.log('Closing browser…');
    try {
      await withTimeout(browser.close(), 30000, 'browser.close()');
    } catch (err) {
      console.warn('browser.close() issue:', err.message);
    }
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log('total files:', files.length);
  console.log('succeeded:', succeeded.length);
  console.log('failed:', failed.length);
  if (failed.length) {
    console.log('failed files:');
    for (const f of failed) {
      console.log(' -', f.file);
      console.log('   ', f.error && f.error.message ? f.error.message : f.error);
    }
  }
  if (failed.length === files.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('FATAL:', err.stack || err);
  process.exit(1);
});
