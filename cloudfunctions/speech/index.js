/**
 * 口语评测云函数 —— 代理讯飞「语音评测」的 WebSocket 接口。
 *
 * ⚠️ 密钥配置（必读）
 * ------------------------------------------------------------------
 * 不要把讯飞的 AppID / APIKey / APISecret 写进代码或前端！
 * 小程序的前端包是可以被反编译的，写进去等于公开自己的额度。
 *
 * 正确做法：在微信开发者工具 → 云开发 → 云函数 → speech → 配置 → 环境变量，
 * 添加这三项（值从讯飞开放平台控制台取）：
 *
 *   XF_APPID     应用 AppID
 *   XF_APIKEY    接口密钥 APIKey
 *   XF_APISECRET 接口密钥 APISecret
 *
 * 讯飞那边需要：
 *   1. 在讯飞开放平台创建应用，开通「语音评测（流式版）」
 *   2. 创建应用后默认有每日 500 次免费调用；实名认证另送新用户礼包
 *
 * 调用参数
 * ------------------------------------------------------------------
 *   audio     base64 音频（16k / 16bit / 单声道；mp3 传 format:'mp3'）
 *   format    'mp3' | 'pcm' | 'wav'
 *   refText   参考文本（跟读模式必填）
 *   mode      'sentence' 句子评测（跟读）| 'free' 自由说（考官作答）
 */

const crypto = require('crypto');
const WebSocket = require('ws');

const HOST = 'ise-api.xfyun.cn';
const PATH = '/v2/open-ise';

