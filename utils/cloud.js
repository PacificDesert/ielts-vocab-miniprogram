const config = require('../config');

let ready = false;

function init() {
  if (ready) return true;
  if (!config.CLOUD_ENV || !wx.cloud) return false;
  wx.cloud.init({ env: config.CLOUD_ENV, traceUser: true });
  ready = true;
  return true;
}

function call(name, data) {
  if (!ready) return Promise.reject(new Error('cloud disabled'));
  return wx.cloud.callFunction({ name, data }).then(res => res.result || {});
}

module.exports = {
  init,
  call,
  isReady: () => ready
};
