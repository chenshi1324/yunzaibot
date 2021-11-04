import fetch from "node-fetch";
import md5 from "md5";
import { roleId, wifeData } from "../../config/genshin/roleId.js";
import { config } from "../../config/config.js";
import { render } from "../render.js";

//#角色
async function role(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  res = await mysApi(e, uid, "index");

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  limitSet(e);

  res = res.data;

  let rarity5 = -1;
  let constellation6 = 0;
  for (let val of res.avatars) {
    if (val.rarity >= 5) {
      rarity5++;
    }
    if (val.name != "旅行者" && val.actived_constellation_num >= 6) {
      constellation6++;
    }
  }

  let stats = res.stats;
  let line = [
    [
      { lable: "角色数", num: stats.avatar_number },
      { lable: "五星角色", num: rarity5 },
      { lable: "满命角色", num: constellation6 },
      { lable: "深境螺旋", num: stats.spiral_abyss },
    ],
    [
      { lable: "成就", num: stats.achievement_number },
      {
        lable: "总宝箱",
        num:
          stats.precious_chest_number +
          stats.luxurious_chest_number +
          stats.exquisite_chest_number +
          stats.common_chest_number,
      },
      { lable: "华丽宝箱", num: stats.luxurious_chest_number },
      { lable: "珍贵宝箱", num: stats.precious_chest_number },
    ],
  ];
  //尘歌壶
  if (res.homes && res.homes.length > 0) {
    line.push([
      { lable: "家园等级", num: res.homes[0].level },
      { lable: "最高仙力", num: res.homes[0].comfort_num },
      { lable: "获得摆设", num: res.homes[0].item_num },
      { lable: "历史访客", num: res.homes[0].visit_num },
    ]);
  }
  let explor = [];
  for (let val of res.world_explorations) {
    if (val.name == "龙脊雪山") {
      val.name = "雪山";
    }

    let offerings = "";
    if (val.offerings[0]) {
      offerings = {
        name: val.offerings[0].name,
        level: val.offerings[0].level,
      };
    }

    explor.push({
      name: val.name,
      level: val.level,
      exploration_percentage: val.exploration_percentage / 10,
      offerings: offerings,
    });
  }

  let base64 = await render("genshin", "role", {
    save_id: uid,
    uid: uid,
    activeDay: stats.active_day_number,
    line,
    explor,
  });

  if (base64) {
    e.reply(`[CQ:image,file=base64://${base64}]`);
  }

  return true; //事件结束不再往下
}

//#深境
async function abyss(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  //调角色数据接口刷新深渊数据
  let role = await mysApi(e, uid, "index");
  if (checkRetcode(role, uid, e)) {
    return true;
  }

  limitSet(e);

  role = role.data;

  let roleArr = [];

  for (let val of role.avatars) {
    roleArr[val.id] = val;
  }

  let schedule_type = 1;
  if (e.msg.includes("上期")) {
    schedule_type = 2;
  }

  res = await mysApi(e, uid, "spiralAbyss", { schedule_type });
  if (checkRetcode(res, uid, e)) {
    return true;
  } else {
    res = res.data;
  }

  if (res.total_battle_times <= 0) {
    e.reply("暂无挑战数据。");
    return true;
  }
  if (!res.damage_rank || res.damage_rank.length <= 0) {
    e.reply("数据没更新，请稍后再试");
    return true;
  }

  let start_time = new Date(res.start_time * 1000);
  let time = start_time.getMonth() + 1;
  if (start_time.getDate() >= 15) {
    time = time + "月下";
  } else {
    time = time + "月上";
  }

  let total_star = 0;
  let star = [];
  for (let val of res.floors) {
    if (val.index < 9) {
      continue;
    }
    total_star += val.star;
    star.push(val.star);
  }
  total_star = total_star + "（" + star.join("-") + "）";

  let list = [];
  for (let i in res.reveal_rank) {
    if (i >= 4) {
      break;
    }
    let val = res.reveal_rank[i];
    list.push({
      star: val.rarity,
      num: val.value,
      name: roleIdToName(val.avatar_id, true),
      life: roleArr[val.avatar_id].actived_constellation_num,
    });
  }

  let defeat = {
    num: res.defeat_rank[0].value,
    name: roleIdToName(res.defeat_rank[0].avatar_id, true),
  };
  let take_damage = {
    num: (res.take_damage_rank[0].value / 10000).toFixed(1),
    name: roleIdToName(res.take_damage_rank[0].avatar_id, true),
  };
  let damage = {
    num: (res.damage_rank[0].value / 10000).toFixed(1),
    name: roleIdToName(res.damage_rank[0].avatar_id, true),
  };
  let normal_skill = {
    num: res.normal_skill_rank[0].value,
    name: roleIdToName(res.normal_skill_rank[0].avatar_id, true),
  };
  let energy_skill = {
    num: res.energy_skill_rank[0].value,
    name: roleIdToName(res.energy_skill_rank[0].avatar_id, true),
  };

  let base64 = await render("genshin", "abyss", {
    save_id: uid,
    uid,
    time,
    max_floor: res.max_floor,
    total_star,
    list,
    total_battle_times: res.total_battle_times,
    defeat,
    take_damage,
    damage,
    normal_skill,
    energy_skill,
  });

  if (base64) {
    e.reply(`[CQ:image,file=base64://${base64}]`);
  }

  return true; //事件结束不再往下
}

