const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COL = 'user_data';

/**
 * 用户学习数据读写。
 * 云函数以管理员身份运行，按 openid 一人一条记录，互不干扰。
 * 集合 user_data 建议权限设为「仅创建者可读写」。
 */
exports.main = async event => {
  const { OPENID } = cloud.getWXContext();
  const action = event && event.action;

  if (action === 'save') {
    const state = (event.payload && event.payload.state) || {};
    const data = { state, updatedAt: db.serverDate() };
    const exist = await db.collection(COL).where({ oid: OPENID }).limit(1).get();
    if (exist.data.length) {
      await db.collection(COL).doc(exist.data[0]._id).update({ data });
    } else {
      await db.collection(COL).add({ data: Object.assign({ oid: OPENID }, data) });
    }
    return { ok: true };
  }

  if (action === 'load') {
    const res = await db.collection(COL).where({ oid: OPENID }).limit(1).get();
    return { ok: true, state: res.data.length ? res.data[0].state : null };
  }

  return { ok: false, msg: 'unknown action' };
};
