/**
 * 默认配置
 * 请复制一份重命名为config.js
 * 然后填写配置信息
 */
let config = {
  //qq账号 密码
  account: {
    qq: "",  //账号
    pwd: "", //密码，可为空则用扫码登录
  },

  //redis配置(默认配置就好，一般都不用改)
  redis: {
    host: "127.0.0.1", //redis地址
    port: 6379,        //redis端口
    password: "",      //redis密码，没有密码可以为空
    db: 0,             //redis数据库
  },

  //米游社cookies，支持多个，用逗号隔开
  //访问米游社原神社区(https://bbs.mihoyo.com/ys/)，登录后账户点击 F12 ，
  //选中 Console 或控制台，点击控制台粘贴这一句
  //
  // document.cookie.match(/ltoken[^;]+;[^;]+;/)[0] ，回车即可获取
  //
  //例如'ltoken=***;ltuid=***;'
  //cookie逻辑：一个号一天只能查30个uid（包括查询失败的），在没超过30的时候，之前查过的uid可以重复查询
  //所有项目限制一个cookie只能查27个，避免超出限制，查询过的可以重复查
  //
  mysCookies: [
    // 'ltoken=***;ltuid=***;',
    // 'ltoken=***;ltuid=***;',
    
  ],

  //群设置
  group: {
    //通用默认配置
    'default': {
      gachaDayNum: 1, //每天抽卡次数，限制次数，防止刷屏,4点重置
      //米游社信息查询
      mysDayLimit: 20, //每天查询次数
      mysUidLimit: 5, //每天查询uid个数

      groupCD:  500,     //群聊中所有指令操作冷却时间，单位毫秒,0则无限制
      singleCD: 2000, //群聊中个人操作冷却时间，单位毫秒

      disable: [], //禁用功能 'gacha','mysInfo','gachaLog','face','other'
    },

    //每个群的单独配置(用于覆盖通用配置)
    // 'q群号':{
    //   //米游社信息查询
    //   mysDayLimit: 5, //每天查询次数
    //   mysUidLimit: 3, //每天查询uid个数
    // }
  },

  //原神体力查询（#体力），配置了才能查
  dailyNote: {
    'qq号': { uid: "", cookie: "" },
  },
};

export { config };