//#命座
async function life(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  let type = 5; //五星
  if (/(.*)(四星|4星)(.*)/.test(e.msg)) {
    type = 4; //四星
  }

  res = await mysApi(e, uid, "index");

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  limitSet(e);

  res = res.data;

  let list = [];
  let lead = {}; //主角

  for (let val of res.avatars) {
    if ((type == 5 && val.rarity < 5) || (type == 4 && val.rarity > 4)) {
      continue;
    }

    if (val.id == 10000005 || val.id == 10000007) {
      if (val.id == 10000005) {
        val.name = "空";
      }
      if (val.id == 10000007) {
        val.name = "荧";
      }
      lead = val;
      continue;
    }

    val.sort = (val.actived_constellation_num + 1) * 100 + val.level;

    list.push(val);
  }

  list = list.sort(function (a, b) {
    return b.sort - a.sort;
  });

  if (type == 5) {
    //旅行者放到最后
    list.push(lead);
  }

  let base64 = await render("genshin", "life", {
    save_id: uid,
    uid: uid,
    num: list.length,
    type,
    list,
  });

  if (base64) {
    e.reply(`[CQ:image,file=base64://${base64}]`);
  }

  return true; //事件结束不再往下
}

//#武器
async function weapon(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  res = await mysApi(e, uid, "index");

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  res = res.data;

  let ids = [];
  let avatars = res.avatars;
  for (let val of avatars) {
    ids.push(val.id);
  }

  res = await mysApi(e, uid, "character", {
    character_ids: ids,
    role_id: uid,
    server: getServer(uid),
  });
  if (checkRetcode(res, uid, e)) {
    return true;
  } else {
    res = res.data.avatars;
  }

  limitSet(e);

  let weapon = [];
  for (let val of res) {
    if (val.weapon.rarity <= 1) {
      continue;
    }
    if (val.id == 10000005) {
      val.name = "空";
    }
    if (val.id == 10000007) {
      val.name = "荧";
    }
    if (val.rarity > 5) {
      val.rarity = 5;
    }
    let sort = 0;
    sort += val.weapon.rarity * 1000000;
    sort += val.weapon.affix_level * 100000;
    sort += val.weapon.level * 1000;
    sort += val.rarity * 100;
    sort += val.level;

    weapon.push({
      role_name: val.name,
      role_level: val.level,
      role_rarity: val.rarity,
      name: val.weapon.name,
      rarity: val.weapon.rarity,
      level: val.weapon.level,
      affix_level: val.weapon.affix_level,
      sort,
    });
  }

  weapon = weapon.sort(function (a, b) {
    return b.sort - a.sort;
  });
  weapon = weapon.slice(0, 21);

  let base64 = await render("genshin", "weapon", {
    save_id: uid,
    uid: uid,
    list: weapon,
  });

  if (base64) {
    e.reply(`[CQ:image,file=base64://${base64}]`);
  }

  return true; //事件结束不再往下
}

