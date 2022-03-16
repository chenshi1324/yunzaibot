import { segment } from "oicq";
import fs from "fs";

const _path = process.cwd();

//角色图鉴
//资源图片 by xiaoyao
//位置 resources/rolesInfo_xiaoyao
export const rule = {
  roleInfo: {
    reg: "(.*)(信息|图鉴|命座|天赋|突破)$", //匹配消息正则，命令正则
    priority: 900, //优先级，越小优先度越高
    describe: "【刻晴信息、刻晴图鉴、刻晴突破、刻晴命座】角色信息图鉴", //【命令】功能说明
  },
};

export async function roleInfo(e) {

  let msg = e.msg.replace(/#|＃|信息|图鉴|命座|天赋|突破/g, "");
  let id = YunzaiApps.mysInfo.roleIdToName(msg);
  let name = YunzaiApps.mysInfo.roleIdToName(id, true);
  if (!name) return true;

  let path = `${_path}/resources/rolesInfo_xiaoyao/${name}.png`

  if (!fs.existsSync(path)) {
    return true;
  }

  e.reply(segment.image(`file:///${path}`));
  return true;
}
