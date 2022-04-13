import { segment } from "oicq";
import fetch from "node-fetch";
import { render } from "../render.js";
import fs from "fs";
import common from "../common.js";

//项目路径
const _path = process.cwd();

let newurl = "https://bbs-api.mihoyo.com/post/wapi/getNewsList?gids=2&type=1"; //米游社官方原神公告接口地址

if (!fs.existsSync(`./data/PushNews/`)) {
    fs.mkdirSync(`./data/PushNews/`);
}
let PushNews = {};


//1.定义命令规则
export const rule = {
    newsContentBBS: {
        reg: "^(#*官方公告|#*原神公告|#公告)[0-9]*$", //匹配消息正则，命令正则
        priority: 500, //优先级，越小优先度越高
        describe: "【#官方公告】米游社官方公告", //【命令】功能说明
    },
    newsListBBS: {
        reg: "^#*公告列表$", //匹配消息正则，命令正则
        priority: 501, //优先级，越小优先度越高
        describe: "【#官方公告列表】米游社官方公告列表", //【命令】功能说明
    },
    pushnews: {
        reg: "^#*(开启公告推送|关闭公告推送)$", //匹配消息正则，命令正则
        priority: 502, //优先级，越小优先度越高
        describe: "【#开启/关闭公告推送】", //【命令】功能说明
    },
    // pushNewsTask: {
    //     reg: "^测试推送$", //匹配消息正则，命令正则
    //     priority: 502, //优先级，越小优先度越高
    //     describe: "【#开启/关闭公告推送】", //【命令】功能说明
    // },
};

