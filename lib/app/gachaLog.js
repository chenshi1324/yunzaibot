import { segment } from "oicq";
import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { render } from "../render.js";
import lodash from "lodash";
import format from "date-format";
import common from "../common.js";

const _path = process.cwd();
const reqTypeList = ['常驻', '角色', '武器']

export const rule = {
  bing: {
    reg: "(.*)authkey_ver(.*)",
    priority: 400,
    describe: "【历史记录链接】发送链接生成抽卡记录",
  },
  bingFile: {
    reg: "noCheck",
    priority: 401,
    describe: "【日志文件】发送日志生成抽卡记录",
  },
  getLog: {
    reg: "^#*(抽卡|抽奖|角色|武器|常驻|up)池*(记录|祈愿|分析)$",
    priority: 402,
    describe: "【日志文件】发送日志生成抽卡记录",
  },
  history: {
    reg: "^#*(抽卡|抽奖|角色|武器|常驻|up)池*统计$",
    priority: 403,
    describe: "【抽卡统计】发送日志生成抽卡记录",
  },
  help: {
    reg: "^#*(记录帮助|抽卡帮助)$",
    priority: 404,
    describe: "【记录帮助】抽卡记录链接说明",
  },
  helpPort: {
    reg: "^#*(安卓|苹果|电脑)帮助$",
    priority: 405,
    describe: "【安卓帮助，苹果帮助，电脑帮助】各个端口获取链接帮助",
  },
};

//创建gachaLog文件夹
if (!fs.existsSync(`./data/html/genshin/gachaLog/`)) {
  fs.mkdirSync(`./data/html/genshin/gachaLog/`);
}
//创建gachaJson文件夹，抽卡json保存地址
if (!fs.existsSync(`./data/html/genshin/gachaJson/`)) {
  fs.mkdirSync(`./data/html/genshin/gachaJson/`);
}
if (!fs.existsSync(`./data/html/genshin/gachaHistory/`)) {
  fs.mkdirSync(`./data/html/genshin/gachaHistory/`);
}

let genshin = {};
await init();

export async function init(isUpdate = false) {
  let version = isUpdate ? new Date().getTime() : 0;
  genshin = await import(`../../config/genshin/roleId.js?version=${version}`);
}

let abbrName = { ...genshin.abbr, ...genshin.abbr2 };
let key = "genshin:cardLog:authkey:";
//五星角色
let role5 = ["刻晴", "莫娜", "七七", "迪卢克", "琴"];
//五星武器
let weapon5 = ["阿莫斯之弓", "天空之翼", "天空之卷", "天空之脊", "天空之傲", "天空之刃", "四风原典", "和璞鸢", "狼的末路", "风鹰剑"];

