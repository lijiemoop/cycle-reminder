// pages/share/share.js
const db = wx.cloud.database();

Page({
  data: {
    itemId: '',
    item: null,
    loading: true,
    joined: false,
    todayChecked: false,
    checkinTime: '',
    isCreator: false,
  },

  onLoad(options) {
    if (options.itemId) {
      this.setData({ itemId: options.itemId });
      this.checkLoginAndLoad(options.itemId);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 检查登录并加载数据
  async checkLoginAndLoad(itemId) {
    const app = getApp();

    // 确保已登录
    if (!app.globalData.userInfo) {
      await app.login();
    }

    this.loadItemDetail(itemId);
  },

  // 加载事项详情
  async loadItemDetail(itemId) {
    this.setData({ loading: true });

    try {
      const itemRes = await db.collection('items').doc(itemId).get();
      const item = itemRes.data;
      const app = getApp();

      // 检查是否已经是成员
      const isMember = item.members && item.members.includes(app.globalData.userId);
      const isCreator = item.creatorId === app.globalData.userId;

      this.setData({
        item,
        loading: false,
        joined: isMember,
        isCreator
      });

      // 如果已加入，获取今日完成状态
      if (isMember) {
        await this.checkTodayCheckin(itemId);
      }
    } catch (err) {
      console.error('加载失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 检查今日完成状态
  async checkTodayCheckin(itemId) {
    const app = getApp();
    const today = this.getDateString(new Date());

    try {
      const res = await db.collection('checkins')
        .where({
          itemId,
          userId: app.globalData.userId,
          date: today
        })
        .get();

      const checkinCount = res.data.length;
      const dailyTarget = this.data.item?.dailyTarget || 1;
      const completed = checkinCount >= dailyTarget;

      if (checkinCount > 0) {
        this.setData({
          checkinCount,
          dailyTarget,
          completed,
          todayChecked: completed,
          checkinTime: res.data[checkinCount - 1].time
        });
      } else {
        this.setData({
          checkinCount: 0,
          dailyTarget,
          completed: false,
          todayChecked: false,
          checkinTime: ''
        });
      }
    } catch (err) {
      console.error('检查打卡状态失败', err);
    }
  },

  getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加入事项
  async joinItem() {
    const app = getApp();
    const { itemId, item } = this.data;

    wx.showLoading({ title: '加入中...' });

    try {
      // 添加到成员列表
      const newMembers = [...(item.members || []), app.globalData.userId];

      await db.collection('items').doc(itemId).update({
        data: {
          members: newMembers,
          updatedAt: db.serverDate()
        }
      });

      // 保存用户信息到 users 集合
      await this.saveUserToMembers(app.globalData.userInfo);

      this.setData({
        item: { ...item, members: newMembers },
        joined: true
      });

      wx.hideLoading();
      wx.showToast({ title: '加入成功', icon: 'success' });

      // 检查今日完成
      await this.checkTodayCheckin(itemId);
    } catch (err) {
      wx.hideLoading();
      console.error('加入失败', err);
      wx.showToast({ title: '加入失败', icon: 'none' });
    }
  },

  // 保存用户信息到 members 集合
  async saveUserToMembers(userInfo) {
    try {
      const res = await db.collection('members')
        .where({
          userId: userInfo._id || '{openid}'
        })
        .get();

      if (res.data.length === 0) {
        await db.collection('members').add({
          data: {
            userId: userInfo._id,
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            joinedAt: db.serverDate()
          }
        });
      }
    } catch (err) {
      console.error('保存用户信息失败', err);
    }
  },

  // 完成事项
  async onCheckin() {
    await this.checkin();
  },

  // 执行完成
  async checkin() {
    const app = getApp();
    const { itemId, item } = this.data;
    const now = new Date();
    const today = this.getDateString(now);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      await db.collection('checkins').add({
        data: {
          itemId,
          userId: app.globalData.userId,
          userName: app.globalData.userInfo.nickName,
          userAvatar: app.globalData.userInfo.avatarUrl,
          date: today,
          time,
          createdAt: db.serverDate()
        }
      });

      // 发送通知给其他成员
      try {
        await wx.cloud.callFunction({
          name: 'sendNotification',
          data: {
            itemId,
            userId: app.globalData.userId,
            userName: app.globalData.userInfo.nickName,
            userAvatar: app.globalData.userInfo.avatarUrl,
            time
          }
        });
      } catch (notifyErr) {
        console.error('发送通知失败', notifyErr);
      }

      // 刷新今日完成状态
      await this.checkTodayCheckin(itemId);

      wx.showToast({ title: '已完成', icon: 'success' });
    } catch (err) {
      console.error('完成失败', err);
      wx.showToast({ title: '完成失败', icon: 'none' });
    }
  },

  // 移除最近一次完成记录
  async uncheckin() {
    const app = getApp();
    const { itemId } = this.data;
    const today = this.getDateString(new Date());

    try {
      const checkinRes = await db.collection('checkins')
        .where({
          itemId,
          userId: app.globalData.userId,
          date: today
        })
        .orderBy('createdAt', 'desc')
        .get();

      if (checkinRes.data.length > 0) {
        await db.collection('checkins').doc(checkinRes.data[0]._id).remove();
      }

      // 刷新今日完成状态
      await this.checkTodayCheckin(itemId);

      wx.showToast({ title: '已取消', icon: 'none' });
    } catch (err) {
      console.error('取消完成失败', err);
    }
  },

  // 跳转到详情页
  goToDetail() {
    wx.redirectTo({
      url: `/pages/detail/detail?id=${this.data.itemId}`
    });
  },

  // 返回首页
  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