/** 把评分维度统一成 0-100 的整数，前端按固定四维展示 */
function norm(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 生成讯飞的 WebSocket 鉴权地址 */
function buildUrl(apiKey, apiSecret) {
  const date = new Date().toUTCString();
  const origin = [
    'host: ' + HOST,
    'date: ' + date,
    'GET ' + PATH + ' HTTP/1.1'
  ].join('\n');
  const signature = crypto.createHmac('sha256', apiSecret).update(origin).digest('base64');
  const authOrigin = 'api_key="' + apiKey + '", algorithm="hmac-sha256", '
    + 'headers="host date request-line", signature="' + signature + '"';
  const authorization = Buffer.from(authOrigin).toString('base64');
  return 'wss://' + HOST + PATH
    + '?authorization=' + encodeURIComponent(authorization)
    + '&date=' + encodeURIComponent(date)
    + '&host=' + HOST;
}

/** 按讯飞要求把评分结果摊平成前端要的形状 */
function flatten(result) {
  // 句子/自由说的结构略有差别，逐层往下找
  let node = result && result.data;
  if (node && node.data) node = node.data;          // 自由说多包一层
  if (!node) return null;

  const out = {};
  const put = (key, v) => { if (typeof v !== 'undefined') out[key] = norm(v); };

  put('total', node.total_score);
  // 常见维度命名：pron/accuracy、fluency、integrity、tone
  put('pronunciation', node.pron_score !== undefined ? node.pron_score : node.accuracy_score);
  put('fluency', node.fluency_score !== undefined ? node.fluency_score : node.fluent_score);
  put('integrity', node.integrity_score !== undefined ? node.integrity_score : node.integrity);
  put('tone', node.tone_score !== undefined ? node.tone_score : node.phone_score);

  if (!Object.keys(out).length) return null;
  if (out.total === undefined) {
    // 没给总分就用维度均值兜底，避免前端显示 0
    const keys = ['pronunciation', 'fluency', 'integrity', 'tone'].filter(k => out[k] !== undefined);
    if (keys.length) out.total = Math.round(keys.reduce((a, k) => a + out[k], 0) / keys.length);
  }
  return out;
}

/** 根据分数给一句人话建议 */
function advice(s) {
  if (!s) return '';
  const tips = [];
  if (s.pronunciation !== undefined && s.pronunciation < 70) tips.push('个别音发得不够清楚，先慢下来把每个音读准');
  if (s.fluency !== undefined && s.fluency < 70) tips.push('停顿偏多，试着把句子连起来说');
  if (s.integrity !== undefined && s.integrity < 70) tips.push('有漏读的部分，跟着原文逐词念完整');
  if (s.tone !== undefined && s.tone < 70) tips.push('语调偏平，注意句子的升降调');
  if (!tips.length) tips.push('整体不错，可以再提速一点挑战自然语速');
  return tips.join('；') + '。';
}

exports.main = async (event) => {
  const appid = process.env.XF_APPID;
  const apikey = process.env.XF_APIKEY;
  const apisecret = process.env.XF_APISECRET;

  if (!appid || !apikey || !apisecret) {
    return { ok: false, msg: '云函数未配置讯飞密钥（环境变量 XF_APPID / XF_APIKEY / XF_APISECRET）' };
  }

  const audio = event && event.audio;
  const format = (event && event.format) || 'mp3';
  const refText = event && event.refText;
  const mode = (event && event.mode) || 'sentence';

  if (!audio) return { ok: false, msg: '缺少音频数据' };
  if (mode !== 'free' && !refText) return { ok: false, msg: '缺少参考文本' };

  const category = mode === 'free' ? 'read_sentence' : 'read_sentence';
  // 讯飞英文文本要带 BOM，否则首词评分异常
  const text = '\uFEFF[content]\n' + (refText || '');

  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };

    let ws;
    try {
      ws = new WebSocket(buildUrl(apikey, apisecret));
    } catch (e) {
      return finish({ ok: false, msg: '无法建立评测连接：' + e.message });
    }

    const timer = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      finish({ ok: false, msg: '评测超时' });
    }, 25000);

    ws.on('open', () => {
      const frame = audio.toString('base64');
      // 每帧 128KB 左右，讯飞要求 40ms 间隔发送
      const CHUNK = 128 * 1024;
      const frames = [];
      for (let i = 0; i < frame.length; i += CHUNK) frames.push(frame.slice(i, i + CHUNK));

      const business = {
        category,
        sub: 'ise',
        ent: 'en_vip',
        cmd: 'ssb',
        text,
        ttp_skip: true,
        aue: format === 'mp3' ? 'lame' : 'raw',
        aus: 1
      };

      // 第一帧：上传参数（status=0）
      ws.send(JSON.stringify({
        common: { app_id: appid },
        business,
        data: { status: 0 }
      }));

      let k = 0;
      const push = () => {
        if (k >= frames.length) {
          // 最后一帧（status=2）告知语料发送完毕
          ws.send(JSON.stringify({ business: { cmd: 'auw', aus: 1, aue: business.aue }, data: { status: 2, data: '' } }));
          return;
        }
        const last = k === frames.length - 1;
        ws.send(JSON.stringify({
          business: { cmd: 'auw', aus: 1, aue: business.aue },
          data: { status: last ? 2 : 1, data: frames[k] }
        }));
        k += 1;
        if (!last) setTimeout(push, 40);
      };
      setTimeout(push, 40);
    });

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
      if (msg.code && msg.code !== 0) {
        clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        return finish({ ok: false, msg: '讯飞返回错误 ' + msg.code + '：' + (msg.message || '') });
      }
      if (!msg.data) return;
      // status=2 表示最后一帧结果
      if (msg.data.status === 2) {
        clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        const s = flatten(msg);
        if (!s) return finish({ ok: false, msg: '未能解析评测结果' });
        finish(Object.assign({ ok: true }, s, { advice: advice(s) }));
      }
    });

    ws.on('error', err => {
      clearTimeout(timer);
      finish({ ok: false, msg: '评测连接出错：' + err.message });
    });

    ws.on('close', () => {
      clearTimeout(timer);
      finish({ ok: false, msg: '评测连接提前关闭' });
    });
  });
};
