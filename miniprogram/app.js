// app.js
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        traceUser: true,
        env: 'your-env-id', // 替换为你的云开发环境ID
      });
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  globalData: {
    userInfo: null,
    userId: null,
  },

  // 检查登录状态
  async checkLoginStatus() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.globalData.userInfo = userInfo;
        this.globalData.userId = userInfo._id;
      }
    } catch (e) {
      console.error('获取登录状态失败', e);
    }
  },

  // 用户登录
  async login() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'login',
        data: {},
        success: res => {
          const userInfo = res.result.userInfo;
          this.globalData.userInfo = userInfo;
          this.globalData.userId = userInfo._id;
          wx.setStorageSync('userInfo', userInfo);
          resolve(userInfo);
        },
        fail: err => {
          console.error('登录失败', err);
          reject(err);
        }
      });
    });
  },

  // 退出登录
  logout() {
    this.globalData.userInfo = null;
    this.globalData.userId = null;
    wx.removeStorageSync('userInfo');
  }
});
