import { segment } from "oicq";
import fetch from "node-fetch";
import { render } from "../render.js";

//项目路径
const _path = process.cwd();

let checkMsg = "设置角色、武器、技能等级有误\n参考格式：#绫华养成【角色等级】【武器等级】【A技能等级】【E技能等级】【Q技能等级】中间逗号隔开\n每次均需输入5个参数\n示例：#绫华养成90,90,10,10,10";

export const rule = {
    skillcalculate: {
        reg: "^#*(.*)(养成|养成计算)([0-9]|,|，)*$", //匹配消息正则，命令正则
        priority: 800, //优先级，越小优先度越高
        describe: "【#养成计算器】根据已有角色计算养成所需材料", //【命令】功能说明
    },
};

export async function skillcalculate(e) {
    //e.msg 用户的命令消息
    // console.log("用户命令：", e.msg);

    let setSkill = "90,90,10,10,10".split(",");

    let AvatarName = e.msg.replace(/#|＃|养成|计算|[0-9]|,|，/g, "").trim();

    let set = e.msg.replace(/#|＃|养成|计算/g, "").trim();

    set = set.replace(/，/g, ",");

    set = set.replace(AvatarName, "");

    if (set) {
        setSkill = set.split(",");
    }

    if (setSkill.length != 5) {
        e.reply(checkMsg);
        return true;
    }

    let check = "90,90,10,10,10".split(",");

    for (const key in check) {
        if (parseInt(check[key]) < parseInt(setSkill[key])) {
            setSkill[key] = check[key];
        }
    }

    let MysApi = await e.getMysApi({
        auth: "cookie",
        targetType: "self",
        cookieType: "self",
        actionName: "查询养成计算"
    });
    if (!MysApi) { return true; }


    let id = YunzaiApps.mysInfo.roleIdToName(AvatarName);

    let data = await MysApi.getAvatar(id);

    if (!data) {
        return true;
    }

    //角色
    let dataCharacter = await MysApi.getCharacter();

    dataCharacter = dataCharacter.avatars.filter(item => item.id == id)[0];

    // console.log(dataCharacter);

    //技能
    let skill_list = data.skill_list;
    skill_list = skill_list.filter(item => item.max_level != 1);
    // console.log(skill_list);

    if(parseInt(dataCharacter.weapon.rarity) < 3){
        setSkill[1] = 70;
    }

    let body = {
        "avatar_id": parseInt(id),
        "avatar_level_current": parseInt(dataCharacter.level),
        "avatar_level_target": parseInt(setSkill[0]),
        "skill_list": [
            {
                "id": parseInt(skill_list[0].group_id),
                "level_current": parseInt(skill_list[0].level_current),
                "level_target": parseInt(setSkill[2])
            },
            {
                "id": parseInt(skill_list[1].group_id),
                "level_current": parseInt(skill_list[1].level_current),
                "level_target": parseInt(setSkill[3])
            },
            {
                "id": parseInt(skill_list[2].group_id),
                "level_current": parseInt(skill_list[2].level_current),
                "level_target": parseInt(setSkill[4])
            }
        ],
        "weapon": {
            "id": parseInt(dataCharacter.weapon.id),
            "level_current": parseInt(dataCharacter.weapon.level),
            "level_target": parseInt(setSkill[1])
        }
    }

    let computes = await MysApi.getCompute(body);

    if(!computes){
        return true;
    }

    computes._res = {};

    let uid = MysApi.targetUser._uid;

    let base64 = await render(
        "skillcalculate",
        "skillcalculate",
        {
            uid,
            dataCharacter,
            setSkill,
            skill_list,
            computes
        }
    );

    if (base64) {
        e.reply(segment.image(`base64://${base64}`));
    }

    return true; //返回true 阻挡消息不再往下
}