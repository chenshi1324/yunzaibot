import { segment } from "oicq";
import fetch from "node-fetch";
import { render } from "../render.js";
import fs from "fs";
import common from "../common.js";
import lodash from "lodash";

//项目路径
const _path = process.cwd();

let newurl = "https://bbs-api.mihoyo.com/post/wapi/getNewsList?gids=2"; //米游社官方原神公告接口地址

if (!fs.existsSync(`./data/PushNews/`)) {
    fs.mkdirSync(`./data/PushNews/`);
}
let PushNews = {};
let emoticon;

//1.定义命令规则
export const rule = {
    newsContentBBS: {
        reg: "^(#*官方(公告|资讯|活动)|#*原神(公告|资讯|活动)|#公告|#资讯|#活动)[0-9]*$", //匹配消息正则，命令正则
        priority: 500, //优先级，越小优先度越高
        describe: "【#官方公告】米游社官方公告", //【命令】功能说明
    },
    newsListBBS: {
        reg: "^#*(公告|资讯|活动)列表$", //匹配消息正则，命令正则
        priority: 501, //优先级，越小优先度越高
        describe: "【#官方公告列表】米游社官方公告列表", //【命令】功能说明
    },
    pushnews: {
        reg: "^#*(开启公告推送|关闭公告推送)$", //匹配消息正则，命令正则
        priority: 502, //优先级，越小优先度越高
        describe: "【#开启/关闭公告推送】", //【命令】功能说明
    },
    mysUrl: {
        reg: "(.*)bbs.mihoyo.com/ys(.*)/article(.*)", //匹配消息正则，命令正则
        priority: 502, //优先级，越小优先度越高
        describe: "", //【命令】功能说明
    },
    mysSearch: {
        reg: "^(#米游社|mys)(.*)", //匹配消息正则，命令正则
        priority: 502, //优先级，越小优先度越高
        describe: "", //【命令】功能说明
    },
    pushNewsTask: {
        reg: "^测试推送(force)?$", //匹配消息正则，命令正则
        priority: 502, //优先级，越小优先度越高
        describe: "【#开启/关闭公告推送】", //【命令】功能说明
    },
};

let mysBbs = {
    api: function (type, data) {
        let host = "https://bbs-api.mihoyo.com/";
        let param = [];
        lodash.forEach(data, (v, i) => param.push(`${i}=${v}`))
        param = param.join("&")
        switch (type) {
            //搜索
            case "searchPosts":
                host += "post/wapi/searchPosts?";
                break;
            //帖子详情
            case "getPostFull":
                host += "post/wapi/getPostFull?";
                break;
            //公告列表
            case "getNewsList":
                host += "post/wapi/getNewsList?";
                break;
            case "emoticon":
                host = "https://bbs-api-static.mihoyo.com/misc/api/emoticon_set?";
                break;
        }
        return host + param;
    },
    getData: async function (e, type, data) {
        let url = this.api(type, data);
        let response = await fetch(url, { method: "get", headers: { Referer: "https://bbs.mihoyo.com/" } });
        if (!response.ok) {
            Bot.logger.error(response);
        }
        let res = await response.json();
        if (res.retcode != 0) {
            Bot.logger.error(`米游社接口访问失败：${res.message}`);
            if (e && e.reply) e.reply(`米游社接口访问失败，请稍后再试`);
            return "";
        }
        return res;
    },
    detalData: async function (data) {
        let json;
        try {
            json = JSON.parse(data.post.content);
        } catch (error) {

        }

        if (typeof json == "object") {
            if (json.imgs && json.imgs.length > 0) {
                for (let val of json.imgs) {
                    data.post.content = ` <div class="ql-image-box"><img src="${val}?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,png"></div>`;
                }
            }
        }
        else {
            for (let img of data.post.images) {
                data.post.content = data.post.content.replace(img, img + "?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,jpg");
            }

            if (!emoticon) {
                emoticon = await mysEmoticon();
            }

            data.post.content = data.post.content.replace(/_\([^)]*\)/g, function (t, e) {
                t = t.replace(/_\(|\)/g, "");
                if (emoticon.has(t)) {
                    return `<img class="emoticon-image" src="${emoticon.get(t)}"/>`;
                } else {
                    return "";
                }
            });

            var arrEntities = { 'lt': '<', 'gt': '>', 'nbsp': ' ', 'amp': '&', 'quot': '"' };
            data.post.content = data.post.content.replace(/&(lt|gt|nbsp|amp|quot);/ig, function (all, t) {
                return arrEntities[t];
            });
        }

        data.post.created_time = new Date(data.post.created_at * 1000).toLocaleString();

        for (let i in data.stat) {
            data.stat[i] = data.stat[i] > 10000 ? (data.stat[i] / 10000).toFixed(2) + "万" : data.stat[i];
        }


        return data
    }
}