//绑定链接
async function bing(e) {
  if (!e.isPrivate) {
    e.reply("请私聊发送");
    return true;
  }

  // let url = e.msg.match(/authkey_ver=(.*)hk4e_cn/);

  if (!e.msg.includes("authkey_ver")) {
    return false;
  }

  //timestamp=1641338980〈=zh-cn 修复链接有奇怪符号
  e.msg = e.msg.replace(/〈=/g, "&");

  //处理参数
  let arr = new URLSearchParams(e.msg).entries();

  let params = {};
  for (let val of arr) {
    params[val[0]] = val[1];
  }

  if (!params.authkey) {
    e.reply("链接复制错误");
    return true;
  }

  //去除#/,#/log
  params.authkey = params.authkey.replace(/#\/|#\/log/g, "");

  let res = await logApi({
    size: 6,
    authkey: params.authkey,
  });

  if (res.retcode == -109) {
    e.reply("2.3版本后，反馈的链接已无法查询！请用安卓方式获取链接");
    return true;
  }

  if (res.retcode == -101) {
    e.reply("链接已失效，请重新进入游戏复制");
    return true;
  }
  if (res.retcode == 400) {
    e.reply("获取数据错误");
    return true;
  }
  if (res.retcode == -100) {
    if(e.msg.length == 1000){
      e.reply("输入法限制，链接复制不完整，请更换输入法复制完整链接");
      return true;
    }
    e.reply("链接不完整，请长按全选复制全部内容（可能输入法复制限制），或者复制的不是历史记录页面链接");
    return true;
  }
  if (res.retcode != 0) {
    e.reply("链接复制错误");
    return true;
  }

  if (res.data && res.data.list && res.data.list.length > 0) {
    await redis.set(`genshin:uid:${e.user_id}`, res.data.list[0].uid, { EX: 2592000 });
  }

  await redis.set(key + e.user_id, params.authkey, { EX: 86400 });

  if (!e.file) {
    e.reply("链接发送成功,数据生成中。。 \n数据请求可能会花费较长时间，请耐心等待。");
  }

  // logTask(e.user_id);

  e.isBing = true;


  for (let idx in reqTypeList) {
    let action = reqTypeList[idx];
    await common.sleep(500);
    e.msg = `${reqTypeList[idx]}记录更新`;
    await getLog(e);
  }

  await e.reply("统计结束，您还可回复\n【#武器记录】统计武器池数据\n【#角色统计】按卡池统计数据\n【#武器统计】按卡池统计武器");

  await common.sleep(500);
  e.msg = "角色记录";
  await getLog(e);
  return true;
}

async function logApi(param) {
  //调用一次接口判断链接是否正确
  let logUrl = "https://hk4e-api.mihoyo.com/event/gacha_info/api/getGachaLog?";
  let logParam = new URLSearchParams({
    authkey_ver: 1,
    lang: "zh-cn", //只支持简体中文
    region: "cn_gf01", //只支持国服
    gacha_type: 301,
    page: 1,
    size: 20,
    end_id: 0,
    ...param,
  }).toString();

  const response = await fetch(logUrl + logParam);
  if (!response.ok) {
    return { retcode: 400 };
  }
  const res = await response.json();

  return res;
}

async function getLog(e) {
  let msg = e.msg.replace(/#|抽卡|记录|祈愿|分析|池/g, "");
  let isSysReq = false;

  if (/更新$/.test(msg)) {
    isSysReq = true;
    msg = msg.replace("更新", "")
  }

  let type = 301;
  let typeName = "角色";
  switch (msg) {
    //数据差不多都丢失了，不提供查询
    // case '新手':$type   = 100;break;
    case "up":
    case "抽卡":
    case "角色":
    case "抽奖":
      type = 301;
      typeName = "角色";
      break;
    case "常驻":
      type = 200;
      typeName = "常驻";
      break;
    case "武器":
      type = 302;
      typeName = "武器";
      break;
  }

  //主账号uid
  let mainUid = await getUid(e.user_id, type);

  //没有uid && 不是绑定链接
  if (!mainUid && !e.isBing) {
    await sendHelp(e);
    return true;
  }

  let all = [];

  //获取authkey
  let authkey = await global.redis.get(key + e.user_id);

  //authkey 没有过期
  if (authkey) {
    //调一次接口判断是否有效
    let res = await logApi({
      gacha_type: type,
      page: 1,
      size: 20,
      end_id: 0,
      authkey: authkey,
    });
    //抽卡记录为空
    if (res.retcode == 0 && res.data.list.length == 0) {
      return true;
    }
    //有数据
    if (res.retcode == 0 && res.data.list.length > 0) {
      let uid = res.data.list[0].uid;

      //绑定链接的接口uid为准 或者链接uid相等
      if (e.isBing || uid == mainUid) {
        mainUid = uid;
        let logJson = readJson(e.user_id, uid, type);

        //判断数据是否六个月前
        if (logJson.list.length > 0) {
          let now = new Date().getTime();
          let time = new Date(logJson.list[0].time).getTime();
          //本地记录已经是180天前
          if (now - time >= 3600 * 24 * 180 * 1000) {
            //插入一条未知五星阻断之前的数据
            logJson.list.unshift({
              uid,
              gacha_type: type,
              item_id: "",
              count: "1",
              time: logJson.list[0].time,
              name: "未知",
              lang: "zh-cn",
              item_type: "角色",
              rank_type: 5,
            });
          }
        }

        //获取所有数据
        let logRes = await getApiAll(logJson.ids, authkey, type, 1, 0);
        if (logRes.hasErr) {
          e.reply(`获取${typeName}记录失败`);
          return true;
        }

        //数据合并
        if (logRes.list.length > 0) {
          all = logRes.list.concat(logJson.list);

          //保存json
          writeJson(e.user_id, uid, type, all);
        } else {
          all = logJson.list;
        }
      } else {
        //获取本地数据
        let logJson = readJson(e.user_id, mainUid, type);
        all = logJson.list;
      }
    } else {
      //过期删除key
      // global.redis.del(key + e.user_id);
      //获取本地数据
      let logJson = readJson(e.user_id, mainUid, type);
      all = logJson.list;
    }
  } else {
    let path = `data/html/genshin/gachaJson/${e.user_id}/`;
    if (!fs.existsSync(path)) {
      await sendHelp(e);
      return true;
    }

    //获取本地数据
    let logJson = readJson(e.user_id, mainUid, type);
    all = logJson.list;
  }

  if (all.length <= 0) {
    return true;
  }
  if (e.isTask) {
    return true;
  }

  //统计数据
  let data = analyse(all);
  let line = [];
  if (type == 301) {
    line = [[
      { lable: "未出五星", num: data.noFiveNum, unit: "抽" },
      { lable: "五星", num: data.fiveNum, unit: "个" },
      { lable: "五星平均", num: data.fiveAvg, unit: "抽", color: data.fiveColor },
      { lable: "小保底不歪", num: data.noWaiRate+"%", unit: "" },
    ], [
      { lable: "未出四星", num: data.noFourNum, unit: "抽" },
      { lable: "五星常驻", num: data.wai, unit: "个" },
      { lable: "UP平均", num: data.isvalidNum, unit: "抽" },
      { lable: "UP花费原石", num: data.upYs, unit: "" },
    ]];
  }
  //常驻池
  if (type == 200) {
    line = [[
      { lable: "未出五星", num: data.noFiveNum, unit: "抽" },
      { lable: "五星", num: data.fiveNum, unit: "个" },
      { lable: "五星平均", num: data.fiveAvg, unit: "抽", color: data.fiveColor },
      { lable: "五星武器", num: data.weaponNum, unit: "个" },
    ], [
      { lable: "未出四星", num: data.noFourNum, unit: "抽" },
      { lable: "四星", num: data.fourNum, unit: "个" },
      { lable: "四星平均", num: data.fourAvg, unit: "抽" },
      { lable: "四星最多", num: data.maxFour.num, unit: data.maxFour.name },
    ]];
  }
  //武器池
  if (type == 302) {
    line = [[
      { lable: "未出五星", num: data.noFiveNum, unit: "抽" },
      { lable: "五星", num: data.fiveNum, unit: "个" },
      { lable: "五星平均", num: data.fiveAvg, unit: "抽", color: data.fiveColor },
      { lable: "四星武器", num: data.weaponFourNum, unit: "个" },
    ], [
      { lable: "未出四星", num: data.noFourNum, unit: "抽" },
      { lable: "四星", num: data.fourNum, unit: "个" },
      { lable: "四星平均", num: data.fourAvg, unit: "抽" },
      { lable: "四星最多", num: data.maxFour.num, unit: data.maxFour.name },
    ]];
  }

  let hasMore = false;
  if (e.isGroup && data.fiveArr.length > 48) {
    data.fiveArr = data.fiveArr.slice(0, 48);
    hasMore = true;
  }

  if (isSysReq) {
    let sysReqIdx = reqTypeList.indexOf(msg.trim());
    // console.log(msg, reqTypeList, sysReqIdx)
    if (sysReqIdx < reqTypeList.length - 1) {
      e.reply(`${msg}记录请求完毕，开始请求${reqTypeList[sysReqIdx + 1]}记录，请稍候...`)
    } else {
      e.reply(`${msg}记录请求完毕`)
    }
  } else {
    let base64;
    base64 = await render("genshin", "gachaLog", {
      save_id: mainUid,
      uid: mainUid,
      allNum: data.allNum,
      line,
      type,
      typeName,
      firstTime: data.firstTime,
      lastTime: data.lastTime,
      fiveArr: data.fiveArr,
      hasMore,
    });

    if (base64) {
      let msg = [];
      if (e.isGroup) {
        let name = lodash.truncate(e.sender.card, { length: 12 });
        msg.push(segment.at(e.user_id, name));
      }
      msg.push(segment.image(`base64://${base64}`));

      if (e.file) {
        common.relpyPrivate(e.user_id, msg);
      } else {
        e.reply(msg);
      }
    }
    return true;
  }
}

function analyse(all) {
  let fiveArr = [];
  let fourArr = [];
  let fiveNum = 0;
  let fourNum = 0;
  let fiveLogNum = 0;
  let fourLogNum = 0;
  let noFiveNum = 0;
  let noFourNum = 0;
  let wai = 0; //歪
  let weaponNum = 0;
  let weaponFourNum = 0;
  let allNum = all.length;
  let bigNum = 0;//大保底次数

  for (let val of all) {
    if (val.rank_type == 4) {
      fourNum++;
      if (noFourNum == 0) {
        noFourNum = fourLogNum;
      }
      fourLogNum = 0;
      if (fourArr[val.name]) {
        fourArr[val.name]++;
      } else {
        fourArr[val.name] = 1;
      }
      if (val.item_type == "武器") {
        weaponFourNum++;
      }
    }
    fourLogNum++;

    if (val.rank_type == 5) {
      fiveNum++;
      if (fiveArr.length > 0) {
        fiveArr[fiveArr.length - 1].num = fiveLogNum;
      } else {
        noFiveNum = fiveLogNum;
      }
      fiveLogNum = 0;
      fiveArr.push({
        name: val.name,
        abbrName: abbrName[val.name] ? abbrName[val.name] : val.name,
        item_type: val.item_type,
        num: 0,
      });

      //歪了多少个
      if (val.item_type == "角色") {
        if (["莫娜", "七七", "迪卢克", "琴"].includes(val.name)) {
          wai++;
        }
        //刻晴up过一次
        if (val.name == "刻晴") {
          let start = new Date("2021-02-17 18:00:00").getTime();
          let end = new Date("2021-03-02 15:59:59").getTime();
          let logTime = new Date(val.time).getTime();

          if (logTime < start || logTime > end) {
            wai++;
          }
        }
      } else {
        weaponNum++;
      }
    }
    fiveLogNum++;
  }
  if (fiveArr.length > 0) {
    fiveArr[fiveArr.length - 1].num = fiveLogNum;

    //删除未知五星
    for (let i in fiveArr) {
      if (fiveArr[i].name == "未知") {
        allNum = allNum - fiveArr[i].num;
        fiveArr.splice(i, 1);
        fiveNum--;
      }
      else{
        //上一个五星是不是常驻
        let lastKey = Number(i)+1;
        if(fiveArr[lastKey] && ["莫娜", "七七", "迪卢克", "琴", "刻晴"].includes(fiveArr[lastKey].name)){
          fiveArr[i].minimum = true;
          bigNum++;
        }else{
          fiveArr[i].minimum = false;
        }
        if(!["莫娜", "七七", "迪卢克", "琴", "刻晴"].includes(fiveArr[i].name)){
          fiveArr[i].isUP = true;
        }
      }
    }
  }
  //没有五星
  else {
    noFiveNum = allNum;
  }

  //四星最多
  let four = [];
  for (let i in fourArr) {
    four.push({
      name: i,
      num: fourArr[i],
    });
  }
  four = four.sort(function (a, b) {
    return b.num - a.num;
  });

  if (four.length <= 0) {
    four.push({ name: "无", num: 0 });
  }

  let fiveAvg = 0;
  let fourAvg = 0;
  if (fiveNum > 0) {
    fiveAvg = ((allNum - noFiveNum) / fiveNum).toFixed(2);
  }
  if (fourNum > 0) {
    fourAvg = ((allNum - noFourNum) / fourNum).toFixed(2);
  }
  //有效抽卡
  let isvalidNum = 0;

  if (fiveNum > 0 && fiveNum > wai) {
    if (fiveArr.length > 0 && ["莫娜", "七七", "迪卢克", "琴", "刻晴"].includes(fiveArr[0].name)) {
      isvalidNum = (allNum - noFiveNum - fiveArr[0].num) / (fiveNum - wai);
    } else {
      isvalidNum = (allNum - noFiveNum) / (fiveNum - wai);
    }
    isvalidNum = isvalidNum.toFixed(2);
  }

  let upYs = isvalidNum * 160;
  if (upYs >= 10000) {
    upYs = (upYs / 10000).toFixed(2) + "w";
  }else{
    upYs = upYs.toFixed(0);
  }

  //小保底不歪概率
  let noWaiRate = 0;
  if (fiveNum > 0) {
    noWaiRate = (fiveNum - bigNum - wai) / (fiveNum - bigNum);
    noWaiRate = (noWaiRate * 100).toFixed(1);
  }

  let firstTime = all[all.length - 1].time.substring(0, 16),
    lastTime = all[0].time.substring(0, 16);

  let fiveColor = "";
  switch (true) {
    case fiveAvg <= 40:
      fiveColor = "red";
      break;
    case fiveAvg <= 50:
      fiveColor = "orange";
      break;
    case fiveAvg <= 60:
      fiveColor = "purple";
      break;
    case fiveAvg <= 70:
      fiveColor = "blue";
      break;
  }

  return {
    allNum,
    noFiveNum,
    noFourNum,
    fiveNum,
    fourNum,
    fiveAvg,
    fourAvg,
    wai,
    isvalidNum,
    maxFour: four[0],
    weaponNum,
    weaponFourNum,
    firstTime,
    lastTime,
    fiveArr,
    fiveColor,
    upYs,
    noWaiRate,
  };
}

//读取本地json
function readJson(user_id, uid, type) {
  let logJson = [];
  let ids = []; //log id集合
  let file = `data/html/genshin/gachaJson/${user_id}/${uid}/${type}.json`;
  if (fs.existsSync(file)) {
    //获取本地数据 进行数据合并
    logJson = JSON.parse(fs.readFileSync(file, "utf8"));
    for (let val of logJson) {
      if (val.id) {
        ids.push(val.id);
      }
    }
  }

  return { list: logJson, ids };
}

function writeJson(user_id, uid, type, data) {
  let path = "data/html/genshin/gachaJson/";
  if (!fs.existsSync(`${path}${user_id}`)) {
    fs.mkdirSync(`${path}${user_id}`);
  }
  if (!fs.existsSync(`${path}${user_id}/${uid}`)) {
    fs.mkdirSync(`${path}${user_id}/${uid}`);
  }
  let file = `${path}${user_id}/${uid}/${type}.json`;
  fs.writeFileSync(file, JSON.stringify(data));
}

//递归获取所有数据
async function getApiAll(ids, authkey, type, page = 1, end_id = 0) {
  let res = await logApi({
    gacha_type: type,
    page: page,
    size: 20,
    end_id: end_id,
    authkey: authkey,
  });

  if (res.retcode != 0) {
    return { hasErr: true, list: [] };
  }

  if (res.data.list.length <= 0) {
    return { hasErr: false, list: [] };
  }

  let list = [];
  for (let val of res.data.list) {
    if (ids.includes(val.id)) {
      return { hasErr: false, list: list };
    } else {
      list.push(val);
      end_id = val.id;
    }
  }
  page++;

  if (page % 3 == 0) {
    await common.sleep(500);
  } else {
    await common.sleep(300);
  }

  let res2 = await getApiAll(ids, authkey, type, page, end_id);

  list = list.concat(res2.list);

  return { hasErr: res2.hasErr, list: list };
}

async function getUid(user_id, type) {
  //从redis获取
  let uid = await redis.get(`genshin:uid:${user_id}`);

  let path = `data/html/genshin/gachaJson/${user_id}/`;

  if (!fs.existsSync(path)) {
    return uid;
  }

  //判断文件最后修改时间
  let files = fs.readdirSync(path);
  if (!files) {
    return uid;
  }

  if (files.length == 1) {
    return files[0];
  }

  if (uid) {
    return uid;
  }

  let uidArr = [];
  for (let uid of files) {
    if (!fs.existsSync(path + uid + "/" + type + ".json")) {
      continue;
    }

    let tmp = fs.statSync(path + uid + "/" + type + ".json");
    uidArr.push({
      uid,
      mtimeMs: tmp.mtimeMs,
    });
  }
  if (uidArr.length <= 0) {
    return false;
  }
  uidArr = uidArr.sort(function (a, b) {
    return b.mtimeMs - a.mtimeMs;
  });

  return uidArr[0].uid;
}

function help(e) {
  e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助.png`));
  return true;
}

function helpPort(e) {
  let msg = e.msg.replace(/#|帮助/g, "");

  if (msg == "电脑") {
    e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助-电脑.png`));
    setTimeout(() => {
      e.reply(`%userprofile%\\AppData\\LocalLow\\miHoYo\\原神`);
    }, 1000);
  } else {
    e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助-${msg}.png`));
  }

  return true;
}

async function sendHelp(e) {
  if (e.isGroup) {
    let key = `genshin:helpLimit:${e.group_id}`;
    let res = await global.redis.get(key);
    let name = lodash.truncate(e.sender.card, { length: 8 });

    if (res) {
      e.reply([segment.at(e.user_id, name), "\n请先发送链接"]);
    } else {
      e.reply([segment.at(e.user_id, name), segment.image(`file:///${_path}/resources/logHelp/记录帮助.png`)]);
      await global.redis.set(key, "true", { EX: 1200 });
    }
  } else {
    e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助.png`));
  }
}

async function bingFile(e) {
  if (!e.isPrivate) {
    return;
  }

  if (!e.file || !e.file.name.includes("txt")) {
    return;
  }

  let path = "data/file/";

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
  if (!fs.existsSync(`${path}output_log/`)) {
    fs.mkdirSync(`${path}output_log/`);
  }

  let textPath = `${path}output_log/${e.user_id}.txt`;

  //获取文件下载链接
  let fileUrl = await e.friend.getFileUrl(e.file.fid);
  //下载output_log.txt文件
  const response = await fetch(fileUrl);
  const streamPipeline = promisify(pipeline);
  await streamPipeline(response.body, fs.createWriteStream(textPath));

  //读取txt文件
  let txt = fs.readFileSync(textPath, "utf-8");
  let url = txt.match(/auth_appid=webview_gacha(.*)hk4e_cn/);

  if (!url || !url[0]) {
    common.relpyPrivate(e.user_id, "请先游戏里打开抽卡记录页面，再发送文件");
    return true;
  }

  common.relpyPrivate(e.user_id, "日志文件发送成功,数据生成中。。");

  //删除文件
  fs.unlink(textPath, (err) => {
  });

  e.msg = "authkey_ver=1&" + url[0];
  await bing(e);

  return true;
}

//更新抽卡记录
async function logTask(user_id = "") {
  let keys;
  if (user_id) {
    keys = [`${key}${user_id}`];
  } else {
    keys = await global.redis.keys(`${key}*`);
  }

  for (let val of keys) {
    let ttl = await global.redis.ttl(val);

    let time = ttl - 7200;
    if (time < 0) {
      time = 0;
    }

    let e = {
      user_id: lodash.last(val.split(":")),
      isBing: true,
      isTask: true,
      reply: async (msg) => {
        Bot.logger.info(msg);
      },
    };

    let hasTask = await global.redis.get(`genshin:cardLog:logTask:${e.user_id}`);
    if (hasTask) {
      continue;
    }

    setTimeout(async () => {
      Bot.logger.mark(`更新抽卡记录:${e.user_id}`);

      e.msg = "角色记录";
      await getLog(e);

      await sleep(500);
      e.msg = "常驻记录";
      await getLog(e);

      await sleep(500);
      e.msg = "武器记录";
      await getLog(e);
    }, time * 1000);

    global.redis.set(`genshin:cardLog:logTask:${e.user_id}`, "true", { EX: 7200 });
  }
}

export async function history(e) {
  let msg = e.msg.replace(/#|抽卡|统计|池/g, "");

  let type = 301;
  let typeName = "角色";
  switch (msg) {
    case "up":
    case "抽卡":
    case "角色":
    case "抽奖":
      type = 301;
      typeName = "角色";
      break;
    case "常驻":
      type = 200;
      typeName = "常驻";
      break;
    case "武器":
      type = 302;
      typeName = "武器";
      break;
  }

  //主账号uid
  let mainUid = await getUid(e.user_id, 301);

  //没有uid && 不是绑定链接
  if (!mainUid && !e.isBing) {
    await sendHelp(e);
    return true;
  }

  let path = `data/html/genshin/gachaJson/${e.user_id}/`;

  if (!fs.existsSync(path)) {
    await sendHelp(e);
    return true;
  }

  //获取本地数据
  let logJson = readJson(e.user_id, mainUid, type);
  let all = logJson.list;

  if (all.length <= 0) {
    return true;
  }

  //统计数据
  let pool = analyseHistory(all, e, type);

  if (!pool) {
    return true;
  }

  let base64;

  base64 = await render(
    "genshin",
    "gachaHistory",
    {
      save_id: mainUid,
      uid: mainUid,
      pool: pool,
      typeName: typeName,
    }
    // "png"
  );

  msg = [];

  if (e.isGroup) {
    let name = lodash.truncate(e.sender.card, { length: 12 });
    msg.push(segment.at(e.user_id, name));
  }
  msg.push(segment.image(`base64://${base64}`));

  if (e.file) {
    common.relpyPrivate(e.user_id, msg);
  } else {
    e.reply(msg);
  }

  return true;
}

