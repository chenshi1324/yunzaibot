/**
 * 默认配置
 * 请复制一份重命名为config.js
 * 然后填写配置信息，支持热更新
 */
let config = {
  //qq账号 密码
  account: {
    qq:  "",  //账号
    pwd: "",  //密码，可为空则用扫码登录
    log_level:"info",//日志等级:trace,debug,info,warn,error,fatal,mark,off
    platform:5,      //1:安卓手机、 2:aPad 、 3:安卓手表、 4:MacOS 、 5:iPad
  },

  //redis配置(默认配置就好，一般都不用改)
  redis: {
    host: "127.0.0.1", //redis地址
    port: 6379,        //redis端口
    password: "",      //redis密码，没有密码可以为空
    db: 0,             //redis数据库
  },

  /**
   * 米游社cookies，支持多个，用逗号隔开
   * 访问米游社原神社区(https://bbs.mihoyo.com/ys/)，登录后账户点击 F12 ，
   * 选中 Console 或控制台，点击控制台粘贴这一句
   * document.cookie.match(/ltoken([^;]+;){2}/)[0] ，回车即可获取
   * 例如'ltoken=***;ltuid=***;'
   * cookie逻辑：一个号一天只能查30个uid（包括查询失败的），在没超过30的时候，之前查过的uid可以重复查询
   * 所以项目限制一个cookie只能查27个，避免超出限制，查询过的可以重复查
   */
  mysCookies: [
    // 'ltoken=***;ltuid=***;',
    // 'ltoken=***;ltuid=***;',
  ],

  //群设置
  group: {
    //通用默认配置
    'default': {
      delMsg: 0,       //隔多少毫秒后撤回消息（十连），0不撤回
      gachaDayNum: 1,  //每天抽卡次数，限制次数，防止刷屏,4点重置
      
      //米游社信息查询
      mysDayLimit: 30,  //每天每人查询次数
      mysUidLimit: 5,   //每天每人查询uid个数

      groupCD:  500,    //群聊中所有指令操作冷却时间，单位毫秒,0则无限制
      singleCD: 2000,   //群聊中个人操作冷却时间，单位毫秒
      PokeCD:   10000,  //群聊中戳一戳冷却时间，单位毫秒

      imgAddLimit:false, //添加表情是否限制  false-所有群员都可以添加 true-群管理员才能添加
      imgMaxSize:1,      //添加表情图片大小限制，默认1m

      imgRate:5,         //随机表情回复概率0-100 需要配置百度ocr 配置往下滚

      //禁用功能 
      //'poke','gacha','mysInfo','gachaLog','dailyNote','face','other',
      // 戳一戳，十连，原神查询，抽卡记录，体力，添加表情，其他，
      disable: [],
    },

    //每个群的单独配置(用于覆盖通用配置)
    // 'q群号':{
    //   //米游社信息查询
    //   mysDayLimit: 15, //每天每人查询次数
    //   mysUidLimit: 3,  //每天每人查询uid个数
    //   groupCD:  1000,  //群聊中所有指令操作冷却时间，单位毫秒,0则无限制
    //   singleCD: 2000,  //群聊中个人操作冷却时间，单位毫秒
    // }
  },

  //黑名单qq
  balckQQ:[2854196310,],

  //百度ocr https://ai.baidu.com/ai-doc/OCR/dk3iqnq51
  //智障斗图用
  BaiduOcr:{
    APP_ID: "",
    API_KEY: "",
    SECRET_KEY: "",
  },
};

export { config };
