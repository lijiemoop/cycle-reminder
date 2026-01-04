// 云函数: getQRCode
// 生成小程序的二维码，用于分享
const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { itemId } = event;

  try {
    // 调用微信接口生成二维码
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: itemId,
      page: 'pages/share/share',  // 分享页面路径
      width: 430,
      lineColor: {
        r: 7,
        g: 193,
        b: 96
      },
      isHyaline: true
    });

    // 上传到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: `qrcodes/${itemId}_${Date.now()}.png`,
      fileContent: result.buffer
    });

    return {
      success: true,
      fileID: uploadRes.fileID
    };
  } catch (err) {
    return {
      success: false,
      error: err
    };
  }
};
