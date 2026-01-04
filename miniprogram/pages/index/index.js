// pages/index/index.js
const db = wx.cloud.database();

Page({
  data: {
    items: [],
    todayDate: '',
    loading: true,
    showAddDialog: false,
  },

  onLoad() {
    this.getTodayDate();
  },

  onShow() {
    this.checkLoginAndLoad();
  },

  // 获取今日日期
  getTodayDate() {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[date.getDay()];
    this.setData({
      todayDate: `${month}月${day}日 星期${weekDay}`
    });
  },

  // 检查登录并加载数据
  async checkLoginAndLoad() {
    const app = getApp();
    if (!app.globalData.userInfo) {
      await app.login();
    }
    this.loadItems();
  },

  // 加载事项列表
  async loadItems() {
    this.setData({ loading: true });
    try {
      const res = await db.collection('items')
        .where({
          members: db.command.in([app.globalData.userId])
        })
        .orderBy('createdAt', 'desc')
        .get();

      const items = res.data;

      // 获取今日完成数据
      await this.getTodayCheckins(items);

      this.setData({ items, loading: false });
    } catch (err) {
      console.error('加载事项列表失败', err);
      this.setData({ loading: false });
    }
  },

  // 获取今日完成数据
  async getTodayCheckins(items) {
    const today = this.getDateString(new Date());
    const app = getApp();

    const promises = items.map(async item => {
      const checkinRes = await db.collection('checkins')
        .where({
          itemId: item._id,
          userId: app.globalData.userId,
          date: today
        })
        .get();

      const checkinCount = checkinRes.data.length;
      const dailyTarget = item.dailyTarget || 1;
      item.checkinCount = checkinCount;
      item.dailyTarget = dailyTarget;
      item.completed = checkinCount >= dailyTarget;
      item.lastCheckinTime = checkinCount > 0 ? checkinRes.data[checkinCount - 1].time : null;
      return item;
    });

    const updatedItems = await Promise.all(promises);

    // 未完成的排在前面，完成次数少的排在前面
    updatedItems.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return a.checkinCount - b.checkinCount;
    });

    this.setData({ items: updatedItems });
  },

  // 获取日期字符串
  getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 打开添加弹窗
  showAddDialog() {
    this.setData({ showAddDialog: true });
  },

  // 关闭添加弹窗
  closeAddDialog() {
    this.setData({ showAddDialog: false });
  },

  // 跳转到添加页面
  goToAdd() {
    wx.navigateTo({
      url: '/pages/add/add'
    });
  },

  // 跳转详情页
  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  // 完成事项
  async onCheckin(e) {
    const { id, index } = e.currentTarget.dataset;
    await this.checkin(id, index);
  },

  // 执行完成
  async checkin(itemId, index) {
    const app = getApp();
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

      // 更新本地状态
      const items = [...this.data.items];
      items[index].checkinCount = (items[index].checkinCount || 0) + 1;
      items[index].completed = items[index].checkinCount >= items[index].dailyTarget;
      items[index].lastCheckinTime = time;

      // 刷新今日完成数据
      await this.getTodayCheckins(items);
      wx.showToast({ title: '已完成', icon: 'success' });
    } catch (err) {
      console.error('操作失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 移除最近一次完成记录（用于取消）
  async uncheckin(itemId, index) {
    const today = this.getDateString(new Date());
    const app = getApp();

    try {
      // 获取该用户今日的所有完成记录，按时间倒序
      const checkinRes = await db.collection('checkins')
        .where({
          itemId,
          userId: app.globalData.userId,
          date: today
        })
        .orderBy('createdAt', 'desc')
        .get();

      if (checkinRes.data.length > 0) {
        // 删除最近的一次
        await db.collection('checkins').doc(checkinRes.data[0]._id).remove();
      }

      // 更新本地状态
      const items = [...this.data.items];
      items[index].checkinCount = Math.max(0, (items[index].checkinCount || 1) - 1);
      items[index].completed = items[index].checkinCount >= items[index].dailyTarget;

      // 刷新今日完成数据
      await this.getTodayCheckins(items);
      wx.showToast({ title: '已取消', icon: 'none' });
    } catch (err) {
      console.error('取消失败', err);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadItems().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '一起来完成事项吧',
      path: '/pages/index/index'
    };
  }
});
