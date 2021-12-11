import { gachaConfig } from "../../config/genshin/gacha.js";
import { abbr } from "../../config/genshin/roleId.js";
import { element } from "../../config/genshin/element.js";
import { render } from "../render.js";
import { segment } from "oicq";
import lodash from "lodash";

//初始化数据
let role5 = ["刻晴", "莫娜", "七七", "迪卢克", "琴"];
//四星角色
let role4 = [
  "辛焱",
  "迪奥娜",
  "班尼特",
  "凝光",
  "北斗",
  "辛焱",
  "香菱",
  "行秋",
  "重云",
  "雷泽",
  "诺艾尔",
  "砂糖",
  "菲谢尔",
  "芭芭拉",
  "罗莎莉亚",
  "早柚",
  "托马",
];
//四星武器
let weapon4 = [
  "弓藏",
  "祭礼弓",
  "绝弦",
  "西风猎弓",
  "昭心",
  "祭礼残章",
  "流浪乐章",
  "西风秘典",
  "西风长枪",
  "匣里灭辰",
  "雨裁",
  "祭礼大剑",
  "钟剑",
  "西风大剑",
  "匣里龙吟",
  "祭礼剑",
  "笛剑",
  "西风剑",
];
//三星武器
let weapon3 = [
  "弹弓",
  "神射手之誓",
  "鸦羽弓",
  "翡玉法球",
  "讨龙英杰谭",
  "魔导绪论",
  "黑缨枪",
  "以理服人",
  "沐浴龙血的剑",
  "铁影阔剑",
  "飞天御剑",
  "黎明神剑",
  "冷刃",
];

//五星基础概率
const chance5 = 60;
//四星基础概率
const chance4 = 510;

//回复统计
let count = {};

