import fetch from "node-fetch";
import md5 from "md5";
import { segment } from "oicq";
import { roleId, wifeData, roleId5, roleId4, actWeapon, abbr } from "../../config/genshin/roleId.js";
import { config } from "../../config/config.js";
import { render } from "../render.js";
import _ from "lodash";

//#角色2
async function roleAll(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  let resInex = mysApi(e, uid, "index");
  let resAbyss = mysApi(e, uid, "spiralAbyss", { schedule_type: 1 });
  let role5 = getAllRoleDetail(e, uid, 5);
  let role4 = getAllRoleDetail(e, uid, 4);

  [role5, role4, resInex, resAbyss] = await Promise.all([role5, role4, resInex, resAbyss]);

  if (checkRetcode(resInex, uid, e)) {
    return true;
  }
  res = resInex.data;

  limitSet(e);

  let avatars = [...role5, ...role4];
  let roleArr = avatars;

  let rarity5 = -1;
  let constellation6 = 0;

  for (let i in avatars) {
    let rarity = avatars[i].rarity;
    let actived_constellation_num = avatars[i].actived_constellation_num;
    let level = avatars[i].level;
    let id = avatars[i].id - 10000000;

    if (rarity >= 5) {
      rarity = 5;
      rarity5++;
    }
    //埃洛伊排到最后
    if (rarity > 5) {
      id = 0;
    }
    //增加神里排序
    if (avatars[i].id == 10000002) {
      id = 50;
    }
    if (avatars[i].name != "旅行者" && actived_constellation_num >= 6) {
      constellation6++;
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

    //id倒序，最新出的角色拍前面
    avatars[i].sort = rarity * 100000 + actived_constellation_num * 10000 + level * 100 + id;
  }

  rarity5 = rarity5 < 0 ? 0 : rarity5;

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
          stats.common_chest_number +
          stats.magic_chest_number,
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

    explor.push({ lable: val.name, num: `${val.exploration_percentage / 10}%` });
  }
  line.push(explor);

  if (avatars.length > 0) {
    //重新排序
    avatars = _.sortBy(avatars, function (o) {
      return o.level * -1;
    });
    avatars = avatars.slice(0, 18);
    avatars = _.sortBy(avatars, function (o) {
      return o.sort * -1;
    });
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
    bg: Math.round(Math.random() * (4 - 1)) + 1,
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true; //事件结束不再往下
}

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

  let avatar = _.keyBy(roleArr, "id");

  for (let val of tmpRole) {
    let tmp = avatar[val];
    list.push({
      star: tmp.rarity,
      level: tmp.level,
      name: tmp.name,
      life: tmp.actived_constellation_num,
    });
  }

  if (list.length < 4) {
    for (let val of resAbyss.reveal_rank) {
      if (list.length >= 4) {
        break;
      }

      if (tmpRole.includes(val.avatar_id)) {
        continue;
      }
      let tmp = avatar[val.avatar_id];
      list.push({
        star: val.rarity,
        level: tmp.level,
        name: tmp.name,
        life: tmp.actived_constellation_num,
      });
    }
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
  let roleId5 = await redis.get(`genshin:roleId5:${uid}`);
  if(roleId5){
    roleId5 = JSON.parse(roleId5);
    rarity5 = roleId5.id.length-1;
  }else{
    rarity5 = res.avatars.length;
  }

  let stats = res.stats;
  let line = [
    [
      { lable: "成就", num: stats.achievement_number },
      { lable: "角色数", num: stats.avatar_number },
      { lable: "五星", num: rarity5 },
      { lable: "深境螺旋", num: stats.spiral_abyss },
    ],
    [
      {
        lable: "总宝箱",
        num:
          stats.precious_chest_number +
          stats.luxurious_chest_number +
          stats.exquisite_chest_number +
          stats.common_chest_number +
          stats.magic_chest_number,
      },
      { lable: "华丽宝箱", num: stats.luxurious_chest_number },
      { lable: "珍贵宝箱", num: stats.precious_chest_number },
      { lable: "奇馈宝箱", num: stats.magic_chest_number },
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
    bg: Math.round(Math.random() * (4 - 1)) + 1,
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

//#深渊十二层（能查，但是具体阵容看不了）
async function abyssFloor(e) {
  let res = await getUid(e);

  if (!res.uid && res.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
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
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  let type = 5; //五星
  if (/(.*)(四星|4星)(.*)/.test(e.msg)) {
    type = 4; //四星
  }

  let avatars = await getAllRoleDetail(e, uid, type);

  limitSet(e);

  let list = [];
  let lead = {}; //主角

  for (let val of avatars) {
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

    val.sort = val.actived_constellation_num * 10000 + val.level * 100 + (val.id - 10000000);

    //增加神里排序
    if (val.id == 10000002) {
      val.sort+=50;
    }

    if (val.rarity > 5) {
      val.sort = val.sort - (val.id - 10000000);
    }

    list.push(val);
  }

  list = _.sortBy(list, function (o) {
    return o.sort * -1;
  });

  let num = list.length;

  if (type == 5) {
    //旅行者放到最后
    list.push(lead);
  }

  let base64 = await render("genshin", "life", {
    save_id: uid,
    uid: uid,
    num: num,
    type,
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
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = res.uid;

  let role5 = getAllRoleDetail(e, uid, 5);
  let role4 = getAllRoleDetail(e, uid, 4);
  [role5, role4] = await Promise.all([role5, role4]);
  let role = [...role5, ...role4];

  limitSet(e);

  let weapon = [];
  for (let val of role) {
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

  weapon = _.sortBy(weapon, function (o) {
    return o.firstSort * -1;
  });
  weapon = weapon.slice(0, 21);
  weapon = _.sortBy(weapon, function (o) {
    return o.sort * -1;
  });

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
  let roleId = roleIdToName(e.msg.replace(/#|\w/g, "").trim());

  if (!roleId) return false;

  let uidRes = await getUid(e);

  if (!uidRes.uid && uidRes.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  let uid = uidRes.uid;
  let server = getServer(uid);
  //主角特殊处理
  if (roleId == "20000000") {
    roleId = 10000007;
    let res = await mysApi(e, uid, "character", {
      character_ids: [roleId],
      role_id: uid,
      server: server,
    });
    if (res.retcode != 0) {
      roleId = 10000005;
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
      msg += `\n没有${e.msg}`;
      e.reply([msg, segment.face(rand_face)]);
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

  //将查询到的角色id插入redis
  let redisId = "";
  if (avatars.rarity >= 5) {
    let key = `genshin:roleId5:${uid}`;
    redisId = await redis.get(key);
  } else {
    let key = `genshin:roleId4:${uid}`;
    redisId = await redis.get(key);
  }
  if (redisId) {
    redisId = JSON.parse(redisId);
    if (!redisId.id.includes(Number(avatars.id))) {
      redisId.id.push(Number(avatars.id));
      //保存redis
      redis.set(key, JSON.stringify(redisId), { EX: 2592000 });
    }
  }

  let base64 = await render("genshin", "character", {
    save_id: uid,
    uid: uid,
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

  if (!uidRes.uid && uidRes.isSelf) {
    e.reply("请在群昵称中添加游戏的uid");
    return true;
  }

  if (!(await limitGet(e))) return true;

  e.msg = e.msg.replace(/#|\w/g, "");

  let i = 0;
  if (["老婆", "媳妇", "妻子", "娘子", "女朋友", "女友"].includes(e.msg)) {
    i = 0;
  } else if (["老公", "丈夫", "夫君", "郎君", "男朋友", "男友"].includes(e.msg)) {
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
  let server = getServer(uid);
  let roleId5 = await redis.get(`genshin:roleId5:${uid}`);
  let avatars = [];
  //初始化数据
  if (!roleId5) {
    let role5 = getAllRoleDetail(e, uid, 5);
    let role4 = getAllRoleDetail(e, uid, 4);

    [role5, role4] = await Promise.all([role5, role4]);

    avatars = [...role5, ...role4];
  } else {
    let roleId4 = await redis.get(`genshin:roleId4:${uid}`);
    let allId = [...JSON.parse(roleId5).id, ...JSON.parse(roleId4).id];

    allId = _.intersection(wifeData[i], allId);
    let tmpId = [];
    let res = [];
    let j = 0;
    for (let val of allId) {
      j++;
      tmpId.push(val);
      if (tmpId.length >= 8 || j == allId.length) {
        res.push(
          mysApi(e, uid, "character", {
            character_ids: tmpId,
            role_id: uid,
            server: server,
          })
        );
        tmpId = [];
      }
    }
    res = await Promise.all(res);

    for (let val of res) {
      if (val.retcode == 0) {
        avatars.push(...val.data.avatars);
      }
    }
    if (checkRetcode(res[0], uid, e)) {
      return true;
    }
  }

  limitSet(e);

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

    //超过80级的每级*5
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
    if (uidRes.isSelf) {
      let msg = Substr(e.sender.card, 13);
      let rand_face = [5, 9, 34, 35, 36, 37];
      rand_face = rand_face[Math.floor(Math.random() * rand_face.length)];
      msg += `\n没有${e.msg}`;
      e.reply([msg, segment.face(rand_face)]);
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
    e.reply(segment.image(`base64://${base64}`));
  }

  return true;
}

//获取已拥有的角色id
async function getAllRoleDetail(e, uid, star = 5) {
  let key = `genshin:roleId${star}:${uid}`;
  let ids = roleId5;
  let server = getServer(uid);
  if (star == 4) {
    ids = roleId4;
  }
  let hasId = await redis.get(key);
  let roleDetail = [];

  if (hasId) {
    hasId = JSON.parse(hasId);

    //接口查询
    if (new Date().getTime() - hasId.time > 86400 * 3 * 1000) {
      //未拥有的角色id
      ids = ids.filter((v) => {
        return !hasId.id.includes(Number(v));
      });

      hasId.time = new Date().getTime();

      if (ids.length > 0) {
        let res = [];
        for (let val of ids) {
          if (val == 10000005 && hasId.id.includes(10000007)) {
            continue;
          }
          if (val == 10000007 && hasId.id.includes(10000005)) {
            continue;
          }
          res.push(
            mysApi(e, uid, "character", {
              character_ids: [val],
              role_id: uid,
              server: server,
            })
          );
        }
        res = await Promise.all(res);
        for (var val of res) {
          if (val.retcode == 0) {
            hasId.id.push(Number(val.data.avatars[0].id));
            roleDetail.push(val.data.avatars[0]);
          }
        }
      }
      //全角色
      else {
        await redis.set(key, JSON.stringify(hasId), { EX: 2592000 });
        if (!e.isSecond) {
          e.isSecond = true;
          return getAllRoleDetail(e, uid, star);
        }
      }
      if (hasId.id.length > 0) {
        //保存redis
        await redis.set(key, JSON.stringify(hasId), { EX: 2592000 });
      }
    }
    //用redis的id查询
    else {
      let tmpId = [];
      let res = [];
      let i = 0;
      for (let val of hasId.id) {
        i++;
        tmpId.push(val);
        if (tmpId.length >= 8 || i == hasId.id.length) {
          res.push(
            mysApi(e, uid, "character", {
              character_ids: tmpId,
              role_id: uid,
              server: server,
            })
          );
          tmpId = [];
        }
      }
      res = await Promise.all(res);

      for (let val of res) {
        if (val.retcode == 0) {
          roleDetail.push(...val.data.avatars);
        }
      }
    }
  }
  //没有数据，全部查询
  else {
    hasId = { id: [], time: new Date().getTime() };
    let res = [];
    for (let val of ids) {
      res.push(
        mysApi(e, uid, "character", {
          character_ids: [val],
          role_id: uid,
          server: server,
        })
      );
    }
    res = await Promise.all(res);
    for (var val of res) {
      if (val.retcode == 0) {
        hasId.id.push(Number(val.data.avatars[0].id));
        roleDetail.push(val.data.avatars[0]);
      }
    }

    if (hasId.id.length > 0) {
      //保存redis
      await redis.set(key, JSON.stringify(hasId), { EX: 2592000 });
    }
  }

  return roleDetail;
}

function get_character(avatars) {
  let list = [];
  let set = [];
  let text1 = "";
  let text2 = "";
  let bg = 2;

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

  //特殊处理
  if (avatars.name == "珊瑚宫心海") {
    avatars.name = "心海";
  }

  if (avatars.id == "10000005") {
    avatars.name = "空";
  } else if (avatars.id == "10000007") {
    avatars.name = "荧";
  }

  //皮肤图片
  if (["芭芭拉", "琴"].includes(avatars.name)) {
    if (avatars.level > 80 || avatars.fetter >= 8) {
      bg = 3;
    }
  }

  return {
    name: avatars.name,
    level: avatars.level,
    fetter: avatars.fetter,
    actived_constellation_num: avatars.actived_constellation_num,
    list,
    text1,
    text2,
    bg,
  };
}

//#体力
async function dailyNote(e) {
  if (!config.dailyNote || !config.dailyNote[e.user_id]) {
    return true;
  }
  let dayConfig = config.dailyNote[e.user_id];
  let { url, query, body } = getUrl("dailyNote", dayConfig.uid);
  let headers = {
    "x-rpc-app_version": "2.12.1",
    "x-rpc-client_type": 5,
    DS: getDs(query, body),
    Cookie: dayConfig.cookie,
  };

  const response = await fetch(url, { method: "get", headers });
  if (!response.ok) {
    e.reply("查询失败");
    return true;
  }
  const res = await response.json();

  if (res.retcode == 10102) {
    e.reply("请先开启实时便笺数据展示");
    return true;
  }

  if (res.retcode != 0) {
    e.reply(res.message || "查询失败");
    return true;
  }

  let resin80 = "";
  if (res.data.resin_recovery_time > 38400) {
    resin80 = new Date().getTime() + (res.data.resin_recovery_time - 38400) * 1000;
    resin80 = new Date(resin80).Format("MM-dd HH:mm:ss");
  }
  let resin120 = "";
  if (res.data.resin_recovery_time > 19200) {
    resin120 = new Date().getTime() + (res.data.resin_recovery_time - 19200) * 1000;
    resin120 = new Date(resin120).Format("MM-dd HH:mm:ss");
  }
  let resin160 = "";
  if (res.data.resin_recovery_time > 0) {
    resin160 = new Date().getTime() + res.data.resin_recovery_time * 1000;
    resin160 = new Date(resin160).Format("MM-dd HH:mm:ss");
  }

  let msg = `树脂：${res.data.current_resin}`;
  if (resin80) {
    msg += `\n 80：${resin80}`;
  }
  if (resin120) {
    msg += `\n120：${resin120}`;
  }
  if (resin160) {
    msg += `\n160：${resin160}`;
  }

  e.reply(msg);
  return true;
}

//获取uid
async function getUid(e) {
  //从消息中获取
  let reg = /[1|2|5][0-9]{8}/g;
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
  if (config.mysCookies.length <= 0) {
    e.reply("请先配置米游社cookies");
    return false;
  }

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
    "x-rpc-app_version": "2.17.1",
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
  if (!response.ok) {
    return false;
  }
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
      logger.debug(`mys查询成功:${uid}`);
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
  let dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), "23", "59", "59").getTime() / 1000;

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
export { roleAll, role, abyss, abyssFloor, life, weapon, wife, character, dailyNote };
