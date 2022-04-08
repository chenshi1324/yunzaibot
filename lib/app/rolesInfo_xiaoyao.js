import { segment } from "oicq";
import fs from "fs";

const _path = process.cwd();

//角色图鉴
//资源图片 by xiaoyao
//位置 resources/rolesInfo_xiaoyao
export const rule = {
  roleInfo: {
    reg: "#*(.*)(信息|图鉴|命座|天赋|突破|材料|素材)$", //匹配消息正则，命令正则
    priority: 900, //优先级，越小优先度越高
    describe: "【刻晴信息、刻晴图鉴、刻晴突破、刻晴命座】角色信息图鉴", //【命令】功能说明
  },
  weaponInfo: {
    reg: "", //匹配消息正则，命令正则
    priority: 900, //优先级，越小优先度越高
    describe: "【护摩图鉴】武器信息图鉴", //【命令】功能说明
  },
};

export async function roleInfo(e) {

  let msg = e.msg.replace(/#|＃|信息|图鉴|命座|天赋|突破/g, "");

  let id = YunzaiApps.mysInfo.roleIdToName(msg);
  let name;
  if (["10000005", "10000007", "20000000"].includes(id)) {
    if (!["风主", "岩主", "雷主"].includes(msg)) {
      e.reply("请选择：风主图鉴、岩主图鉴、雷主图鉴");
      return true;
    }
    name = msg;
  } else {
    name = YunzaiApps.mysInfo.roleIdToName(id, true);
    if (!name) return false;
  }

  let path = `${_path}/resources/rolesInfo_xiaoyao/${name}.png`

  if (!fs.existsSync(path)) {
    return true;
  }

  e.reply(segment.image(`file:///${path}`));
  return true;
}

let weapon = new Map();
let weaponFile = [];

await init();
export async function init(isUpdate = false) {
  let weaponJson = JSON.parse(fs.readFileSync("./config/genshin/weapon.json", "utf8"));
  for (let i in weaponJson) {
    for (let val of weaponJson[i]) {
      weapon.set(val, i);
    }
  }

  weaponFile = fs.readdirSync("./resources/weaponInfo_xiaoyao");
  for (let val of weaponFile) {
    let name = val.replace(".png", "");
    weapon.set(name, name);
  }
}

export async function weaponInfo(e) {

  let msg = e.msg || '';

  if(e.atBot){
    msg = "#" + msg.replace("#", "");
  }
  
  if(!/(#*(.*)(信息|图鉴|突破)|#(.*))$/.test(msg)) return;

  let name = weapon.get(msg.replace(/#|＃|信息|图鉴|突破/g, ""));

  if (name) {

    Bot.logger.mark(`[${e.group_name}] ${e.msg}:weaponInfo`);

    let path = `${_path}/resources/weaponInfo_xiaoyao/${name}.png`

    if (!fs.existsSync(path)) {
      return true;
    }

    e.reply(segment.image(`file:///${path}`));
    return true;
  }

  return false;
}
