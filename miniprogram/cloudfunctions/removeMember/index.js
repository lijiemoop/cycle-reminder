// 云函数: removeMember
// 移除事项成员
const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { itemId, userId } = event;

  try {
    // 验证是否是创建者
    const itemRes = await db.collection('items').doc(itemId).get();

    if (!itemRes.data) {
      return {
        success: false,
        error: '事项不存在'
      };
    }

    if (itemRes.data.creatorId !== wxContext.OPENID && itemRes.data.creatorId !== userId) {
      return {
        success: false,
        error: '无权操作'
      };
    }

    // 不能移除创建者
    if (itemRes.data.creatorId === userId) {
      return {
        success: false,
        error: '不能移除创建者'
      };
    }

    // 移除成员
    const members = itemRes.data.members || [];
    const newMembers = members.filter(id => id !== userId);

    await db.collection('items').doc(itemId).update({
      data: {
        members: newMembers,
        updatedAt: db.serverDate()
      }
    });

    return {
      success: true
    };
  } catch (err) {
    return {
      success: false,
      error: err
    };
  }
};