//#神里
async function character(e) {
  e.msg = e.msg.replace(/#/, "");
  let roleId = roleIdToName(e.msg);

  if (!roleId) return false;

  let uidRes = await getUid(e);

  if (!uidRes.uid && uidRes.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = uidRes.uid;

  //主角特殊处理
  if (roleId == "20000000") {
    let res = await mysApi(e, uid, "index");

    if (checkRetcode(res, uid, e)) {
      return true;
    }

    for (let val of res.data.avatars) {
      if (val.id == "10000005") {
        roleId = "10000005";
        break;
      }
      if (val.id == "10000007") {
        roleId = "10000007";
        break;
      }
    }
  }

  let res = await mysApi(e, uid, "character", {
    character_ids: [roleId],
    role_id: uid,
    server: getServer(uid),
  });

  if (res.retcode == "-1") {
    if (uidRes.isSelf) {
      let msg = Substr(e.sender.card, 13);
      let rand_face = [5, 9, 34, 35, 36, 37];
      rand_face = rand_face[Math.floor(Math.random() * rand_face.length)];
      msg += `\n没有${e.msg}[CQ:face,id=${rand_face}]`;
      e.reply(msg);
      return true;
    } else {
      e.reply(`ID:${uid}没有${e.msg}`);
    }
  }

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  limitSet(e);

  let avatars = res.data.avatars[0];

  let base64 = await render("genshin", "character", {
    save_id: uid,
    uid: uid,
    ...get_character(avatars),
  });

  if (base64) {
    e.reply(`[CQ:image,file=base64://${base64}]`);
  }

  return true; //事件结束不再往下
}

//#老婆
async function wife(e) {
  let uidRes = await getUid(e);

  if (!uidRes.uid && uidRes.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  e.msg = e.msg.replace("#", "");

  let i = 0;
  if (["老婆", "媳妇", "妻子", "娘子", "女朋友"].includes(e.msg)) {
    i = 0;
  } else if (["老公", "丈夫", "夫君", "郎君", "男朋友"].includes(e.msg)) {
    i = 1;
  } else if (["女儿"].includes(e.msg)) {
    i = 2;
  } else {
    return true;
  }

  let uid = uidRes.uid;

  let res = await mysApi(e, uid, "index");

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  res = res.data;

  let ids = [];
  let avatars = res.avatars;
  for (let val of avatars) {
    ids.push(val.id);
  }

  res = await mysApi(e, uid, "character", {
    character_ids: ids,
    role_id: uid,
    server: getServer(uid),
  });

  if (checkRetcode(res, uid, e)) {
    return true;
  } else {
    res = res.data.avatars;
  }

  limitSet(e);

  let list = [];

  for (let val of res) {
    if (!wifeData[i].includes(val.name)) {
      continue;
    }
    if (val.rarity > 5) {
      val.rarity = 5;
    }

    //等级+好感*10+命座*5+五星*20
    val.sort =
      val.level +
      val.fetter * 10 +
      val.actived_constellation_num *
        5 *
        (val.rarity - 3) *
        +(val.rarity - 4) *
        20;

    //超过80级的每级*5
    if (val.level > 80) {
      val.sort += (val.level - 80) * 5;
    }

    //武器 等级+五星*25+精炼*5
    val.sort +=
      val.weapon.level +
      (val.weapon.rarity - 4) * 25 +
      val.weapon.affix_level * 5;

    //超过80级的每级*5
    if (val.weapon.level > 80) {
      val.sort += (val.weapon.level - 80) * 5;
    }

    //圣遗物等级
    for (let rel of val.reliquaries) {
      val.sort += rel.level;
    }

    list.push(val);
  }

  if (list.length <= 0) {
    if (uidRes.isSelf) {
      let msg = Substr(e.sender.card, 13);
      let rand_face = [5, 9, 34, 35, 36, 37];
      rand_face = rand_face[Math.floor(Math.random() * rand_face.length)];
      msg += `\n没有${e.msg}[CQ:face,id=${rand_face}]`;
      e.reply(msg);
      return true;
    } else {
      e.reply(`ID:${uid}没有${e.msg}`);
    }
  }

  list = list.sort(function (a, b) {
    return b.sort - a.sort;
  });

  let base64 = await render("genshin", "character", {
    save_id: uid,
    uid: uid,
    ...get_character(list[0]),
  });

  if (base64) {
    e.reply(`[CQ:image,file=base64://${base64}]`);
  }

  return true;
}

function get_character(avatars) {
  let list = [];
  let set = [];
  let text1 = "";
  let text2 = "";

  list[0] = {
    type: "weapon",
    name: avatars.weapon.name,
    level: avatars.weapon.level,
    affix_level: avatars.weapon.affix_level,
  };

  for (let val of avatars.reliquaries) {
    if (set[val.set.name]) {
      set[val.set.name]++;

      if (set[val.set.name] == 2) {
        if (text1) {
          text2 = "2件套：" + val.set.affixes[0].effect;
        } else {
          text1 = "2件套：" + val.set.affixes[0].effect;
        }
      }

      if (set[val.set.name] == 4) {
        text2 = "4件套：" + val.set.affixes[1].effect;
      }
    } else {
      set[val.set.name] = 1;
    }

    list.push({
      type: "reliquaries",
      name: val.name,
      level: val.level,
    });
  }

  if (avatars.reliquaries.length >= 2 && !text1) {
    text1 = "无套装效果";
  }

  if (avatars.name == "珊瑚宫心海") {
    avatars.name = "心海";
  }

  return {
    name: avatars.name,
    level: avatars.level,
    fetter: avatars.fetter,
    actived_constellation_num: avatars.actived_constellation_num,
    list,
    text1,
    text2,
  };
}

//获取uid
async function getUid(e) {
  //从消息中获取
  let reg = /[1|2|5][0-9]{8}/;
  let res = e.msg.match(reg);
  if (res) {
    return { isSelf: false, uid: res[0] };
  }

  //从群昵称获取
  res = e.sender.card.match(reg);

  if (res) {
    //redis保存uid
    await redis.set(`genshin:uid:${e.user_id}`, res[0]);

    return { isSelf: true, uid: res[0] };
  }

  //从redis获取
  res = await redis.get(`genshin:uid:${e.user_id}`);
  if (res) {
    return { isSelf: true, uid: res };
  }

  return { isSelf: true, uid: false };
}

async function mysApi(e, uid, type, data = {}) {
  let now = new Date();
  let dayEnd = getDayEnd();

  //获取uid集合
  let uid_arr = await redis.get(`genshin:ds:qq:${e.user_id}`);
  if (uid_arr) {
    uid_arr = JSON.parse(uid_arr);
    if (!uid_arr.includes(uid)) {
      uid_arr.push(uid);
    }
  } else {
    uid_arr = [uid];
  }

  if (uid_arr.length > e.groupConfig.mysUidLimit) {
    return { retcode: -200 };
  }

  await redis.set(`genshin:ds:qq:${e.user_id}`, JSON.stringify(uid_arr), {
    EX: dayEnd,
  });

  let index = await redis.get(`genshin:ds:uid:${uid}`);
  let isNew = false;

  if (!index) {
    //获取没有到30次的index
    for (let i in config.mysCookies) {
      var count = await redis.sendCommand(["scard", `genshin:ds:index:${i}`]);
      if (count < 27) {
        index = i;
        break;
      }
    }
    //查询已达上限
    if (!index) {
      return { retcode: -100 };
    }
    isNew = true;
  }
  if (!config.mysCookies[index]) {
    return false;
  }

  let { url, query, body } = getUrl(type, uid, data);
  let headers = {
    "x-rpc-app_version": "2.12.1",
    "x-rpc-client_type": 5,
    DS: getDs(query, body),
    Cookie: config.mysCookies[index],
  };

  let param = {};
  if (body) {
    param = { method: "post", body, headers };
  } else {
    param = { method: "get", headers };
  }
  const response = await fetch(url, param);
  const res = await response.json();

  if (!res) {
    return false;
  }
  if (isNew) {
    await redis.sendCommand(["sadd", `genshin:ds:index:${index}`, uid]);
    redis.expire(`genshin:ds:index:${index}`, dayEnd);
    redis.set(`genshin:ds:uid:${uid}`, index, { EX: dayEnd });
  }
  return res;
}

function getUrl(type, uid, data = {}) {
  let server = getServer(uid);
  let query = "";
  let body = "";
  switch (type) {
    //首页宝箱
    case "index":
      query = `role_id=${uid}&server=${server}`;
      break;
    //深渊
    case "spiralAbyss":
      query = `role_id=${uid}&schedule_type=${data.schedule_type}&server=${server}`;
      break;
    //角色详情
    case "character":
      body = JSON.stringify(data);
    //树脂每日任务（只能当前id）
    case "dailyNote":
      query = `role_id=${uid}&server=${server}`;
      break;
  }

  let host = "https://api-takumi.mihoyo.com/game_record/app/genshin/api/";
  let url = host + type + "?" + query;

  return { url, query, body };
}

function getServer(uid) {
  switch (uid[0]) {
    case "1":
    case "2":
      return "cn_gf01"; //官服
    case "5":
      return "cn_qd01"; //B服
  }
}

//# Github-@lulu666lulu
function getDs(q = "", b = "") {
  let n = "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs";
  let t = Math.round(new Date().getTime() / 1000);
  let r = Math.floor(Math.random() * 900000 + 100000);
  let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`);
  return `${t},${r},${DS}`;
}

function checkRetcode(res, uid, e) {
  switch (res.retcode) {
    case 0:
      return false;
    case -1:
      break;
    case -100:
      e.reply("无法查询，已达上限");
      break;
    case -200:
      e.reply("查询已达今日上限");
      break;
    case 1001:
    case -10001:
      e.reply("米游社接口报错，暂时无法查询");
      break;
    case 1008:
      e.reply(`uid:${uid}错误`);
      break;
    case 10102:
      if (res.message == "Data is not public for the user") {
        e.reply(`uid:${uid}米游社数据未公开`);
      } else {
        e.reply(`uid:${uid}请先去米游社绑定角色`);
      }
      break;
    case 10103:
    case -10103:
      e.reply(`uid:${uid}请先去米游社绑定角色`);
      break;
  }

  return true;
}

function roleIdToName(keyword, search_val = false) {
  if (search_val) {
    return roleId[keyword][0] ? roleId[keyword][0] : "";
  }
  for (let i in roleId) {
    if (roleId[i].includes(keyword)) {
      return i;
    }
  }
  return "";
}

async function limitGet(e) {
  if (!e.isGroup) {
    return true;
  }

  let key = `genshin:limit:${e.user_id}`;
  let num = await redis.get(key);

  if (num && num >= e.groupConfig.mysDayLimit - 1) {
    e.reply("今日查询已达上限");
    return false;
  }

  return true;
}

async function limitSet(e) {
  if (!e.isGroup) {
    return true;
  }

  let key = `genshin:limit:${e.user_id}`;
  let dayEnd = getDayEnd();

  await redis.incr(key);
  await redis.expire(key, dayEnd);
}

function getDayEnd() {
  let now = new Date();
  let dayEnd =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      "23",
      "59",
      "59"
    ).getTime() / 1000;

  return dayEnd - parseInt(now.getTime() / 1000);
}

//切割中文字符
function Substr(str, n) {
  //字符串截取 包含对中文处理
  if (str.replace(/[\u4e00-\u9fa5]/g, "**").length <= n) {
    return str;
  } else {
    var len = 0;
    var tmpStr = "";
    for (var i = 0; i < str.length; i++) {
      //遍历字符串
      if (/[\u4e00-\u9fa5]/.test(str[i])) {
        //中文 长度为两字节
        len += 2;
      } else {
        len += 1;
      }
      if (len > n) {
        break;
      } else {
        tmpStr += str[i];
      }
    }
    return tmpStr;
  }
}

export { role, abyss, life, weapon, wife, character };
