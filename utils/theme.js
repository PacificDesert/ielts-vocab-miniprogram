/**
 * 主题：浅色 / 深色 / 跟随系统
 *
 * 三方协同：
 *   1. app.json + theme.json 负责首屏原生导航栏、tabBar（跟随系统）
 *   2. app.wxss 的 .t-light / .t-dark 负责页面内所有颜色
 *   3. 本模块负责「模式」记忆、系统主题监听，以及手动模式下对原生控件的强制覆盖
 */
const KEY = 'ielts_vocab_theme';
const MODES = ['auto', 'light', 'dark'];

let mode = 'auto';
let systemDark = false;
let listeners = [];

function readSystemTheme() {
  try {
    const info = wx.getSystemInfoSync();
    systemDark = info.theme === 'dark';
  } catch (e) {
    systemDark = false;
  }
}

function init() {
  const saved = wx.getStorageSync(KEY);
  mode = MODES.indexOf(saved) >= 0 ? saved : 'auto';
  readSystemTheme();
  if (wx.onThemeChange) {
    wx.onThemeChange(res => {
      systemDark = res.theme === 'dark';
      applyNative();
      listeners.forEach(fn => fn());
    });
  }
  return mode;
}

function getMode() { return mode; }

function isDark() {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemDark;
}

function className() {
  return isDark() ? 't-dark' : 't-light';
}

/** 手动模式需要盖掉系统主题对原生控件的影响；auto 时同样按解析结果设置，保证一致 */
function applyNative() {
  const dark = isDark();
  wx.setNavigationBarColor({
    frontColor: dark ? '#ffffff' : '#000000',
    backgroundColor: dark ? '#1C1C1E' : '#F2F2F7'
  });
  if (wx.setBackgroundColor) {
    wx.setBackgroundColor({
      backgroundColor: dark ? '#000000' : '#F2F2F7',
      backgroundColorTop: dark ? '#000000' : '#F2F2F7',
      backgroundColorBottom: dark ? '#000000' : '#F2F2F7'
    });
  }
  wx.setTabBarStyle({
    color: dark ? '#D1D1D6' : '#8E8E93',
    selectedColor: dark ? '#0A84FF' : '#007AFF',
    backgroundColor: dark ? '#1C1C1E' : '#FFFFFF',
    borderStyle: dark ? 'white' : 'black'
  });
}

function setMode(next) {
  if (MODES.indexOf(next) < 0) return getMode();
  mode = next;
  wx.setStorageSync(KEY, mode);
  applyNative();
  listeners.forEach(fn => fn());
  return mode;
}

/** 页面注册：跟随系统时需要重绘，所以统一挂监听 */
function watch(fn) {
  listeners.push(fn);
}

function unwatch(fn) {
  listeners = listeners.filter(it => it !== fn);
}

/** 页面 onShow 里调用，返回该塞进 data 的主题信息 */
function data() {
  applyNative();
  return { dark: isDark(), themeClass: className(), themeMode: mode };
}

module.exports = { init, getMode, setMode, isDark, className, data, applyNative, watch, unwatch, MODES };
