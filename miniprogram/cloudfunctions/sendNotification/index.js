// 云函数: sendNotification
// 当用户完成某事项时，通知所有关联成员
const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { itemId, userId, userName, userAvatar, time } = event;

  try {
    // 获取事项信息
    const itemRes = await db.collection('items').doc(itemId).get();
    if (!itemRes.data) {
      return {
        success: false,
        error: '事项不存在'
      };
    }

    const item = itemRes.data;
    const members = item.members || [];

    // 获取完成者信息（如果未提供）
    let completedUser = { nickName: userName, avatarUrl: userAvatar };
    if (!userName) {
      const userRes = await db.collection('users').doc(userId).get();
      if (userRes.data) {
        completedUser = userRes.data;
      }
    }

    // 通知所有成员（除了完成者自己）
    const notifications = [];
    for (const memberId of members) {
      if (memberId === userId) continue; // 跳过完成者

      // 创建通知记录
      const notification = {
        userId: memberId,
        type: 'checkin',
        title: `${completedUser.nickName}完成了「${item.name}」`,
        content: `${completedUser.nickName} 于 ${time} 完成了事项「${item.name}」`,
        itemId: itemId,
        fromUserId: userId,
        fromUserName: completedUser.nickName,
        fromUserAvatar: completedUser.avatarUrl,
        read: false,
        createdAt: db.serverDate()
      };

      notifications.push(notification);
    }

    // 批量添加通知
    if (notifications.length > 0) {
      await db.collection('notifications').add({
        data: notifications
      });
    }

    // 记录日志
    console.log(`事项「${item.name}」完成通知: 通知了 ${notifications.length} 位成员`);

    return {
      success: true,
      message: `通知已发送给 ${notifications.length} 位成员`
    };
  } catch (err) {
    console.error('发送通知失败', err);
    return {
      success: false,
      error: err
    };
  }
};
