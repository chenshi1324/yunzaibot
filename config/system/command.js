//2.0.0版本已废弃
let command = {
  gacha: {
    gacha:"^#*([1-9]+0|[武器]*[一二两三四五六七八九十百]+|抽|单)[连抽卡奖][12武器]*$",
    weaponBing:"^#*定轨$",
  },
  mysInfo: {
    role: "^#(角色2|宝箱|成就|尘歌壶|家园|探索|探险|声望|探险度|探索度)[ |0-9]*$",
    roleCard: "^(#*角色3|#*角色卡片|角色)$",
    roleAll: "(^#(角色|查询|查询角色|角色查询|人物)[ |0-9]*$)|(^(#*uid|#*UID)\\+*[1|2|5][0-9]{8}$)|(^#[\\+|＋]*[1|2|5][0-9]{8})",
    abyssFloor: "^#[上期|往期|本期]*(深渊|深境|深境螺旋)[上期]*[第]*(9|10|11|12|九|十|十一|十二)层[ |0-9]*$",
    abyss: "^#[上期|本期]*(深渊|深境|深境螺旋)[上期]*[ |0-9]*$",
    weapon: "^#[五星|四星|5星|4星]*武器$",
    life: "^#(五星|四星|5星|4星|命座|角色|武器)[命座|角色]*[信息|阵容]*[ |0-9]*$",
    wife: "^#(老婆|妻子|媳妇|娘子|女朋友|女友|女神|老公|丈夫|夫君|郎君|男朋友|男友|男神|女儿|儿子)(1|2)*$",
    character2: "^#*(.*)卡片|^#(.*)2$",
    character: "^#(.*)$",
    checkCookie: "^#*检查(ck|cookie)$",
    setCookie: "^#*配置(.*)$",
    todayQuery: "^#(今日素材|素材|今日材料|材料)[角色]*[信息]*[ |0-9]*$",
  },
  dailyNote:{
    dailyNote: "^#*(体力|树脂|查询体力)$",
    bingCookie: "noCheck",
    delCookie: "^#*(删除(C|c)ookie|开启推送|关闭推送)$",
    resinhelp: "^#*(体力|树脂|cookie)(帮助|说明|功能)$",
  },
  gachaLog:{
    bing:"(.*)authkey_ver(.*)",
    bingFile:"noCheck",
    getLog:"^#*(抽卡|抽奖|角色|武器|常驻|up)池*(记录|祈愿|分析)$",
    help:"^#*(记录帮助|抽卡帮助)$",
    helpPort:"^#*(安卓|苹果|电脑)帮助$",
  },
  other: {
    help: "^#*(命令|帮助|菜单|help|说明|功能|指令|使用说明)$",
    repeat: "noCheck",//复读
  },
  //表情
  face: {
    get: "noCheck",
    add: "noCheck",
    addContext: "noCheck",
    del: "^#*删除(.*)$",
    list: "^#*表情列表[0-9]*$",
    listFuzzy: "^#*表情(.*)$",
    random: "noCheck",   //斗图
  },
  ai:{
    tencentAI:"noCheck",
  }
};
export { command };
