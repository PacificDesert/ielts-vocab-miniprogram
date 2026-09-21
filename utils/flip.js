/**
 * 翻书动画助手
 *
 * 页面里把「会翻动的那一叠内容」包一层 <view class="turn-wrap {{turn}}">，
 * 换词时不要直接 setData 内容，而是调用 this.turnTo('next', () => { ...换内容... })：
 *
 *   1) 先挂上 turn-out-next，当前这页向装订边翻走（0.2s）
 *   2) 动画结束时执行回调换内容，再挂 turn-in-next 把新页翻回来（0.4s）
 *
 * 翻动期间重复调用会被忽略，避免连点把动画叠在一起。
 */
const OUT_MS = 200;
const IN_MS = 400;

function turnTo(dir, apply) {
  if (this._turning) return false;
  if (typeof apply !== 'function') return false;
  this._turning = true;
  const d = dir === 'prev' ? 'prev' : 'next';
  this.setData({ turn: 'turn-out-' + d });
  this._turnTimer = setTimeout(() => {
    apply();
    this.setData({ turn: 'turn-in-' + d });
    this._turnTimer = setTimeout(() => {
      this._turnTimer = null;
      this._turning = false;
    }, IN_MS);
  }, OUT_MS);
  return true;
}

function stopTurn() {
  if (this._turnTimer) {
    clearTimeout(this._turnTimer);
    this._turnTimer = null;
  }
  this._turning = false;
}

/** 把 turnTo / stopTurn 和 data.turn 注入页面配置 */
function mixin(options) {
  const opt = options || {};
  opt.data = Object.assign({ turn: '' }, opt.data || {});
  opt.turnTo = turnTo;
  opt.stopTurn = stopTurn;
  return opt;
}

module.exports = { mixin, turnTo, stopTurn, OUT_MS, IN_MS };
