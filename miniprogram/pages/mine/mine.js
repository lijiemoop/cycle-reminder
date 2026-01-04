// pages/mine/mine.js
const db = wx.cloud.database();

Page({
  data: {
    userInfo: null,
    stats: {
      totalItems: 0,
      totalCheckins: 0,
      continuousDays: 0,
    },
    menus: [
      { id: 'myItems', name: '我的事项', icon: '📋' },
      { id: 'checkinRecords', name: '完成记录', icon: '✅' },
      { id: 'notifications', name: '消息通知', icon: '🔔' },
      { id: 'help', name: '帮助反馈', icon: '❓' },
      { id: 'settings', name: '设置', icon: '⚙️' },
    ],
  },

  onLoad() {
    // 获取用户信息
    this.getUserProfile();
  },

  onShow() {
    const app = getApp();
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo });
      this.loadStats();
    }
  },

  // 获取用户信息
  getUserProfile() {
    const app = getApp();
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo });
      this.loadStats();
      return;
    }

    wx.getUserProfile({
      desc: '用于展示个人信息',
      success: (res) => {
        this.setData({ userInfo: res.userInfo });
        app.globalData.userInfo = res.userInfo;
        wx.setStorageSync('userInfo', res.userInfo);

        // 保存到云数据库
        this.saveUserInfo(res.userInfo);
        this.loadStats();
      },
      fail: () => {
        // 如果用户拒绝，使用默认信息
        this.loginAndGetUserInfo();
      }
    });
  },

  // 登录并获取用户信息
  async loginAndGetUserInfo() {
    const app = getApp();
    try {
      await app.login();
      this.setData({ userInfo: app.globalData.userInfo });
      this.loadStats();
    } catch (err) {
      console.error('登录失败', err);
    }
  },

  // 保存用户信息到云数据库
  async saveUserInfo(userInfo) {
    try {
      await db.collection('users').where({
        _openid: '{openid}'
      }).get().then(res => {
        if (res.data.length > 0) {
          db.collection('users').doc(res.data[0]._id).update({
            data: {
              nickName: userInfo.nickName,
              avatarUrl: userInfo.avatarUrl,
              gender: userInfo.gender,
              city: userInfo.city,
              province: userInfo.province,
              country: userInfo.country,
              language: userInfo.language,
              updatedAt: db.serverDate()
            }
          });
        } else {
          db.collection('users').add({
            data: {
              _openid: '{openid}',
              nickName: userInfo.nickName,
              avatarUrl: userInfo.avatarUrl,
              gender: userInfo.gender,
              city: userInfo.city,
              province: userInfo.province,
              country: userInfo.country,
              language: userInfo.language,
              createdAt: db.serverDate()
            }
          });
        }
      });
    } catch (err) {
      console.error('保存用户信息失败', err);
    }
  },

  // 加载统计数据
  async loadStats() {
    const app = getApp();
    if (!app.globalData.userId) return;

    try {
      // 事项总数
      const itemsRes = await db.collection('items')
        .where({
          members: db.command.in([app.globalData.userId])
        })
        .count();

      // 完成总数
      const checkinsRes = await db.collection('checkins')
        .where({
          userId: app.globalData.userId
        })
        .count();

      this.setData({
        stats: {
          totalItems: itemsRes.total,
          totalCheckins: checkinsRes.total,
          continuousDays: 0, // 连续完成天数需要额外计算
        }
      });
    } catch (err) {
      console.error('加载统计失败', err);
    }
  },

  // 菜单点击
  onMenuTap(e) {
    const { id } = e.currentTarget.dataset;
    switch (id) {
      case 'myItems':
        wx.switchTab({ url: '/pages/index/index' });
        break;
      case 'checkinRecords':
        wx.showToast({ title: '功能开发中', icon: 'none' });
        break;
      case 'notifications':
        wx.showToast({ title: '功能开发中', icon: 'none' });
        break;
      case 'help':
        wx.showToast({ title: '功能开发中', icon: 'none' });
        break;
      case 'settings':
        wx.showToast({ title: '功能开发中', icon: 'none' });
        break;
    }
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          getApp().logout();
          this.setData({ userInfo: null });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  // 重新授权
  reAuth() {
    this.getUserProfile();
  }
});
