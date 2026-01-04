# 事项打卡小程序

一个基于微信小程序的打卡追踪工具，支持多人协作完成事项，智能提醒打卡。

## 功能特性

### 基础功能
- **创建事项**：支持设置事项名称、描述、图标
- **周期设置**：每日、每周、每月、自定义周期
- **每日目标**：可设置每日完成次数（1-10次）
- **提醒时间**：设置提醒时间，智能推送打卡通知

### 打卡功能
- **多人协作**：支持分享给好友一起参与
- **每日打卡**：完成事项后点击打卡，支持多次打卡
- **完成记录**：查看历史打卡记录和统计
- **取消打卡**：支持取消最近一次打卡记录
- **进度显示**：实时显示完成进度 (X/Y)

### 智能提醒
- **历史分析**：根据14天历史数据计算平均完成时间
- **智能推送**：在平均完成时间后30分钟-2小时内提醒未完成的用户
- **进度提醒**：未达到每日目标时才会发送提醒

## 项目结构

```
miniprogram/
├── pages/
│   ├── index/      # 首页 - 事项列表
│   ├── add/        # 添加/编辑事项
│   ├── detail/     # 事项详情
│   ├── share/      # 分享页面
│   └── mine/       # 个人中心
├── images/         # 图片资源
├── app.js          # 应用入口
├── app.json        # 应用配置
└── app.wxss        # 全局样式

cloudfunctions/
├── login/          # 用户登录
├── getQRCode/      # 获取小程序码
├── removeMember/   # 移除成员
└── remindCheckin/  # 智能提醒打卡
```

## 数据库设计

### users 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| _openid | string | 用户openid |
| nickName | string | 昵称 |
| avatarUrl | string | 头像 |
| createdAt | date | 创建时间 |
| lastLoginAt | date | 最后登录时间 |

### items 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 事项ID |
| name | string | 事项名称 |
| description | string | 事项描述 |
| creatorId | string | 创建者ID |
| members | array | 成员ID列表 |
| cycleType | string | 周期类型 (daily/weekly/monthly/custom) |
| cycleDays | array | 执行日期 (周几) |
| cycleDates | array | 执行日期 (每月几号) |
| dailyTarget | number | 每日完成次数 (1-10) |
| remindTime | string | 提醒时间 |
| icon | string | 图标emoji |
| iconBg | string | 图标背景色 |
| createdAt | date | 创建时间 |
| updatedAt | date | 更新时间 |

### checkins 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 记录ID |
| itemId | string | 事项ID |
| userId | string | 用户ID |
| userName | string | 用户昵称 |
| userAvatar | string | 用户头像 |
| date | string | 日期 (YYYY-MM-DD) |
| time | string | 时间 (HH:mm) |
| createdAt | date | 创建时间 |

## 部署步骤

### 1. 创建云开发环境
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序后台，开通云开发
3. 创建环境，获取环境ID

### 2. 配置项目
1. 打开 `project.config.json`，替换 `appid` 为你的小程序AppID
2. 打开 `app.js`，替换 `env` 为你的云开发环境ID
3. 打开 `app.json`，配置 TabBar 图标

### 3. 上传云函数
1. 在微信开发者工具中右键点击 `cloudfunctions` 文件夹
2. 选择「上传并部署：云端安装依赖」
3. 依次部署所有云函数

### 4. 创建数据库索引
在微信开发者工具的云开发控制台中：
1. 为 `checkins` 集合创建复合索引：`itemId + date`
2. 为 `items` 集合创建索引：`members`

### 5. 配置定时触发器（remindCheckin）
1. 在微信公众平台的云开发控制台中
2. 为 `remindCheckin` 云函数配置定时触发器
3. 建议配置：每30分钟执行一次

### 6. 配置订阅消息（可选）
1. 在微信公众平台添加订阅消息模板
2. 在 `remindCheckin` 云函数中添加模板消息发送逻辑

## 使用说明

### 添加事项
1. 点击首页右下角 "+" 按钮
2. 填写事项名称、描述
3. 选择执行周期（每日/每周/每月）
4. 设置每日完成次数（1-10次）
5. 选择提醒时间（可选）
6. 选择图标，完成添加

### 打卡
1. 在首页找到要打卡的事项
2. 点击右侧圆形按钮完成打卡
3. 显示绿色对勾表示已完成目标次数

### 分享事项
1. 进入事项详情页
2. 点击右上角分享给好友
3. 好友加入后可一起打卡

## 技术栈

- 微信小程序原生开发
- 微信云开发（云数据库 + 云函数）

## 注意事项

1. 小程序需要发布后才能被其他人访问
2. 云函数需要开通后才可使用
3. 订阅消息需要用户授权才能收到提醒
4. remindCheckin 云函数需要配置定时触发器才能正常工作
5. 智能提醒功能会根据历史数据自动调整提醒时间
