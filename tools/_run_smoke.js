/* 临时：跑冒烟测试并把输出写成 UTF-8 文件（PowerShell 的管道编码不可靠） */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, '_smoke.js')], { encoding: 'utf8' });
const out = (r.stdout || '') + (r.stderr || '');
fs.writeFileSync(path.join(__dirname, '_smoke_out.txt'), out, 'utf8');
console.log('exit=' + r.status);
console.log('lines=' + out.split('\n').length);
