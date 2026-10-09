/**
 * 云开发环境配置
 * 在微信开发者工具中开通「云开发」后，把环境 ID 填到 CLOUD_ENV。
 * 留空则小程序以「本地模式」运行：进度只存在手机本地，不做云端同步。
 */
module.exports = {
  CLOUD_ENV: '',

  // 发音音源：有道词典公开接口。正式版需要在小程序后台把 dict.youdao.com
  // 加入 downloadFile 合法域名。
  // 留空则隐藏发音按钮，改用不依赖外部域名的方案。
  AUDIO_API: 'https://dict.youdao.com/dictvoice?type=2&audio=',

  /**
   * 口语评测（讯飞语音评测）。
   *
   * 讯飞的 AppID / APIKey / APISecret **必须放在云函数的环境变量里**，
   * 绝不能写进这个文件 —— 小程序的前端代码是可以被反编译看到的，
   * 密钥泄露后别人能拿你的额度去用。
   *
   * 云函数 `speech` 的配置步骤见 cloudfunctions/speech/README 说明。
   * 未配置云环境时，口语页只出题不评分（采集照常，评分区给出提示）。
   */
  SPEECH: {
    FN: 'speech',      // 云函数名
    // 每条音频最长毫秒数（讯飞单次会话上限 5 分钟，这里给录音留足余量）
    MAX_MS: 60000
  },

  // 每组学习计划默认值（用户可在「我的」里自行修改）
  DEFAULT_PLAN: {
    perRound: 20,
    showExpand: true,
    autoSync: true,
    // 有声模式（默认开）：进入单词卡自动读单词读音，翻到背面自动读例句；
    // 关掉即静音模式。可在「我的」→ 学习计划 里随时切换。
    sound: true
  },
  // 每组单词数下限；上限按词库总量自然封顶（不额外限制）
  PLAN_MIN: 1
};