export async function newsContentBBS(e) {

    //执行的逻辑功能
    let url = newurl + "&page_size=10"; //米游社官方原神公告接口地址
    let response = await fetch(url); //调用接口获取数据
    let res = await response.json(); //结果json字符串转对象

    if (res.retcode != 0) {
        return true;
    }
    let data = res.data.list;
    if (data.length == 0) {
        return true;
    }

    let page = 1;
    if (!e.isPushTask) {
        page = e.msg.replace(/#|＃|官方|原神|公告/g, "").trim();
    }
    if(!page){
        page = 1;
    }
    if (page > data.length) {
        page = 1; //todo 越界

        e.reply("目前只查前5条最新的公告，请输入1-5之间的整数。")
        return true;
    }

    let newData = data[page - 1].post;

    let newsTime = new Date(newData.created_at * 1000);

    if (e.isPushTask) {
        //过滤无用公告推送
        let reg = /冒险助力礼包|纪行|预下载|脚本外挂|集中反馈/g;
        for (let val of data) {
          if (new RegExp(reg).test(val.post.subject)) {
            continue;
          }
          newData = val.post;
          newsTime = new Date(newData.created_at * 1000);
          break;
        }
        
        let oldTime = new Date(e.lastPushTime);
        if (newsTime.getTime() - oldTime.getTime() <= 0) {
            return;
        }
        PushNews = JSON.parse(fs.readFileSync("./data/PushNews/PushNews.json", "utf8"));
        PushNews[e.pushID].lastPushTime = newsTime;
        savePushJson();

        Bot.logger.mark(`newsListBBS ：${e.pushID} 符合公告推送条件，开始推送`);
    }


    let title = newData.subject;
    //newData.subject  
    //newData.content
    // console.log(`最新公告时间：${newData.created_at}`);
    // console.log(`image：${newData.images}`);
    // console.log(`文字内容：${newData.structured_content}`)

    let content = JSON.parse(newData.structured_content);

    let dataConent = "";
    let imageCount = 0;
    for (const key in content) {
        let line = content[key];
        if (line.attributes) {
            if (line.attributes.color) {
                let spanTemp = `<span style="color: ${line.attributes.color};">${line.insert}</span>`;
                if (line.attributes.bold) {
                    spanTemp = `<strong style="color: ${line.attributes.color};">${line.insert}</strong>`;
                }
                dataConent += spanTemp;
            }
        } else if (line.insert.image) {
            let imageURL = newData.images[imageCount];
            let imageTemp = `<div class="ql-image-box"><img src="${imageURL}"></div>`;
            dataConent += imageTemp;
            imageCount++;
        } else {
            dataConent += `<p><span style="color: rgb(51, 51, 51);">&nbsp;</span></p>`;
        }
    }

    newsTime = newsTime.toLocaleString();

    let base64 = await render(
        "announcement",
        "announcement",
        {
            title,
            newsTime,
            dataConent
        }
    );

    if (base64) {
        let msg = [];
        if (e.isPushTask) {
            msg.push("原神公告推送：\n");
        }
        msg.push(segment.image(`base64://${base64}`));
        e.reply(msg);
    }
    return true; //返回true 阻挡消息不再往下
}

export async function newsListBBS(e) {

    //执行的逻辑功能
    let url = newurl + "&page_size=5"; //米游社官方原神公告接口地址
    let response = await fetch(url); //调用接口获取数据
    let res = await response.json(); //结果json字符串转对象

    if (res.retcode != 0) {
        return true;
    }
    let datas = res.data.list;
    if (datas.length == 0) {
        return true;
    }

    
    datas.forEach(element => {
        element.post.created_at = new Date(element.post.created_at * 1000).toLocaleString();
    });


    let base64 = await render(
        "announcement",
        "announcementList",
        {
            datas
        }
    );

    if (base64) {
        e.reply(segment.image(`base64://${base64}`));
    }

    return true; //返回true 阻挡消息不再往下
}

export async function pushnews(e) {
    if (e.isGroup) {
      if (!e.member.is_admin && !e.isMaster) {
        e.reply("暂无权限，只有管理员才能操作", true);
        return true;
      }
    }

    if (fs.existsSync("./data/PushNews/PushNews.json")) {
        // console.log("存在PushNews.json");
        PushNews = JSON.parse(fs.readFileSync("./data/PushNews/PushNews.json", "utf8"));
    } else {
        // console.log("不存在PushNews.json")
        savePushJson();
    }

    //推送对象记录
    let pushID = "";
    if (e.isGroup) {
        pushID = e.group_id;
    } else {
        pushID = e.user_id;
    }
    if (!pushID) {
        return true;
    }
    if (e.msg.includes("开启")) {
        PushNews[pushID] = { isNewsPush: true, isGroup: e.isGroup || false, lastPushTime: new Date(), startUser: e.user_id };
        savePushJson();
        Bot.logger.mark(`开启原神米游社公告推送:${pushID}`);
        e.reply("原神米游社公告推送已开启，每30分钟自动检测一次是否存在新更新公告，如有更新自动发送公告内容至此。");
    }

    if (e.msg.includes("关闭")) {
        if (PushNews[pushID]) {
            PushNews[pushID].isNewsPush = false;
            savePushJson();
            Bot.logger.mark(`关闭原神米游社公告推送:${pushID}`);
            e.reply("原神米游社公告推送已关闭");
        } else {
            e.reply("此处并没有开启过公告推送");
        }
    }
    return true;
}

export async function savePushJson() {
    let path = "./data/PushNews/PushNews.json";
    fs.writeFileSync(path, JSON.stringify(PushNews, "", "\t"));
}

export async function pushNewsTask() {
    if (fs.existsSync("./data/PushNews/PushNews.json")) {
        PushNews = JSON.parse(fs.readFileSync("./data/PushNews/PushNews.json", "utf8"));
    } else {
        return;
    }
    
    //获取需要推送公告的用户
    for (let [pushID, push] of Object.entries(PushNews)) {
        //推送关闭
        if (!push.isNewsPush) {
            continue;
        }
        let e = { pushID, isPushTask: true, lastPushTime: push.lastPushTime };
        e.reply = (msg) => {
            if (push.isGroup) {
                Bot.pickGroup(pushID).sendMsg(msg).catch((err) => {
                    Bot.logger.mark(err);
                });
            } else {
                common.relpyPrivate(pushID, msg);
            }
        };
        Bot.logger.mark(`推送官方公告[${pushID}]`);
        await newsContentBBS(e);
        await common.sleep(10000);

    }
}
