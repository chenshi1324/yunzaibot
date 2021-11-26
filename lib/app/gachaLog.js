import { segment } from "oicq";
import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { render } from "../render.js";
import { abbr } from "../../config/genshin/roleId.js";

const _path = process.cwd().trim("\\lib");
let key = "genshin:cardLog:authkey:";
//绑定链接
async function bing(e) {
  if (!e.isPrivate) {
    return true;
  }

  let url = e.msg.match(/authkey_ver=(.*)hk4e_cn/);

  if (!url) {
    return true;
  }

  //处理参数
  let arr = new URLSearchParams(url[0]).entries();
  let params = {};
  for (let val of arr) {
    params[val[0]] = val[1];
  }
  if (!params.authkey) {
    return true;
  }
  let res = await logApi({
    size: 6,
    authkey: params.authkey,
  });

  if (res.retcode == -109) {
    e.reply("2.3版本后，反馈的链接已无法查询！");
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
  if (res.retcode != 0) {
    e.reply("链接复制错误");
    return true;
  }

  await redis.set(key + e.user_id, params.authkey, { EX: 86400 });

  if (!e.file) {
    e.reply("链接发送成功");
  }

  e.isBing = true;

  e.msg = "角色记录";
  await getLog(e);

  await sleep(500);
  e.msg = "常驻记录";
  await getLog(e);

  await sleep(500);
  e.msg = "武器记录";
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
  let msg = e.msg.replace(/#|抽卡|记录|祈愿/g, "");

  let type = 301;
  let typeName = "角色";
  switch (msg) {
    //数据差不多都丢失了，不提供查询
    // case '新手':$type   = 100;break;
    case "up":
    case "抽卡":
    case "角色":
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

  //统计数据
  let data = analyse(all);
  let line = [];
  if (type == 301) {
    line = [
      [
        { lable: "未出五星", num: data.noFiveNum + "抽" },
        { lable: "五星", num: data.fiveNum + "个" },
        { lable: "五星平均", num: data.fiveAvg + "抽", color: data.fiveColor },
        { lable: "四星平均", num: data.fourAvg + "抽" },
      ],
      [
        { lable: "未出四星", num: data.noFourNum + "抽" },
        { lable: "歪了", num: data.wai + "个" },
        { lable: "有效抽卡", num: data.isvalidNum + "抽" },
        { lable: "四星最多", num: data.maxFour.name + data.maxFour.num + "个" },
      ],
    ];
  }
  //常驻池
  if (type == 200) {
    line = [
      [
        { lable: "未出五星", num: data.noFiveNum + "抽" },
        { lable: "五星", num: data.fiveNum + "个" },
        { lable: "五星平均", num: data.fiveAvg + "抽", color: data.fiveColor },
        { lable: "四星", num: data.fourNum + "个" },
      ],
      [
        { lable: "未出四星", num: data.noFourNum + "抽" },
        { lable: "五星武器", num: data.weaponNum + "个" },
        { lable: "四星平均", num: data.fourAvg + "抽" },
        { lable: "四星最多", num: data.maxFour.name + data.maxFour.num + "个" },
      ],
    ];
  }
  //武器池
  if (type == 302) {
    line = [
      [
        { lable: "未出五星", num: data.noFiveNum + "抽" },
        { lable: "五星", num: data.fiveNum + "个" },
        { lable: "五星平均", num: data.fiveAvg + "抽", color: data.fiveColor },
        { lable: "四星武器", num: data.weaponFourNum + "个" },
      ],
      [
        { lable: "未出四星", num: data.noFourNum + "抽" },
        { lable: "四星", num: data.fourNum + "个" },
        { lable: "四星平均", num: data.fourAvg + "抽" },
        { lable: "四星最多", num: data.maxFour.name + data.maxFour.num + "个" },
      ],
    ];
  }

  let hasMore = false;
  if (e.isGroup && data.fiveArr.length > 24) {
    data.fiveArr = data.fiveArr.slice(0, 24);
    hasMore = true;
  }

  let base64 = await render(
    "genshin",
    "gachaLog",
    {
      save_id: mainUid,
      uid: mainUid,
      allNum: data.allNum,
      line,
      type,
      typeName,
      lastTime: data.lastTime,
      fiveArr: data.fiveArr,
      hasMore,
    },
    "png"
  );

  if (base64) {
    //发送文件方式 但是不是好友
    if(e.file && !e.isFriend){

    }else{
      e.reply(segment.image(`base64://${base64}`));
    }
  }
  return true;
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
        abbrName: abbr[val.name] ? abbr[val.name] : val.name,
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
        fiveArr.splice(i, 1);
        fiveNum--;
        allNum = allNum - fiveArr[i].num;
      }
    }
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

  let fiveAvg = ((allNum - noFiveNum) / fiveNum).toFixed(2);
  let fourAvg = ((allNum - noFourNum) / fourNum).toFixed(2);
  //有效抽卡
  let isvalidNum = 0;

  if (fiveArr.length > 0 && ["莫娜", "七七", "迪卢克", "琴", "刻晴"].includes(fiveArr[0].name)) {
    isvalidNum = (allNum - noFiveNum - fiveArr[0].num) / (fiveNum - wai);
  } else {
    isvalidNum = (allNum - noFiveNum) / (fiveNum - wai);
  }
  isvalidNum = isvalidNum.toFixed(2);

  let lastTime = all[0].time.substring(5);

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
    lastTime,
    fiveArr,
    fiveColor,
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
    await sleep(500);
  } else {
    await sleep(200);
  }

  let res2 = await getApiAll(ids, authkey, type, page, end_id);

  list = list.concat(res2.list);

  return { hasErr: res2.hasErr, list: list };
}

async function getUid(user_id, type) {
  //从redis获取
  let res = await redis.get(`genshin:uid:${user_id}`);
  if (res) {
    return res;
  }

  let path = `data/html/genshin/gachaJson/${user_id}/`;

  if (!fs.existsSync(path)) {
    return false;
  }

  //判断文件最后修改时间
  let files = fs.readdirSync(path);
  if (!files) {
    return false;
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

  if (msg == "苹果") {
    e.reply("苹果手机暂不支持");
  }else{
    e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助-${msg}.png`));
  }

  return true;
}

async function sendHelp(e) {
  if (e.isGroup) {
    let key = `genshin:helpLimit:${e.group_id}`;
    let res = await global.redis.get(key);
    if (res) {
      e.reply("请先发送链接");
    } else {
      e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助.png`));
      await global.redis.set(key, "true", { EX: 300 });
    }
  } else {
    e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助.png`));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bingFile(e) {
  if (!e.isPrivate) {
    return;
  }

  if (!e.file || !e.file.name.includes("txt")) {
    return;
  }

  e.isFriend = Bot.fl.get(e.from_id);

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
  let url = txt.match(/authkey_ver=(.*)hk4e_cn/);

  if (!url) {
    if(e.isFriend){
      e.reply("请先游戏里打开抽卡记录页面，再发送文件");
    }
    return true;
  }

  if(e.isFriend){
    e.reply("日志文件发送成功");
  }

  //删除文件
  fs.unlink(textPath, (err) => {});

  e.msg = url[0];
  await bing(e);

  return true;
}

export { bing, bingFile, getLog, help, helpPort };