export async function newsListBBS(e) {

    let type = "&type=1";
    let typeName = "公告";

    if (e.msg.includes("资讯")) {
        type = "&type=3";
        typeName = "资讯";
    }
    if (e.msg.includes("活动")) {
        type = "&type=2";
        typeName = "活动";
    }

    //执行的逻辑功能
    let url = newurl + "&page_size=5" + type; //米游社官方原神公告接口地址
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
            datas,
            typeName,
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
        e.reply("原神米游社公告推送已开启\n每30分钟自动检测一次是否存在新更新公告\n如有更新自动发送公告内容至此。");
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

export async function pushNewsTask(e = {}) {
    if(e.msg && !e.isMaster){
        return true;
    }
    //推送1小时内的公告
    let interval = 3600;
    //最多同时推送两条
    let maxNum = 2;
    //包含关键字不推送
    let reg = /冒险助力礼包|纪行|预下载|脚本外挂|集中反馈/g;

    if (e.msg && /force/.test(e.msg)) {
        e.force = true;
    }

    if (!fs.existsSync("./data/PushNews/PushNews.json")) {
        return;
    }

    PushNews = JSON.parse(fs.readFileSync("./data/PushNews/PushNews.json", "utf8"));


    if (!PushNews) return;

    //获取公告列表数据
    let news = await mysBbs.getData({}, "getNewsList", { gids: 2, page_size: 10, type: 1 });
    news = news.data.list;

    let now = Date.now() / 1000;
    let pushNews = [];
    let key = "Yunzai:mysNewPush:";
    for (let val of news) {

        if (new RegExp(reg).test(val.post.subject)) {
            continue;
        }

        let pushed = await redis.get(key + val.post.post_id);

        if ((now - val.post.created_at <= interval && !pushed) || e.force) {
            pushNews.push(val);
            redis.set(key + val.post.post_id, "1", { EX: 3600 });
            if (pushNews.length >= maxNum) {
                break;
            }
        }
    }

    if (pushNews.length <= 0) {
        return;
    }

    let pushData = [];
    for (let val of pushNews) {

        let e = { isTask: true }

        let base64 = await mysDetail(e, val.post.post_id);
        if (base64) pushData.unshift(["原神公告推送：" , segment.image(`base64://${base64}`)]);
    }

    //获取需要推送公告的用户
    for (let [pushID, push] of Object.entries(PushNews)) {
        //推送关闭
        if (!push.isNewsPush) {
            continue;
        }

        Bot.logger.mark(`推送公告[${pushID}]`);

        for (let msg of pushData) {
            if (push.isGroup) {
                Bot.pickGroup(pushID)
                    .sendMsg(msg)
                    .catch((err) => {
                        Bot.logger.mark(err);
                    });
            } else {
                common.relpyPrivate(pushID, msg);
            }

            await common.sleep(5000);
        }

        await common.sleep(5000);
    }
}

export async function newsContentBBS(e) {

    let type = 1;
    if (e.msg.includes("资讯")) type = "3";
    if (e.msg.includes("活动")) type = "2";

    let res = await mysBbs.getData(e, "getNewsList", { gids: 2, page_size: 10, type });

    let data = res.data.list;
    if (data.length == 0) {
        return true;
    }

    let page = e.msg.replace(/#|＃|官方|原神|公告|资讯|活动/g, "").trim() || 1;
    if (page > data.length) {
        e.reply("目前只查前10条最新的公告，请输入1-10之间的整数。")
        return true;
    }

    let postId = data[page - 1].post.post_id;

    return await mysDetail(e, postId);
}

export async function mysDetail(e, postId) {

    let res = await mysBbs.getData(e, "getPostFull", { gids: 2, read: 1, post_id: postId });
    let data = await mysBbs.detalData(res.data.post);

    let base64 = await render(
        "announcement",
        "announcement",
        {
            save_id: e.group_id,
            dataConent: data.post.content,
            data,
        }
    );

    if (e.isTask) {
        return base64;
    }

    if (base64) {
        e.reply(segment.image(`base64://${base64}`));
    }

    return true; //返回true 阻挡消息不再往下
}

export async function mysSearch(e) {
    let msg = e.msg;
    msg = msg.replace(/#|米游社|mys/g, "");

    if(!msg){
        e.reply(`请输入关键字，如#米游社七七攻略`);
        return true;
    }

    let page = msg.match(/.*(\d){1}$/) || 0;
    if(page && page[1]){
        page = page[1];
    }

    msg = lodash.trim(msg,page);

    let res = await mysBbs.getData(e, "searchPosts", { gids: 2, size: 20, keyword: msg });
    if (res.data.posts.length <= 0) {
        e.reply(`搜索不到您要的结果，换个关键词试试呗~`);
        return true;
    }

    let postId = res.data.posts[page].post.post_id;

    return await mysDetail(e, postId); //返回true 阻挡消息不再往下
}

export async function mysUrl(e) {
    let msg = e.msg;
    let postId = /[0-9]+/g.exec(msg)[0];

    if (!postId) {
        return true;
    }

    return await mysDetail(e, postId);
}

async function mysEmoticon() {
    let emp = new Map();

    let res = await mysBbs.getData({}, "emoticon", { gids: 2 });

    if (res.retcode != 0) {
        return emp;
    }

    for (let val of res.data.list) {
        if (!val.icon) continue;
        for (let list of val.list) {
            if (!list.icon) continue;
            emp.set(list.name, list.icon);
        }
    }

    return emp;
}
