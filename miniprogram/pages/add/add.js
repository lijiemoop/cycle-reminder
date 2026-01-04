// pages/add/add.js
const db = wx.cloud.database();

Page({
  data: {
    itemId: '',
    isEdit: false,
    name: '',
    description: '',
    cycleType: 'daily', // daily-每日, weekly-每周, monthly-每月, custom-自定义
    cycleDays: [1, 2, 3, 4, 5, 6, 0], // 周几执行 1-周一, 0-周日
    cycleDates: [], // 每月几号执行
    dailyTarget: 1, // 每日完成次数
    remindTime: '', // 提醒时间
    icon: '📌',
    iconBg: '#07c160',
    icons: [
      { icon: '📌', bg: '#07c160' },
      { icon: '🏃', bg: '#1989fa' },
      { icon: '📚', bg: '#ff976a' },
      { icon: '💊', bg: '#ee0a24' },
      { icon: '💧', bg: '#7232dd' },
      { icon: '🛏️', bg: '#3f45ff' },
      { icon: '🍎', bg: '#07c160' },
      { icon: '✍️', bg: '#1989fa' },
      { icon: '🎯', bg: '#ff976a' },
      { icon: '🎨', bg: '#ee0a24' },
      { icon: '🎵', bg: '#7232dd' },
      { icon: '🚴', bg: '#3f45ff' },
    ],
    weekDays: [
      { value: 1, label: '一' },
      { value: 2, label: '二' },
      { value: 3, label: '三' },
      { value: 4, label: '四' },
      { value: 5, label: '五' },
      { value: 6, label: '六' },
      { value: 0, label: '日' },
    ],
    dailyTargets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        itemId: options.id,
        isEdit: true
      });
      this.loadItem(options.id);
    }
  },

  // 加载事项数据
  async loadItem(id) {
    try {
      const res = await db.collection('items').doc(id).get();
      const item = res.data;

      this.setData({
        name: item.name,
        description: item.description || '',
        cycleType: item.cycleType || 'daily',
        cycleDays: item.cycleDays || [1, 2, 3, 4, 5, 6, 0],
        cycleDates: item.cycleDates || [],
        dailyTarget: item.dailyTarget || 1,
        remindTime: item.remindTime || '',
        icon: item.icon || '📌',
        iconBg: item.iconBg || '#07c160',
      });

      wx.setNavigationBarTitle({ title: '编辑事项' });
    } catch (err) {
      console.error('加载事项失败', err);
    }
  },

  // 输入事项名称
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  // 输入描述
  onDescInput(e) {
    this.setData({ description: e.detail.value });
  },

  // 选择周期类型
  onCycleTypeChange(e) {
    this.setData({ cycleType: e.detail.value });
  },

  // 选择周几
  onWeekDayChange(e) {
    const { value } = e.detail;
    const days = value.map(Number);
    this.setData({ cycleDays: days });
  },

  // 选择每月几号
  onDateChange(e) {
    this.setData({ cycleDates: e.detail.value });
  },

  // 选择提醒时间
  onTimeChange(e) {
    this.setData({ remindTime: e.detail.value });
  },

  // 选择每日完成次数
  onDailyTargetChange(e) {
    this.setData({ dailyTarget: Number(e.detail.value) + 1 });
  },

  // 选择图标
  selectIcon(e) {
    const { icon, bg } = e.currentTarget.dataset;
    this.setData({ icon, iconBg: bg });
  },

  // 自定义图标颜色
  onIconBgChange(e) {
    this.setData({ iconBg: e.detail.value });
  },

  // 保存
  async save() {
    const { name, cycleType, cycleDays, cycleDates } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: '请输入事项名称', icon: 'none' });
      return;
    }

    if (cycleType === 'weekly' && cycleDays.length === 0) {
      wx.showToast({ title: '请选择执行日期', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const app = getApp();
      const itemData = {
        name: name.trim(),
        description: this.data.description.trim(),
        cycleType,
        cycleDays: cycleType === 'weekly' ? cycleDays : [1, 2, 3, 4, 5, 6, 0],
        cycleDates: cycleType === 'monthly' ? cycleDates : [],
        dailyTarget: this.data.dailyTarget,
        remindTime: this.data.remindTime,
        icon: this.data.icon,
        iconBg: this.data.iconBg,
        updatedAt: db.serverDate(),
      };

      if (this.data.isEdit) {
        await db.collection('items').doc(this.data.itemId).update({
          data: itemData
        });
      } else {
        itemData.creatorId = app.globalData.userId;
        itemData.members = [app.globalData.userId];
        itemData.createdAt = db.serverDate();
        const res = await db.collection('items').add({ data: itemData });
        this.setData({ itemId: res._id });
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 取消
  onCancel() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消吗？已填写的内容将丢失',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  }
});
