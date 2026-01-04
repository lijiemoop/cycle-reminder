// 云函数: login
const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const db = cloud.database();

  try {
    // 获取或创建用户
    let userRes = await db.collection('users')
      .where({ _openid: wxContext.OPENID })
      .get();

    let userInfo;

    if (userRes.data.length > 0) {
      // 用户已存在，更新登录信息
      userInfo = userRes.data[0];
      await db.collection('users').doc(userInfo._id).update({
        data: {
          lastLoginAt: db.serverDate()
        }
      });
    } else {
      // 创建新用户
      const addRes = await db.collection('users').add({
        data: {
          _openid: wxContext.OPENID,
          nickName: `用户${wxContext.OPENID.slice(-6)}`,
          avatarUrl: '',
          createdAt: db.serverDate(),
          lastLoginAt: db.serverDate()
        }
      });
      userInfo = { _id: addRes._id };
    }

    return {
      success: true,
      userInfo: {
        _id: userInfo._id,
        openid: wxContext.OPENID,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err
    };
  }
};
