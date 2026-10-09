/**
 * 下载 ECDICT 数据（ecdict.csv 约 63 MB）。
 *
 * 为什么要分块 + 并行：整文件一次请求在网络不稳时容易超时中断（之前就栽在这），
 * 单连接又只有几十 KB/s。方案是：
 *   - 按 2 MB 一块请求，任何一块失败只重试那一块，不会前功尽弃；
 *   - 已下过的部分自动续传（断点续传）；
 *   - --parallel N 把剩余部分切成 N 段并行下载，速度能提升数倍。
 *
 * 用法：
 *   node tools/fetch_ecdict.js [--proxy] [--parallel 4] [--out <path>]
 *   node tools/fetch_ecdict.js --url <csv url> --out <path>      # 换数据源
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const URL_CSV = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv';
const PROXY = { host: '127.0.0.1', port: 7897 };
const CHUNK = 2 * 1024 * 1024;

const args = process.argv.slice(2);
const useProxy = args.includes('--proxy');
const urlIdx = args.indexOf('--url');
const TARGET_URL = urlIdx >= 0 ? args[urlIdx + 1] : URL_CSV;
const outIdx = args.indexOf('--out');
const parIdx = args.indexOf('--parallel');
const PARALLEL = parIdx >= 0 ? Math.max(1, Number(args[parIdx + 1]) || 1) : 1;

const CACHE = path.join(__dirname, '..', '..', '.ecdict-cache');
const OUT = outIdx >= 0 ? args[outIdx + 1] : path.join(CACHE, 'ecdict.csv');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function mkdirp(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); }

/** 取一段字节；返回 { buf, total }，total 从 Content-Range 解析 */
function reqOnce(url, start, end) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=' + start + '-' + end },
      timeout: 45000
    };
    if (useProxy) {
      opts.hostname = PROXY.host;
      opts.port = PROXY.port;
      opts.path = url;
      opts.headers.Host = u.hostname;
    } else {
      opts.hostname = u.hostname;
      opts.port = u.port || 443;
      opts.path = u.pathname;
    }
    const req = https.request(opts, r => {
      if (r.statusCode !== 206 && r.statusCode !== 200) {
        r.resume();
        return reject(new Error('HTTP ' + r.statusCode));
      }
      const bufs = [];
      r.on('data', c => bufs.push(c));
      r.on('end', () => {
        let total = 0;
        const cr = r.headers['content-range'];
        if (cr) { const m = /\/(\d+)\s*$/.exec(cr); if (m) total = Number(m[1]); }
        if (!total) total = Number(r.headers['content-length']) || 0;
        resolve({ buf: Buffer.concat(bufs), total });
      });
      r.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

/** 带重试地取一段（可超过 CHUNK，内部再切块） */
async function downloadRange(url, from, to, label, onBytes) {
  const pieces = [];
  let pos = from;
  while (pos <= to) {
    const end = Math.min(pos + CHUNK - 1, to);
    let got = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try { got = await reqOnce(url, pos, end); break; }
      catch (e) {
        lastErr = e;
        await sleep(800 * attempt);
      }
    }
    if (!got) throw new Error(label + ' 在 ' + pos + ' 处连续失败：' + (lastErr && lastErr.message));
    if (!got.buf.length) break;
    pieces.push(got.buf);
    pos += got.buf.length;
    if (onBytes) onBytes(got.buf.length);
  }
  return Buffer.concat(pieces);
}

async function main() {
  mkdirp(OUT);
  const existing = fs.existsSync(OUT) ? fs.statSync(OUT).size : 0;
  if (existing > 0) console.log('已有 ' + (existing / 1048576).toFixed(2) + ' MB，从断点续传');

  // 用 1 字节探测总大小
  const probe = await reqOnce(TARGET_URL, existing, existing);
  const total = probe.total;
  if (!total) throw new Error('拿不到文件总大小（服务器未返回 Content-Range）');
  console.log('总大小 ' + (total / 1048576).toFixed(2) + ' MB，并发 ' + PARALLEL + ' 段');
  console.log('目标 ' + OUT);

  const remaining = total - existing;
  if (remaining <= 0) { console.log('已完整，无需下载'); return; }

  const segLen = Math.ceil(remaining / PARALLEL);
  let done = existing;
  const onBytes = n => {
    done += n;
    process.stdout.write('\r  ' + (done / 1048576).toFixed(2) + ' / '
      + (total / 1048576).toFixed(2) + ' MB  '
      + (done / total * 100).toFixed(1) + '%   ');
  };

  const jobs = [];
  for (let i = 0; i < PARALLEL; i++) {
    const s = existing + i * segLen;
    const e = Math.min(s + segLen - 1, total - 1);
    if (s > e) break;
    jobs.push(downloadRange(TARGET_URL, s, e, '段' + i, onBytes));
  }

  const bufs = await Promise.all(jobs);
  const fd = fs.openSync(OUT, 'a');
  for (const b of bufs) fs.writeSync(fd, b);
  fs.closeSync(fd);
  console.log();

  const finalSize = fs.statSync(OUT).size;
  console.log('完成：' + (finalSize / 1048576).toFixed(2) + ' MB');
  if (finalSize !== total) console.log('警告：大小与预期不符（预期 ' + total + '）');
  console.log('PATH=' + OUT);
}

main().catch(e => { console.log(); console.log('失败：' + e.message); process.exit(1); });
