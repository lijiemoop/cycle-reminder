// pages/detail/detail.js
const db = wx.cloud.database();

Page({
  data: {
    item: null,
    checkins: [],
    members: [],
    loading: true,
    showShareMenu: false,
    showQRCode: false,
    qrCodeUrl: '',
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ itemId: options.id });
      this.loadItemDetail();
    }
  },

  onShow() {
    if (this.data.itemId) {
      this.loadItemDetail();
    }
  },

  // 加载事项详情
  async loadItemDetail() {
    this.setData({ loading: true });
    try {
      const itemRes = await db.collection('items').doc(this.data.itemId).get();
      const item = itemRes.data;

      // 加载完成记录
      await this.loadCheckins();

      // 加载成员列表
      await this.loadMembers(item.members);

      this.setData({ item, loading: false });
    } catch (err) {
      console.error('加载详情失败', err);
      this.setData({ loading: false });
    }
  },

  // 加载完成记录
  async loadCheckins() {
    try {
      const res = await db.collection('checkins')
        .where({
          itemId: this.data.itemId
        })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      // 按日期分组
      const grouped = {};
      res.data.forEach(item => {
        if (!grouped[item.date]) {
          grouped[item.date] = [];
        }
        grouped[item.date].push(item);
      });

      // 转换为数组并排序
      const checkins = Object.keys(grouped)
        .sort((a, b) => new Date(b) - new Date(a))
        .map(date => ({
          date,
          users: grouped[date]
        }));

      this.setData({ checkins });
    } catch (err) {
      console.error('加载完成记录失败', err);
    }
  },

  // 加载成员列表
  async loadMembers(memberIds) {
    if (!memberIds || memberIds.length === 0) {
      this.setData({ members: [] });
      return;
    }

    try {
      const res = await db.collection('users')
        .where({
          _id: db.command.in(memberIds)
        })
        .get();

      this.setData({ members: res.data });
    } catch (err) {
      console.error('加载成员列表失败', err);
    }
  },

  // 获取日期显示
  getDateDisplay(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === this.getDateString(today)) {
      return '今天';
    } else if (dateStr === this.getDateString(yesterday)) {
      return '昨天';
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      return `${month}月${day}日 星期${weekDays[date.getDay()]}`;
    }
  },

  getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 完成事项
  async onCheckin() {
    if (this.data.item && this.data.item.todayChecked) {
      // 取消完成
      await this.uncheckin();
    } else {
      // 完成
      await this.checkin();
    }
  },

  // 执行完成
  async checkin() {
    const app = getApp();
    const now = new Date();
    const today = this.getDateString(now);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      await db.collection('checkins').add({
        data: {
          itemId: this.data.itemId,
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
            itemId: this.data.itemId,
            userId: app.globalData.userId,
            userName: app.globalData.userInfo.nickName,
            userAvatar: app.globalData.userInfo.avatarUrl,
            time
          }
        });
      } catch (notifyErr) {
        console.error('发送通知失败', notifyErr);
      }

      // 更新状态
      const item = { ...this.data.item };
      item.todayChecked = true;
      item.todayCheckinTime = time;

      this.setData({ item });
      wx.showToast({ title: '已完成', icon: 'success' });

      // 刷新完成记录
      this.loadCheckins();
    } catch (err) {
      console.error('操作失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 取消完成
  async uncheckin() {
    const today = this.getDateString(new Date());
    const app = getApp();

    try {
      const checkinRes = await db.collection('checkins')
        .where({
          itemId: this.data.itemId,
          userId: app.globalData.userId,
          date: today
        })
        .get();

      if (checkinRes.data.length > 0) {
        await db.collection('checkins').doc(checkinRes.data[0]._id).remove();
      }

      const item = { ...this.data.item };
      item.todayChecked = false;

      this.setData({ item });
      wx.showToast({ title: '已取消', icon: 'none' });

      // 刷新完成记录
      this.loadCheckins();
    } catch (err) {
      console.error('取消失败', err);
    }
  },

  // 显示分享菜单
  showShareAction() {
    this.setData({ showShareMenu: true });
  },

  // 关闭分享菜单
  closeShareMenu() {
    this.setData({ showShareMenu: false });
  },

  // 生成分享卡片
  onShareAppMessage() {
    return {
      title: `一起来完成「${this.data.item.name}」`,
      path: `/pages/share/share?itemId=${this.data.itemId}`,
      imageUrl: ''
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: `一起来完成「${this.data.item.name}」`,
      query: `itemId=${this.data.itemId}`
    };
  },

  // 生成二维码
  async generateQRCode() {
    this.setData({ showShareMenu: false });

    wx.showLoading({ title: '生成中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'getQRCode',
        data: {
          itemId: this.data.itemId,
          scene: this.data.itemId
        }
      });

      if (res.result.fileID) {
        const filePath = `${wx.env.USER_DATA_PATH}/qrcode.png`;
        await wx.cloud.downloadFile({
          fileID: res.result.fileID,
          success: downloadRes => {
            this.setData({
              qrCodeUrl: downloadRes.tempFilePath,
              showQRCode: true
            });
          },
          fail: err => {
            console.error('下载二维码失败', err);
            wx.showToast({ title: '生成失败', icon: 'none' });
          }
        });
      }
    } catch (err) {
      console.error('生成二维码失败', err);
      wx.showToast({ title: '生成失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 保存二维码
  saveQRCode() {
    if (!this.data.qrCodeUrl) return;

    wx.saveImageToPhotosAlbum({
      filePath: this.data.qrCodeUrl,
      success: () => {
        wx.showToast({ title: '保存成功', icon: 'success' });
      },
      fail: err => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存图片',
            success: modalRes => {
              if (modalRes.confirm) {
                wx.openSetting();
              }
            }
          });
        }
      }
    });
  },

  // 关闭二维码弹窗
  closeQRCode() {
    this.setData({ showQRCode: false });
  },

  // 编辑事项
  goToEdit() {
    wx.navigateTo({
      url: `/pages/add/add?id=${this.data.itemId}`
    });
  },

  // 删除事项
  async deleteItem() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个事项吗？所有完成记录将被删除',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('items').doc(this.data.itemId).remove();
            wx.showToast({ title: '删除成功', icon: 'success' });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (err) {
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 移除成员
  async removeMember(e) {
    const { userId } = e.currentTarget.dataset;

    wx.showModal({
      title: '移除成员',
      content: '确定要将该成员移出吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({
              name: 'removeMember',
              data: {
                itemId: this.data.itemId,
                userId
              }
            });

            wx.showToast({ title: '已移除', icon: 'success' });
            this.loadItemDetail();
          } catch (err) {
            console.error('移除成员失败', err);
          }
        }
      }
    });
  }
});