function analyseHistory(all, e, type) {
  let file = `config/genshin/pool/${type}.json`;

  let poolJson = JSON.parse(fs.readFileSync(file, "utf8")).reverse();
  all = all.reverse();

  let pool = {};
  let fiveNum = 0;
  let fourNum = 0;

  for (let row of all) {
    //判断属于卡池
    let time = new Date(row.time).getTime();

    b: for (let i in poolJson) {
      if (time >= poolJson[i].start && time <= poolJson[i].end) {
        if (!pool[poolJson[i].start]) {
          pool[poolJson[i].start] = {
            count: 1,
            list: [],
            name: poolJson[i].name,
            five: poolJson[i].five,
            start: format("yyyy.MM.dd", new Date(poolJson[i].start)),
            end: format("yyyy.MM.dd", new Date(poolJson[i].end)),
          };
        } else {
          pool[poolJson[i].start].count++;
        }
        if (row.rank_type == 5) {
          if (row.name != "未知") {
            pool[poolJson[i].start].list.push({
              name: row.name,
              rank_type: row.rank_type,
              item_type: row.item_type,
              time: time,
              num: fiveNum + 1,
            });
          }
          fiveNum = 0;
          fourNum++;
        } else if (row.rank_type == 4) {
          pool[poolJson[i].start].list.push({
            name: row.name,
            rank_type: row.rank_type,
            item_type: row.item_type,
            time: time,
            num: fourNum + 1,
          });
          fourNum = 0;
          fiveNum++;
        } else {
          fiveNum++;
          fourNum++;
        }
        break b;
      } else {
        delete poolJson[i];
      }
    }
  }

  let tmp = [];
  for (let i in pool) {
    tmp.push(pool[i]);
  }
  pool = tmp.reverse();

  if (pool.length <= 0) {
    return false;
  }

  let line = 0;
  let res = [];
  for (let i in pool) {
    line++;
    pool[i].role = {};

    pool[i].five = pool[i].five
      .map((v) => {
        if (v == "魈") return v;
        return abbrName[v] ? abbrName[v] : v;
      })
      .join("、");
    for (let val of pool[i].list) {
      if (!pool[i].role[val.name]) {
        pool[i].role[val.name] = {
          name: val.name,
          rank_type: val.rank_type,
          item_type: val.item_type,
          count: 1,
        };
      } else {
        pool[i].role[val.name].count++;
      }
    }
    delete pool[i].list;

    //排序
    for (let j in pool[i].role) {
      let sort = (pool[i].role[j].rank_type - 3) * 1000 + pool[i].role[j].count;
      if (role5.includes(pool[i].role[j].name)) {
        sort--;
      }
      if (weapon5.includes(pool[i].role[j].name)) {
        sort--;
      }
      if (pool[i].role[j].item_type == "角色" && pool[i].role[j].rank_type == 5) {
        sort += 1000;
      }
      pool[i].role[j].sort = sort;
    }

    pool[i].roleNum = Object.keys(pool[i].role).length;
    pool[i].role = lodash.orderBy(pool[i].role, ["sort"], ["desc"]);

    res.push(pool[i]);
    line += Math.ceil(pool[i].roleNum / 6);

    if (e.isGroup && line >= 12) {
      break;
    }
  }

  // if (line - pool.length <= 0) {
  //   return false;
  // }

  return res;
}

export { bing, bingFile, getLog, help, helpPort, logTask };