//#十连
async function gacha(e) {
  let user_id = e.user_id;
  let name = e.sender.card;
  let group_id = e.group_id;

  let upType = 1;
  if (e.msg.indexOf("2") != -1) {
    upType = 2; //角色up卡池2
  }

  //每日抽卡次数
  const dayNum = e.groupConfig.gachaDayNum || 1;

  let key = `genshin:gacha:${user_id}`;

  let gachaData = await global.redis.get(key);

  //获取结算时间
  let end = getEnd();

  if(!count[end.dayEnd]){
    count = {};
    count[end.dayEnd] = {};
  }
  if(count[end.dayEnd][user_id]){
    count[end.dayEnd][user_id]++;
  }else{
    count[end.dayEnd][user_id] = 1;
  }

  if(count[end.dayEnd][user_id] && count[end.dayEnd][user_id]>Number(dayNum)+2){
    if(count[end.dayEnd][user_id]<=Number(dayNum)+4){
      e.reply(`每天只能抽${dayNum}次`);
    }
    return true;
  }
  
  if (!gachaData) {
    gachaData = {
      num4: 0, //4星保底数
      isUp4: 0, //是否4星大保底
      num5: 0, //5星保底数
      isUp5: 0, //是否5星大保底
      week: { num: 0, expire: end.weekEnd },
      today: { role: [], expire: end.dayEnd, num: 0 },
    };
  } else {
    gachaData = JSON.parse(gachaData);

    if (new Date().getTime() >= gachaData.today.expire) {
      gachaData.today = { num: 0, role: [], expire: end.dayEnd };
    }
    if (new Date().getTime() >= gachaData.week.expire) {
      gachaData.week = { num: 0, expire: end.weekEnd };
    }
  }

  if (gachaData.today.num >= dayNum) {
    let msg = lodash.truncate(name, { length: 8 });
    
    if (gachaData.today.role.length > 0) {
      msg += "\n今日五星：";
      for (let val of gachaData.today.role) {
        msg += `${val.name}(${val.num})\n`;
      }
      msg = msg.trim("\n");

      if (gachaData.week.num - gachaData.today.role.length >= 1) {
        msg += `\n本周：${gachaData.week.num}个五星`;
      }
    } else {
      msg += `今日已抽\n累计${gachaData.num5}抽无五星`;

      if (gachaData.week.num >= 2) {
        msg += `\n本周：${gachaData.week.num}个五星`;
      }
    }

    //回复消息
    e.reply(msg);
    //返回true不再向下执行
    return true;
  }

  let up4 = [];
  let up5 = [];
  let poolName = "";

  for (let val of gachaConfig.pool) {
    if (new Date().getTime() <= new Date(val.endTime).getTime()) {
      up4 = val.up4;
      if (upType == 1) {
        up5 = val.up5;
      } else {
        up5 = val.up5_2;
      }

      if(lodash.difference(val.up5,val.up5_2).length<=0){
        poolName = abbr[val.up5[0]] ? abbr[val.up5[0]] : val.up5[0];
        poolName = `角色池:${poolName}`;
      }else{
        poolName = `角色池-${upType}`;
      }

      break;
    }
  }
  if (up5.length <= 0) {
    up4 = gachaConfig.pool[gachaConfig.pool.length - 1].up4;
    up5 = gachaConfig.pool[gachaConfig.pool.length - 1].up5;
  }

  //去除当前up的四星
  role4 = lodash.difference(role4,up4);

  //每日抽卡数+1
  gachaData.today.num++;

  //数据重置
  let res5 = [],
    resC4 = [],
    resW4 = [],
    resW3 = [];

  //是否大保底
  let isBigUP = false;

  //循环十次
  for (let i = 1; i <= 10; i++) {
    let tmpChance5 = chance5;

    //增加双黄概率
    if (gachaData.week.num == 1) {
      tmpChance5 = chance5 * 2;
    }

    //90次都没中五星
    if (gachaData.num5 >= 90) {
      tmpChance5 = 10000;
    }
    //74抽后逐渐增加概率
    else if (gachaData.num5 >= 74) {
      tmpChance5 = 590 + (gachaData.num5 - 74) * 530;
    }
    //60抽后逐渐增加概率
    else if (gachaData.num5 >= 60) {
      tmpChance5 = chance5 + (gachaData.num5 - 50) * 40;
    }

    //抽中五星
    if (getRandomInt(10000) <= tmpChance5) {
      //当前抽卡数
      let nowCardNum = gachaData.num5 + 1;

      //五星抽卡数清零
      gachaData.num5 = 0;
      //没有四星，四星保底数+1
      gachaData.num4++;

      let tmpUp = 40; //下毒

      if (gachaData.isUp5 == 1) {
        tmpUp = 101;
      }

      let tmp_name = "";
      //当祈愿获取到5星角色时，有50%的概率为本期UP角色
      if (getRandomInt(100) <= tmpUp) {
        if (gachaData.isUp5 == 1) {
          isBigUP = true;
        }
        //大保底清零
        gachaData.isUp5 = 0;
        //up 5星
        tmp_name = up5[getRandomInt(up5.length)];
      } else {
        //大保底
        gachaData.isUp5 = 1;
        tmp_name = role5[getRandomInt(role5.length)];
      }

      gachaData.today.role.push({ name: tmp_name, num: nowCardNum });
      gachaData.week.num++;

      res5.push({
        name: tmp_name,
        star: 5,
        type: "character",
        num: nowCardNum,
        element: element[tmp_name],
      });
      continue;
    }

    //没有五星，保底数+1
    gachaData.num5++;

    let tmpChance4 = chance4;

    //9次都没中四星 概率100%
    if (gachaData.num4 >= 9) {
      tmpChance4 = chance4 + 10000;
    }
    //6次后逐渐增加概率
    else if (gachaData.num4 >= 5) {
      tmpChance4 = tmpChance4 + Math.pow(gachaData.num4 - 4, 2) * 500;
    }

    //抽中四星
    if (getRandomInt(10000) <= tmpChance4) {
      //保底四星数清零
      gachaData.num4 = 0;

      if (gachaData.isUp4 == 1) {
        //是否必出四星清零
        gachaData.isUp4 = 0;
        var tmpUp = 100;
      } else {
        var tmpUp = 50;
      }

      //当祈愿获取到4星物品时，有50%的概率为本期UP角色
      if (Math.ceil(Math.random() * 100) <= tmpUp) {
        //up 4星
        let tmp_name = up4[getRandomInt(up4.length)];
        resC4.push({
          name: tmp_name,
          star: 4,
          type: "character",
          element: element[tmp_name],
        });
      } else {
        gachaData.isUp4 = 1;
        //一半概率武器 一半4星
        if (getRandomInt(100) <= 50) {
          let tmp_name = role4[getRandomInt(role4.length)];
          resC4.push({
            name: tmp_name,
            star: 4,
            type: "character",
            element: element[tmp_name],
          });
        } else {
          let tmp_name = weapon4[getRandomInt(weapon4.length)];
          resW4.push({
            name: tmp_name,
            star: 4,
            type: "weapon",
            element: element[tmp_name],
          });
        }
      }
      continue;
    }

    //没有四星，保底数+1
    gachaData.num4++;

    //随机三星武器
    let tmp_name = weapon3[getRandomInt(weapon3.length)];
    resW3.push({
      name: tmp_name,
      star: 3,
      type: "weapon",
      element: element[tmp_name],
    });
  }

  await global.redis.set(key, JSON.stringify(gachaData), {
    EX: end.keyEnd,
  });

  let list = [...res5, ...resC4, ...resW4, ...resW3];

  let info = `累计「${gachaData.num5}抽」`;

  if (res5.length > 0) {
    let role5 = res5[res5.length - 1];
    info = `${role5.name}「${role5.num}抽」`;
  }

  if (isBigUP) {
    info += "大保底";
  }

  let base64 = await render("genshin", "gacha", {
    save_id: user_id,
    name: name,
    info: info,
    list: list,
    poolName:poolName,
  });

  if (base64) {
    let msg = segment.image(`base64://${base64}`);
    e.reply(msg);
  }

  return true;
}

//返回随机整数
function getRandomInt(max = 10000) {
  return Math.floor(Math.random() * max);
}

function getEnd() {
  let now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let dayEnd = "";
  //每日数据-凌晨4点更新
  if (now.getHours() < 4) {
    dayEnd = new Date(year, month, day, "03", "59", "59").getTime();
  } else {
    dayEnd = new Date(year, month, day, "23", "59", "59").getTime() + 3600 * 4 * 1000;
  }

  //每周结束时间
  let weekEnd = dayEnd + 86400 * (7 - now.getDay()) * 1000;
  //redis过期时间
  let keyEnd = Math.ceil((dayEnd + 86400 * 5 * 1000 - now.getTime()) / 1000);

  return { dayEnd, weekEnd, keyEnd };
}

export { gacha };
