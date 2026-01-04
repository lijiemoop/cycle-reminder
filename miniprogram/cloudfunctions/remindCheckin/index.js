// 云函数: remindCheckin
// 智能提醒打卡
// 通过定时触发器调用，建议每30分钟执行一次
const cloud = require('wx-server-sdk');
cloud.init();

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute; // 当前分钟数

  try {
    // 获取所有事项
    const itemsRes = await db.collection('items')
      .where({
        remindTime: _.exists(true)
      })
      .get();

    const items = itemsRes.data;

    for (const item of items) {
      // 获取该事项的历史打卡记录（最近14天）
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 14);
      const recentDateStr = `${recentDate.getFullYear()}-${String(recentDate.getMonth() + 1).padStart(2, '0')}-${String(recentDate.getDate()).padStart(2, '0')}`;

      const checkinsRes = await db.collection('checkins')
        .where({
          itemId: item._id,
          date: _.gte(recentDateStr)
        })
        .get();

      // 分析历史打卡时间，计算平均完成时间
      const avgCompletionTime = calculateAverageCompletionTime(checkinsRes.data, item.remindTime);

      // 判断是否应该提醒（只有在当前时间晚于平均完成时间时才提醒）
      // 并且在平均完成时间后30分钟到2小时内提醒
      const timeSinceAvg = currentTime - avgCompletionTime;
      if (timeSinceAvg < 30 || timeSinceAvg > 120) {
        continue; // 不在提醒时间范围内（早于30分钟或晚于2小时都不提醒）
      }

      // 获取该事项的所有成员
      const members = item.members || [];
      if (members.length === 0) continue;

      // 获取今日每个成员的完成次数
      const todayCheckedRes = await db.collection('checkins')
        .where({
          itemId: item._id,
          date: today
        })
        .get();

      // 按用户分组统计完成次数
      const userCheckinCount = {};
      todayCheckedRes.data.forEach(checkin => {
        userCheckinCount[checkin.userId] = (userCheckinCount[checkin.userId] || 0) + 1;
      });

      const dailyTarget = item.dailyTarget || 1;

      // 找出未完成目标的成员
      const incompleteMembers = members.filter(userId => {
        const count = userCheckinCount[userId] || 0;
        return count < dailyTarget;
      });

      // 获取未完成成员的用户信息
      if (incompleteMembers.length > 0) {
        // 可以发送订阅消息给未完成的成员
        // 需要用户授权订阅消息才能收到提醒
        const _ = db.command;
        const usersRes = await db.collection('users')
          .where({
            _id: _.in(incompleteMembers)
          })
          .get();

        // usersRes.data 包含用户信息，可用于发送模板消息
        // 记录提醒日志
        console.log(`事项「${item.name}」提醒: ${incompleteMembers.length}人未完成目标(${dailyTarget}次)，平均完成时间: ${formatTime(avgCompletionTime)}`);

        // 这里可以添加发送订阅消息的逻辑
        // 需要用户授权订阅消息才能收到提醒
      }
    }

    return {
      success: true,
      message: '检查完成'
    };
  } catch (err) {
    console.error('提醒检查失败', err);
    return {
      success: false,
      error: err
    };
  }
};

// 计算平均完成时间
function calculateAverageCompletionTime(checkins, defaultRemindTime) {
  if (!checkins || checkins.length === 0) {
    // 没有历史数据，使用默认提醒时间
    const [hour, minute] = (defaultRemindTime || '21:00').split(':').map(Number);
    return hour * 60 + minute;
  }

  // 获取每个用户每天最后一次打卡时间，然后计算所有用户的平均完成时间
  const userLastCheckin = {};

  checkins.forEach(checkin => {
    const key = `${checkin.userId}_${checkin.date}`;
    const [h, m] = checkin.time.split(':').map(Number);
    const timeInMinutes = h * 60 + m;

    // 记录该用户当天的打卡时间
    if (!userLastCheckin[key] || timeInMinutes > userLastCheckin[key]) {
      userLastCheckin[key] = timeInMinutes;
    }
  });

  // 计算平均完成时间
  const times = Object.values(userLastCheckin);
  if (times.length === 0) {
    const [hour, minute] = (defaultRemindTime || '21:00').split(':').map(Number);
    return hour * 60 + minute;
  }

  const sum = times.reduce((a, b) => a + b, 0);
  const avgTime = Math.round(sum / times.length);

  return avgTime;
}

// 格式化时间为 HH:mm
function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
