/**
 * 云开发环境配置
 * 在微信开发者工具中开通「云开发」后，把环境 ID 填到 CLOUD_ENV。
 * 留空则小程序以「本地模式」运行：进度只存在手机本地，不做云端同步。
 */
module.exports = {
  CLOUD_ENV: '',

  // 发音音源：有道词典公开接口。使用前需在小程序后台把 dict.youdao.com
  // 加入 downloadFile / request 合法域名，或在开发者工具里勾选「不校验合法域名」。
  AUDIO_API: 'https://dict.youdao.com/dictvoice?type=2&audio=',

  // 每组学习计划默认值（用户可在「我的」里自行修改）
  DEFAULT_PLAN: {
    perRound: 20,
    showExpand: true
  },
  // 每组单词数下限；上限按词库总量自然封顶（不额外限制）
  PLAN_MIN: 1
};
