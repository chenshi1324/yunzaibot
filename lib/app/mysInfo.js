import fetch from "node-fetch";
import { segment } from "oicq";
import { roleId, wifeData, roleId5, roleId4, actWeapon, abbr } from "../../config/genshin/roleId.js";
import { render } from "../render.js";
import lodash from "lodash";
import { element } from "../../config/genshin/element.js";
import fs from "fs";
import { getUrl, getDs, getServer } from "./mysApi.js";

let nameID = "";

//#角色
async function roleAll(e) {
  e.msg = e.msg.replace(/#角色/g, "");
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请先发送#+你游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  let resInex = mysApi(e, uid, "index");
  let resAbyss = mysApi(e, uid, "spiralAbyss", { schedule_type: 1 });
  let resDetail = mysApi(e, uid, "character", { role_id: uid, server: getServer(uid) });

  try {
    [resInex, resAbyss, resDetail] = await Promise.all([resInex, resAbyss, resDetail]);
  } catch (error) {
    checkRetcode(error, uid, e);
    return true;
  }

  if (checkRetcode(resInex, uid, e)) {
    return true;
  }
  if (checkRetcode(resDetail, uid, e)) {
    return true;
  }
  res = resInex.data;
  resDetail = resDetail.data;

  limitSet(e);

  let avatars = resDetail.avatars;
  let roleArr = avatars;

  for (let i in avatars) {
    let rarity = avatars[i].rarity;
    let actived_constellation_num = avatars[i].actived_constellation_num;
    let level = avatars[i].level;
    let id = avatars[i].id - 10000000;

    if (rarity >= 5) {
      rarity = 5;
    }
    //埃洛伊排到最后
    if (rarity > 5) {
      id = 0;
    }
    //增加神里排序
    if (avatars[i].id == 10000002) {
      id = 50;
    }

    if (avatars[i].id == 10000005) {
      avatars[i].name = "空";
      actived_constellation_num = 0;
      level = 0;
    } else if (avatars[i].id == 10000007) {
      avatars[i].name = "荧";
      actived_constellation_num = 0;
      level = 0;
    }
    avatars[i].sortLevel = level;
    //id倒序，最新出的角色拍前面
    avatars[i].sort = rarity * 100000 + actived_constellation_num * 10000 + level * 100 + id;

    avatars[i].weapon.showName = abbr[avatars[i].weapon.name] ? abbr[avatars[i].weapon.name] : avatars[i].weapon.name;
  }

  let stats = res.stats;
  let line = [
    [
      { lable: "成就", num: stats.achievement_number },
      { lable: "角色数", num: stats.avatar_number },
      {
        lable: "总宝箱",
        num:
          stats.precious_chest_number +
          stats.luxurious_chest_number +
          stats.exquisite_chest_number +
          stats.common_chest_number +
          stats.magic_chest_number,
      },
      { lable: "深境螺旋", num: stats.spiral_abyss },
    ],
    [
      { lable: "华丽宝箱", num: stats.luxurious_chest_number },
      { lable: "珍贵宝箱", num: stats.precious_chest_number },
      { lable: "精致宝箱", num: stats.exquisite_chest_number },
      { lable: "普通宝箱", num: stats.common_chest_number },
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

    if (val.name == "渊下宫" && val.exploration_percentage <= 0) {
      continue;
    }

    explor.push({ lable: val.name, num: `${val.exploration_percentage / 10}%` });
  }
  line.push(explor);

  if (avatars.length > 0) {
    //重新排序
    avatars = lodash.chain(avatars).orderBy(["sortLevel"], ["desc"]).slice(0, 12).orderBy(["sort"], ["desc"]).value();
  }
  //深渊
  let abyss = await abyssAll(e, uid, roleArr, resAbyss);

  let base64 = await render("genshin", "roleAll", {
    save_id: uid,
    uid: uid,
    activeDay: dayCount(stats.active_day_number),
    line,
    avatars,
    abyss,
    bg: lodash.random(1, 5),
  });

  if (base64) {
    let msg = [];

    if (e.isGroup) {
      let name = lodash.truncate(e.sender.card, { length: 8 });
      msg.push(segment.at(e.user_id, name));
    }
    msg.push(segment.image(`base64://${base64}`));

    e.reply(msg);
  }

  return true; //事件结束不再往下
}

//处理深渊数据
async function abyssAll(e, uid, roleArr, resAbyss) {
  let abyss = {};

  if (checkRetcode(resAbyss, uid, e)) {
    return abyss;
  } else {
    resAbyss = resAbyss.data;
  }
  if (roleArr.length <= 0) {
    return abyss;
  }
  if (resAbyss.total_battle_times <= 0) {
    return abyss;
  }
  if (resAbyss.reveal_rank.length <= 0) {
    return abyss;
  }
  //打了三层才放出来
  if (resAbyss.floors.length <= 2) {
    return abyss;
  }
  let start_time = new Date(resAbyss.start_time * 1000);
  let time = start_time.getMonth() + 1;
  if (start_time.getDate() >= 15) {
    time = time + "月下";
  } else {
    time = time + "月上";
  }

  let total_star = 0;
  let star = [];
  for (let val of resAbyss.floors) {
    if (val.index < 9) {
      continue;
    }
    total_star += val.star;
    star.push(val.star);
  }
  total_star = total_star + "（" + star.join("-") + "）";

  let dataName = ["damage", "take_damage", "defeat", "normal_skill", "energy_skill"];
  let data = [];
  let tmpRole = [];
  for (let val of dataName) {
    data[val] = {
      num: resAbyss[`${val}_rank`][0].value,
      name: roleIdToName(resAbyss[`${val}_rank`][0].avatar_id, true),
    };

    if (data[val].num > 1000) {
      data[val].num = (data[val].num / 10000).toFixed(1);
      data[val].num += " w";
    }

    if (tmpRole.length < 4 && !tmpRole.includes(resAbyss[`${val}_rank`][0].avatar_id)) {
      tmpRole.push(resAbyss[`${val}_rank`][0].avatar_id);
    }
  }

  let list = [];

  let avatar = lodash.keyBy(roleArr, "id");

  for (let val of resAbyss.reveal_rank) {
    if (avatar[val.avatar_id]) {
      val.life = avatar[val.avatar_id].actived_constellation_num;
    } else {
      val.life = 0;
    }
    val.name = roleIdToName(val.avatar_id, true);
    list.push(val);
  }

  return {
    time,
    max_floor: resAbyss.max_floor,
    total_star,
    list,
    total_battle_times: resAbyss.total_battle_times,
    ...data,
  };
}

//#角色2
async function role(e) {
  e.msg = e.msg.replace(/#角色2/g, "");
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请先发送#+你游戏的uid");
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

  let stats = res.stats;
  let line = [
    [
      { lable: "成就", num: stats.achievement_number },
      { lable: "角色数", num: stats.avatar_number },
      {
        lable: "总宝箱",
        num:
          stats.precious_chest_number +
          stats.luxurious_chest_number +
          stats.exquisite_chest_number +
          stats.common_chest_number +
          stats.magic_chest_number,
      },
      { lable: "深境螺旋", num: stats.spiral_abyss },
    ],
    [
      { lable: "华丽宝箱", num: stats.luxurious_chest_number },
      { lable: "珍贵宝箱", num: stats.precious_chest_number },
      { lable: "精致宝箱", num: stats.exquisite_chest_number },
      { lable: "普通宝箱", num: stats.common_chest_number },
    ],
    [
      { lable: "风神瞳", num: stats.anemoculus_number },
      { lable: "岩神瞳", num: stats.geoculus_number },
      { lable: "雷神瞳", num: stats.electroculus_number },
      { lable: "传送点", num: stats.way_point_number },
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
    activeDay: dayCount(stats.active_day_number),
    line,
    explor,
    bg: lodash.random(1, 4),
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true; //事件结束不再往下
}

//#深境
async function abyss(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请先发送#+你游戏的uid");
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
    e.reply("数据还没更新，请稍后再试");
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

  let dataName = ["damage", "take_damage", "defeat", "normal_skill", "energy_skill"];
  let data = [];

  for (let val of dataName) {
    data[val] = {
      num: res[`${val}_rank`][0].value,
      name: roleIdToName(res[`${val}_rank`][0].avatar_id, true),
    };

    if (data[val].num > 1000) {
      data[val].num = (data[val].num / 10000).toFixed(1);
      data[val].num += " w";
    }
  }

  for (let i in res.reveal_rank) {
    res.reveal_rank[i].name = roleIdToName(res.reveal_rank[i].avatar_id, true);
  }

  let base64 = await render("genshin", "abyss", {
    save_id: uid,
    uid,
    time,
    max_floor: res.max_floor,
    total_star,
    list: res.reveal_rank,
    total_battle_times: res.total_battle_times,
    ...data,
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true; //事件结束不再往下
}

//#深渊十二层
async function abyssFloor(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请先发送#+你游戏的uid");
    return true;
  }

  // if (!(await limitGet(e))) return true;

  let uid = res.uid;

  //调角色数据接口刷新深渊数据
  let role = await mysApi(e, uid, "index");
  if (checkRetcode(role, uid, e)) {
    return true;
  }

  // limitSet(e);

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
    res = res.data.floors;
  }

  let floor = {};
  for (let val of res) {
    floor[val.index] = val;
  }

  //从消息中获取
  let reg = /^#[上期]*(深渊|深境|深境螺旋)[上期]*[第]*(9|10|11|12|九|十|十一|十二)层[ |0-9]*$/;
  let floorIndex = e.msg.match(reg);

  if (!floorIndex) {
    return true;
  }
  floorIndex = floorIndex[2];

  switch (floorIndex) {
    case "9":
    case "九":
      floor = floor["9"];
      floorIndex = 9;
      break;
    case "10":
    case "十":
      floor = floor["10"];
      floorIndex = 10;
      break;
    case "11":
    case "十一":
      floor = floor["11"];
      floorIndex = 11;
      break;
    case "12":
    case "十二":
      floor = floor["12"];
      floorIndex = 12;
      break;
    default:
      floor = "";
      break;
  }

  if (!floor) {
    e.reply(`暂无第${floorIndex}层数据`);
    return true;
  }

  let list = [];
  for (let val of floor.levels) {
    if (!val.battles || val.battles.length < 2) {
      continue;
    }
    val.time = new Date(val.battles[0].timestamp * 1000).Format("yyyy-MM-dd HH:mm:ss");

    for (let i in val.battles) {
      for (let j in val.battles[i].avatars) {
        val.battles[i].avatars[j].name = roleArr[val.battles[i].avatars[j].id].name;
        val.battles[i].avatars[j].life = roleArr[val.battles[i].avatars[j].id].actived_constellation_num;
      }
    }
    list.push(val);
  }

  let base64 = await render("genshin", "abyssFloor", {
    save_id: uid,
    uid: uid,
    floorIndex,
    floor,
    list,
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true;
}

//#命座
async function life(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请先发送#+你游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  res = await mysApi(e, uid, "character", {
    role_id: uid,
    server: getServer(uid),
  });

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  limitSet(e);

  let avatars = res.data.avatars;

  if (avatars.length <= 0) {
    return true;
  }

  let type; //五星
  if (avatars.length > 8) {
    type = 5;
    if (/(.*)(四星|4星)(.*)/.test(e.msg)) {
      type = 4; //四星
    }
  }

  let list = [];

  for (let val of avatars) {
    let rarity = val.rarity;
    if (val.rarity > 5) {
      rarity = 5;
    }

    if (type && rarity != type) {
      continue;
    }

    val.sort = rarity * 100000 + val.actived_constellation_num * 10000 + val.level * 100 + (val.id - 10000000);

    //增加神里排序
    if (val.id == 10000002) {
      val.sort += 50;
    }

    if (val.rarity > 5) {
      val.sort = val.sort - (val.id - 10000000);
    }
    val.sortLevel = val.level;

    val.weapon.showName = abbr[val.weapon.name] ? abbr[val.weapon.name] : val.weapon.name;

    if (val.id == 10000005) {
      val.name = "空";
      val.sort = 0;
    }
    if (val.id == 10000007) {
      val.sort = 0;
    }

    list.push(val);
  }

  list = lodash.chain(list).orderBy(["sortLevel"], ["desc"]).slice(0, 18).orderBy(["sort"], ["desc"]).value();

  let num = list.length;

  let base64 = await render("genshin", "life", {
    save_id: uid,
    uid: uid,
    num: num,
    list,
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true; //事件结束不再往下
}

//#武器
async function weapon(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请先发送#+你游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  res = await mysApi(e, uid, "character", {
    role_id: uid,
    server: getServer(uid),
  });

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  limitSet(e);

  let avatars = res.data.avatars;

  if (avatars.length <= 0) {
    return true;
  }

  let weapon = [];
  for (let val of avatars) {
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

    let firstSort = 0;
    firstSort += val.weapon.level;
    firstSort += (val.weapon.rarity - 4) * 20;
    if (val.weapon.level >= 20) {
      firstSort += val.level;
    }
    if (!actWeapon.includes(val.weapon.name)) {
      firstSort += val.weapon.affix_level * 5;
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
      showName: abbr[val.weapon.name] ? abbr[val.weapon.name] : val.weapon.name,
      rarity: val.weapon.rarity,
      level: val.weapon.level,
      affix_level: val.weapon.affix_level,
      firstSort,
      sort,
    });
  }

  //重新排序
  weapon = lodash.chain(weapon).orderBy(["firstSort"], ["desc"]).slice(0, 21).orderBy(["sort"], ["desc"]).value();

  let base64 = await render("genshin", "weapon", {
    save_id: uid,
    uid: uid,
    list: weapon,
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true; //事件结束不再往下
}

//#神里
async function character(e) {
  let roleId = roleIdToName(e.msg.replace(/#|老婆|老公|[1|2|5][0-9]{8}/g, "").trim());

  if (!roleId) return false;

  let uidRes = await getUid(e);

  if (!uidRes.uid && uidRes.isSelf) {
    e.reply("请先发送#+你游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = uidRes.uid;

  let res = await mysApi(e, uid, "character", {
    role_id: uid,
    server: getServer(uid),
  }).catch((err) => {
    Bot.logger.error(err);
    e.reply("未知错误");
  });

  if (res.retcode == "-1") {
    return true;
  }

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  let avatars = res.data.avatars;
  let length = avatars.length;

  avatars = lodash.keyBy(avatars, "id");

  if (roleId == 20000000) {
    if (avatars["10000005"]) {
      roleId = "10000005";
    }
    if (avatars["10000007"]) {
      roleId = "10000007";
    }
  }

  if (!avatars[roleId]) {
    let name = lodash.truncate(e.sender.card, { length: 8 });
    if (length > 8) {
      let rand_face = [5, 9, 34, 35, 36, 37];
      rand_face = rand_face[lodash.random(0, rand_face.length)];
      e.reply([segment.at(e.user_id, name), `\n没有${e.msg}`, segment.face(rand_face)]);
    } else {
      e.reply([segment.at(e.user_id, name), "\n尚未展示该角色，请先在米游社展示"]);
    }
    return true;
  }

  limitSet(e);

  avatars = avatars[roleId];

  let type = "character";

  let base64 = await render("genshin", type, {
    save_id: uid,
    uid: uid,
    element: element[avatars.name],
    ...get_character(avatars),
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true; //事件结束不再往下
}

//#老婆
async function wife(e) {
  let uidRes = await getUid(e);
  let isCard = false;
  if (!uidRes.uid && uidRes.isSelf) {
    e.reply("请先发送#+你游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  if (e.msg.includes("2")) {
    isCard = true;
  }

  e.msg = e.msg.replace(/#|\w/g, "");

  let i = 0;
  if (["老婆", "媳妇", "妻子", "娘子", "女朋友", "女友", "女神"].includes(e.msg)) {
    i = 0;
  } else if (["老公", "丈夫", "夫君", "郎君", "男朋友", "男友", "男神"].includes(e.msg)) {
    i = 1;
  } else if (["女儿"].includes(e.msg)) {
    i = 2;
  } else if (["儿子"].includes(e.msg)) {
    e.reply("暂无正太角色");
    return true;
  } else {
    return true;
  }

  let uid = uidRes.uid;

  let res = await mysApi(e, uid, "character", {
    role_id: uid,
    server: getServer(uid),
  });

  if (res.retcode == "-1") {
    return true;
  }

  if (checkRetcode(res, uid, e)) {
    return true;
  }

  let avatars = res.data.avatars;

  if (avatars.length <= 0) {
    return true;
  }

  let list = [];

  for (let val of avatars) {
    if (!wifeData[i].includes(Number(val.id))) {
      continue;
    }
    if (val.rarity > 5) {
      val.rarity = 5;
    }

    //等级+好感*10+命座*5+五星*20
    val.sort = val.level + val.fetter * 10 + val.actived_constellation_num * 5 * (val.rarity - 3) + (val.rarity - 4) * 20;

    //超过80级的每级*5
    if (val.level > 80) {
      val.sort += (val.level - 80) * 5;
    }

    //武器 等级+五星*25+精炼*5
    val.sort += val.weapon.level + (val.weapon.rarity - 4) * 25 + val.weapon.affix_level * 5;

    //武器超过80级的每级*5
    if (val.weapon.level > 80) {
      val.sort += (val.weapon.level - 80) * 5;
    }

    //圣遗物等级
    for (let rel of val.reliquaries) {
      val.sort += rel.level * 1.2;
    }

    list.push(val);
  }

  if (list.length <= 0) {
    return true;
  }

  limitSet(e);

  list = lodash.orderBy(list, ["sort"], ["desc"]);

  if (lodash.random(0, 100) <= 30 || isCard) {
    e.msg = `${list[0].name}卡片`;
    e.avatars = list;
    return false;
  }

  let base64 = await render("genshin", "character", {
    save_id: uid,
    uid: uid,
    element: element[list[0].name],
    ...get_character(list[0]),
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true;
}

//#神里2，#神里卡片
async function character2(e) {
  let roleName, id;
  if (!e.isPoke) {
    roleName = e.msg.replace(/#|\w|卡片/g, "").trim();
    id = roleIdToName(roleName);
    roleName = roleIdToName(id, true);
    if (!id) return false;
  }

  let uidRes = await getUid(e);

  if (!uidRes.uid && uidRes.isSelf) {
    if (!e.isPoke) {
      e.reply("请先发送#+你游戏的uid");
    }
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = uidRes.uid;
  let avatars;

  if (!e.avatars) {
    let res = await mysApi(e, uid, "character", {
      role_id: uid,
      server: getServer(uid),
    });

    if (res.retcode == "-1") {
      return true;
    }

    if (checkRetcode(res, uid, e)) {
      return true;
    }

    limitSet(e);

    avatars = res.data.avatars;
  } else {
    avatars = e.avatars;
  }

  avatars = lodash.keyBy(avatars, "id");

  if (e.isPoke) {
    avatars = lodash.sample(avatars);
    Bot.logger.mark(`[${e.group.name}] 戳一戳:${avatars.name}`);
  } else if (!avatars[id]) {
    return true;
  } else {
    avatars = avatars[id];
  }

  if (avatars.id == "10000005") {
    avatars.name = "空";
  } else if (avatars.id == "10000007") {
    avatars.name = "荧";
  }

  //随机获取背景图
  let path = `./resources/genshin/logo/bg2/${avatars.name}/`;
  if (!fs.existsSync(path)) {
    if (!e.isPoke) {
      e.reply(`暂无${roleName}素材`);
    }
    return true;
  }
  let randBg = fs.readdirSync(path);
  if (randBg.length <= 0) {
    if (!e.isPoke) {
      e.reply(`暂无${roleName}素材`);
    }
    return true;
  }

  let logKey = `genshin:randBg:${e.group_id}:${avatars.id}`;
  let old = await redis.get(logKey);
  if (old) {
    old = JSON.parse(old);
    let tmp = lodash.difference(randBg, old);
    if (tmp.length > 0) {
      randBg = tmp;
    } else {
      old = [];
    }
  } else {
    old = [];
  }

  randBg = lodash.sample(randBg);
  old.push(randBg);
  redis.set(logKey, JSON.stringify(old), { EX: 3600 * 4 });

  let base64 = await render(
    "genshin",
    "character2",
    {
      save_id: uid,
      uid: uid,
      element: element[avatars.name],
      randBg,
      ...get_character(avatars),
    },
    "png"
  );

  if (base64) {
    if (e.isPoke) {
      e.group.sendMsg([segment.at(e.user_id), segment.image(`base64://${base64}`)]);
    } else {
      e.reply(segment.image(`base64://${base64}`));
    }
  }

  return true; //事件结束不再往下
}

//戳一戳返回角色卡片
async function pokeCharacter(e) {
  e.msg = await redis.get(`genshin:uid:${e.operator_id}`);
  if (!e.msg) {
    return;
  }

  let key = `genshin:poke:${e.user_id}`;

  let num = await redis.get(key);
  if (num && num > 2) {
    if (!(await redis.get(`genshin:pokeTips:${e.group_id}`))) {
      e.reply([segment.at(e.user_id), "\n戳太快了，请慢点。。"]);
      redis.set(`genshin:pokeTips:${e.group_id}`, "1", { EX: 120 });
      return;
    }

    await redis.incr(key);
    redis.expire(key, 120);

    return;
  } else {
    await redis.incr(key);
    redis.expire(key, 120);
  }

  character2(e);

  return;
}

function get_character(avatars) {
  let list = [];
  let set = {};
  let setArr = [];
  let text1 = "";
  let text2 = "";
  let bg = 2;

  list[0] = {
    type: "weapon",
    name: avatars.weapon.name,
    showName: abbr[avatars.weapon.name] ? abbr[avatars.weapon.name] : avatars.weapon.name,
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
        text2 = "4件套：" + val.set.name;
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

  for (let val of Object.keys(set)) {
    setArr.push({
      name: val,
      num: set[val],
      showName: abbr[val] ? abbr[val] : val,
    });
  }

  if (avatars.reliquaries.length >= 2 && !text1) {
    text1 = "无套装效果";
  }

  if (avatars.id == "10000005") {
    avatars.name = "空";
  } else if (avatars.id == "10000007") {
    avatars.name = "荧";
  }

  //皮肤图片
  if (["芭芭拉", "琴", "刻晴", "凝光", "魈"].includes(avatars.name)) {
    if (avatars.level > 80 || avatars.fetter >= 8) {
      if (lodash.random(0, 100) > 50) {
        bg = 3;
      }
    }
  }

  return {
    name: avatars.name,
    showName: abbr[avatars.name] ? abbr[avatars.name] : avatars.name,
    level: avatars.level,
    fetter: avatars.fetter,
    actived_constellation_num: avatars.actived_constellation_num,
    list,
    text1,
    text2,
    bg,
    set: setArr,
  };
}

//获取uid
async function getUid(e) {
  let res;
  let reg = /[1|2|5][0-9]{8}/g;

  //从消息中获取
  if (e.msg) {
    res = e.msg.match(reg);
    if (res) {
      //redis保存uid
      redis.set(`genshin:uid:${e.user_id}`, res[0], { EX: 2592000 });
      return { isSelf: false, uid: res[0] };
    }
  }

  //从群昵称获取
  res = e.sender.card.toString().match(reg);

  if (res) {
    //redis保存uid
    redis.set(`genshin:uid:${e.user_id}`, res[0], { EX: 2592000 });

    return { isSelf: true, uid: res[0] };
  }

  //从redis获取
  res = await redis.get(`genshin:uid:${e.user_id}`);
  if (res) {
    redis.expire(`genshin:uid:${e.user_id}`, 2592000);
    return { isSelf: true, uid: res };
  }

  return { isSelf: true, uid: false };
}

async function mysApi(e, uid, type, data = {}) {
  if (BotConfig.mysCookies.length <= 0) {
    Bot.logger.error("请打开config.js,配置米游社cookie");
    return { retcode: -300 };
  }

  let dayEnd = getDayEnd();

  let cookie, index, isNew;
  let selfCookie = await redis.get(`genshin:cookie:${e.user_id}`);
  if (selfCookie) {
    selfCookie = JSON.parse(selfCookie);
  }

  //私聊发送的cookie
  if (selfCookie && selfCookie.uid == uid) {
    cookie = selfCookie.cookie;
  }
  //配置里面的cookie
  else if (BotConfig.dailyNote && BotConfig.dailyNote[e.user_id] && BotConfig.dailyNote[e.user_id].uid == uid) {
    cookie = BotConfig.dailyNote[e.user_id].cookie;
  } else {
    //获取uid集合
    let uid_arr = await redis.get(`genshin:ds:qq:${e.user_id}`);

    if (uid_arr) {
      uid_arr = JSON.parse(uid_arr);
      if (!uid_arr.includes(uid)) {
        uid_arr.push(uid);

        await redis.set(`genshin:ds:qq:${e.user_id}`, JSON.stringify(uid_arr), {
          EX: dayEnd,
        });
      }
    } else {
      uid_arr = [uid];

      await redis.set(`genshin:ds:qq:${e.user_id}`, JSON.stringify(uid_arr), {
        EX: dayEnd,
      });
    }

    if (uid_arr.length > e.groupConfig.mysUidLimit) {
      return { retcode: -200 };
    }

    isNew = false;
    index = await redis.get(`genshin:ds:uid:${uid}`);
    if (!index) {
      //获取没有到30次的index
      for (let i in BotConfig.mysCookies) {
        let count = await redis.sendCommand(["scard", `genshin:ds:index:${i}`]);
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
    if (!BotConfig.mysCookies[index]) {
      return { retcode: -300 };
    }

    if (!BotConfig.mysCookies[index].includes("ltoken")) {
      Bot.logger.error("米游社cookie错误，请重新配置");
      return { retcode: -400 };
    }
  }

  let { url, query, body } = getUrl(type, uid, data);
  let headers = {
    "x-rpc-app_version": "2.17.1",
    "x-rpc-client_type": 5,
    DS: getDs(query, body),
    Cookie: cookie || BotConfig.mysCookies[index],
  };

  let param = {};
  if (body) {
    param = { method: "post", body, headers };
  } else {
    param = { method: "get", headers };
  }

  let response = {};
  try {
    response = await fetch(url, param);
  } catch (error) {
    Bot.logger.error(error);
    return false;
  }
  if (!response.ok) {
    Bot.logger.error(response);
    return false;
  }
  const res = await response.json();

  if (!res) {
    Bot.logger.mark(`mys接口没有返回`);
    return false;
  }

  if (isNew) {
    await redis.sendCommand(["sadd", `genshin:ds:index:${index}`, uid]);
    redis.expire(`genshin:ds:index:${index}`, dayEnd);
    redis.set(`genshin:ds:uid:${uid}`, index, { EX: dayEnd });
  }

  if (res.retcode != 0) {
    Bot.logger.mark(`mys接口:${JSON.stringify(res)}`);
  }

  return res;
}

function checkRetcode(res, uid, e) {
  let qqName = "";
  switch (res.retcode) {
    case 0:
      Bot.logger.debug(`mys查询成功:${uid}`);
      return false;
    case -1:
      break;
    case -100:
      e.reply("无法查询，已达上限");
      break;
    case -200:
      qqName = lodash.truncate(e.sender.card, { length: 8 });
      e.reply([segment.at(e.user_id, qqName), "\n今日查询已达上限"]);
      break;
    case -300:
      e.reply("请打开config.js,配置米游社cookie");
      break;
    case -400:
      e.reply("米游社cookie错误，请重新配置");
      break;
    case 1001:
    case 10001:
    case 10103:
      e.reply("米游社接口报错，暂时无法查询");
      break;
    case 1008:
      qqName = lodash.truncate(e.sender.card, { length: 8 });
      e.reply([segment.at(e.user_id, qqName), "\nuid错误"]);
      break;
    case 10101:
      e.reply("查询已达今日上限");
      break;
    case 10102:
      if (res.message == "Data is not public for the user") {
        qqName = lodash.truncate(e.sender.card, { length: 8 });
        e.reply([segment.at(e.user_id, qqName), "\n米游社数据未公开"]);
      } else {
        e.reply(`id:${uid}请先去米游社绑定角色`);
      }
      break;
  }

  return true;
}

function roleIdToName(keyword, search_val = false) {
  if (!keyword) {
    return false;
  }
  if (search_val) {
    return roleId[keyword][0] ? roleId[keyword][0] : "";
  }

  if (!nameID) {
    nameID = new Map();
    for (let i in roleId) {
      for (let val of roleId[i]) {
        nameID.set(val, i);
      }
    }
  }
  let name = nameID.get(keyword);
  return name ? name : "";
}

async function limitGet(e) {
  if (!e.isGroup) {
    return true;
  }

  let key = `genshin:limit:${e.user_id}`;
  let num = await redis.get(key);

  if (num && num >= e.groupConfig.mysDayLimit - 1) {
    let name = lodash.truncate(e.sender.card, { length: 8 });
    e.reply([segment.at(e.user_id, name), "\n今日查询已达上限"]);
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
  redis.expire(key, dayEnd);
}

function getDayEnd() {
  let now = new Date();
  let dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), "23", "59", "59").getTime() / 1000;

  return dayEnd - parseInt(now.getTime() / 1000);
}

function dayCount(num) {
  let year = Math.floor(num / 356);
  let month = Math.floor((num % 356) / 30);
  let day = (num % 356) % 30;
  let msg = "";
  if (year > 0) {
    msg += year + "年";
  }
  if (month > 0) {
    msg += month + "个月";
  }
  if (day > 0) {
    msg += day + "天";
  }
  return msg;
}
export { roleAll, role, abyss, abyssFloor, life, weapon, wife, character, character2, pokeCharacter };
