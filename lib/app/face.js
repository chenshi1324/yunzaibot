import { segment } from "oicq";
import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import sizeOf from "image-size";
import { render } from "../render.js";
import lodash from "lodash";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
var AipOcrClient = require("baidu-aip-sdk").ocr;
let baiduClient;

const _path = process.cwd();

export const rule = {
  get: {
    reg: "noCheck",
    priority: 10000,
    describe: "发送已添加的表情文字",
  },
  add: {
    reg: "#*添加(.*)",
    priority: 10001,
    describe: "【添加哈哈】添加内容",
  },
  addContext: {
    reg: "noCheck",
    priority: 10002,
    describe: "回复添加的内容",
  },
  del: {
    reg: "^#*删除(.*)$",
    priority: 10003,
    describe: "【删除哈哈】删除添加的内容",
  },
  list: {
    reg: "^#*表情列表[0-9]*$",
    priority: 10004,
    describe: "【表情列表，表情列表1】添加表情列表",
  },
  listFuzzy: {
    reg: "^#*表情(.*)$",
    priority: 10005,
    describe: "【表情哈哈】添加表情搜索",
  },
  random: {
    reg: "noCheck",
    priority: 10006,
    describe: "斗图，需要百度ocr",
  },
};

if (!fs.existsSync(`./data/html/face/`)) {
  fs.mkdirSync(`./data/html/face/`);
}

if (!fs.existsSync(`./data/html/face/list/`)) {
  fs.mkdirSync(`./data/html/face/list/`);
}

let faceArr = {}; //所有表情对象
let context = {}; //添加图片上下文
let contextTimer = {};
let textArr = {};

//添加哈哈[图片] or 添加哈哈 哈哈哈
export async function add(e) {
  if (!e.message) {
    return false;
  }

  if (!e.toString().includes("添加") || e.msg.includes("cookie")) {
    return;
  }

  let Msg = [];
  let head;
  for (let val of e.message) {
    if (val.type == "text" && /^[#|\s|\r]*添加(.*)/g.test(val.text)) {
      val.isAdd = true;
      val.text = val.text.replace(/#|＃|图片|表情|添加|删除|列表/g, "");
      head = val;
    } else {
      if (val.type == "at") {
        if (val.qq == BotConfig.account.qq) {
          continue;
        }
        delete val.text;
      }
      Msg.push(val);
    }
  }

  Msg.unshift(head);

  if (!Msg[0] || Msg[0].type != "text" || !Msg[0].isAdd || (Msg.length == 1 && !Msg[0].text)) {
    return;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
    if (group_id) {
      e.member = Bot.pickGroup(group_id).pickMember(e.user_id);
    }
  }

  if (!group_id) {
    return true;
  }

  if (e.groupConfig.imgAddLimit==2) {
    if (!e.isMaster) {
      e.reply(`只有主人才能添加`);
      return true;
    }
  }
  if (e.groupConfig.imgAddLimit==1 && !e.isMaster) {
    if(!Bot.gml.has(group_id)){
      return true;
    }
    if (!Bot.gml.get(group_id).get(e.user_id)) {
      return true;
    }
    if (!e.member.is_admin) {
      e.reply(`只有管理员才能添加`);
      return true;
    }
  }

  //直接添加图片
  if (Msg.length == 2 && Msg[1].type == "image" && Msg[0].text) {
    downImg(e, group_id, Msg);
    return true;
  }

  var re = new RegExp("{at:" + BotConfig.account.qq + "}", "g");

  //上下文添加
  context[e.user_id] = {
    text: e
      .toString()
      .replace(re, "")
      .replace(/#|＃|图片|表情|添加|删除|列表/g, "")
      .trim(),
    msg: Msg,
  };

  let name = lodash.truncate(e.sender.card, { length: 8 });

  if (!context[e.user_id].text) {
    delete context[e.user_id];
    e.reply([segment.at(e.user_id, name), "\n没有输入关键字"]);
    return true;
  }

  Bot.logger.mark(`[${e.group_name}] 添加:${context[e.user_id].text}`);

  e.reply([segment.at(e.user_id, name), `请发送内容`]);

  contextTimer[e.user_id] = setTimeout(()=>{
    if(context[e.user_id]){
      delete context[e.user_id];
      e.reply([segment.at(e.user_id, name), `添加已取消`]);
    }
  },120000);

  return true;
}

//上下文添加
export async function addContext(e) {
  if (!context[e.user_id] || !e.message) {
    return;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (context[e.user_id]?.msg[0]?.text.trim() && e.message.length == 1 && e.message[0].type == "image") {
    let Msg = [{ ...context[e.user_id] }];
    Msg.push(e.message[0]);
    downImg(e, group_id, Msg);
    clearTimeout(contextTimer[e.user_id]);
    delete contextTimer[e.user_id];
    delete context[e.user_id];
    return true;
  }

  if (!textArr[group_id]) {
    getTextData(group_id);
  }

  //添加消息处理
  for (let i in e.message) {
    if (e.message[i].type == "at") {
      if (e.message[i].qq == BotConfig.account.qq) {
        e.reply("不能@我！");
        return true;
      }
      e.message[i].text = e.message[i].text.replace(/^@/, "");
    }
  }

  textArr[group_id].set(context[e.user_id].text.trim(), e.message);
  let name = lodash.truncate(e.sender.card, { length: 8 });
  e.reply([segment.at(e.user_id, name), "\n添加成功：", ...context[e.user_id].msg]);
  Bot.logger.mark(`[${e.group_name}] 添加成功:${context[e.user_id].text}`);

  //覆盖删除下载的图片表情
  if (faceArr[group_id] && faceArr[group_id].get(context[e.user_id].text)) {
    let face = faceArr[group_id].get(context[e.user_id].text);
    let img = `./data/face/${group_id}/${context[e.user_id].text}.${face.suffix}`;
    fs.unlinkSync(img);
    faceArr[group_id].delete(context[e.user_id].text);
  }

  clearTimeout(contextTimer[e.user_id]);
  delete context[e.user_id];
  delete contextTimer[e.user_id];

  let path = "data/textJson/";

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  let obj = {};
  for (let [k, v] of textArr[group_id]) {
    obj[k] = v;
  }

  fs.writeFileSync(`${path}${group_id}.json`, JSON.stringify(obj, "", "\t"));

  return true;
}

//下载图片
async function downImg(e, group_id, Msg) {
  let imgMaxSize = e.groupConfig.imgMaxSize || 1; //表情图片最大1m

  //过滤特殊字符
  let imgName = Msg[0].text
    .toString()
    .replace(/\.|\\|\/|:|\*|\?|<|>|\|"/g, "")
    .trim();

  if (!imgName) {
    e.reply("添加失败");
    return true;
  }

  let path = "data/face/";

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
  if (!fs.existsSync(`${path}${group_id}`)) {
    fs.mkdirSync(`${path}${group_id}`);
  }

  const response = await fetch(Msg[1].url);

  let name = lodash.truncate(e.sender.card, { length: 8 });

  if (!response.ok) {
    e.reply("图片下载失败。。");
    return true;
  }

  if (response.headers.get("size") > 1024 * 1024 * imgMaxSize) {
    e.reply([segment.at(e.user_id, name), "添加失败：表情太大了"]);
    return true;
  }

  let type = "jpg";
  if (response.headers.get("content-type") == "image/gif") {
    type = "gif";
  }

  const streamPipeline = promisify(pipeline);
  await streamPipeline(response.body, fs.createWriteStream(`${path}${group_id}/${imgName}.${type}`));
  Bot.logger.mark(`[${e.group_name}] 添加成功:${imgName}`);

  setGroupId(e);

  e.reply([segment.at(e.user_id, name), `\n添加成功：${imgName}`]);

  if (!faceArr[group_id]) {
    getFileData(group_id);
  } else {
    faceArr[group_id].set(imgName, { suffix: type });
  }

  return true;
}

export async function get(e) {
  if (!e.message) {
    return;
  }

  if (context[e.user_id]) {
    return;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (!group_id) {
    return false;
  }

  let res = getImg(e, group_id);

  if (!res) {
    if (!textArr[group_id]) {
      getTextData(group_id);
    }

    if (textArr[group_id].size <= 0) {
      return false;
    }

    let key = e.toString().replace(/#|＃/g, "");
    key = key.replace(`{at:${BotConfig.account.qq}}`, "").trim();

    let text = textArr[group_id].get(key);
    if (textArr[group_id] && text) {
      let sendMsg = [];
      for (let val of text) {
        //避免风控。。
        if (val.type == "image") {
          let tmp = segment.image(val.url);
          tmp.asface = val.asface;
          sendMsg.push(tmp);
        } else if (val.type == "at") {
          let tmp = segment.at(val.qq);
          sendMsg.push(tmp);
        } else {
          sendMsg.push(val);
        }
      }
      e.reply(sendMsg);
      setGroupId(e);
      return true;
    }
  } else {
    return true;
  }

  return false;
}

function getImg(e, group_id) {
  if (!faceArr[group_id]) {
    getFileData(group_id);
  }

  if (faceArr[group_id].size <= 0) {
    return false;
  }

  if (!e.msg || e.img) {
    return;
  }

  // if (e.msg.replace(/[\u4e00-\u9fa5]/g, "*").length > 8) {
  //   return false;
  // }

  let msg = e.msg.replace(/#|＃|\./g, "");

  let face = faceArr[group_id].get(msg);

  if (!face) {
    return false;
  }

  setGroupId(e);

  let img = `/data/face/${group_id}/${msg}.${face.suffix}`;

  var dimensions = sizeOf(`.${img}`);
  let tmp = dimensions.width / dimensions.height;

  if (dimensions.height > 150 && ((tmp > 0.6 && tmp < 1.4) || tmp > 2.5)) {
    msg = segment.image(`file:///${_path}${img}`);
    msg.asface = true;
    e.reply(msg);
  } else {
    e.reply(segment.image(`file:///${_path}${img}`));
  }

  return true;
}

function getFileData(group_id) {
  faceArr[group_id] = new Map();

  let path = `./data/face/${group_id}/`;

  if (!fs.existsSync(path)) {
    return;
  }

  let file = fs.readdirSync(path);

  if (file.length <= 0) {
    return;
  }

  for (let val of file) {
    let tmp = val.split(".");

    faceArr[group_id].set(tmp[0], {
      suffix: tmp[1],
    });
  }
}

function getTextData(group_id) {
  textArr[group_id] = new Map();

  let path = `./data/textJson/${group_id}.json`;

  if (!fs.existsSync(path)) {
    return;
  }

  let textJson = JSON.parse(fs.readFileSync(path, "utf8"));

  textArr[group_id] = new Map(Object.entries(textJson));
}

export async function del(e) {
  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
    if (group_id) {
      e.member = Bot.pickGroup(group_id).pickMember(e.user_id);
    }
  }

  if (!group_id) {
    return false;
  }

  if (!faceArr[group_id]) {
    getFileData(group_id);
  }
  if (!textArr[group_id]) {
    getTextData(group_id);
  }

  var re = new RegExp("{at:" + BotConfig.account.qq + "}", "g");

  let msg = e
    .toString()
    .replace(re, "")
    .replace(/#|＃|图片|表情|添加|删除|列表/g, "")
    .trim();

  if (!msg) {
    return false;
  }

  if (e.groupConfig.imgAddLimit==2) {
    if (!e.isMaster) {
      e.reply(`只有主人才能删除`);
      return true;
    }
  }
  if (e.groupConfig.imgAddLimit==1 && !e.isMaster) {
    if(!Bot.gml.has(group_id)){
      return true;
    }
    if (!Bot.gml.get(group_id).get(e.user_id)) {
      return true;
    }
    if (!e.member.is_admin) {
      e.reply(`只有管理员才能删除`);
      return true;
    }
  }

  if (faceArr[group_id].get(msg)) {
    let img = `./data/face/${group_id}/${msg}.${faceArr[group_id].get(msg).suffix}`;
    fs.unlinkSync(img);
    faceArr[group_id].delete(msg);
  } else if (textArr[group_id].get(msg)) {
    textArr[group_id].delete(msg);
    let obj = {};
    for (let [k, v] of textArr[group_id]) {
      obj[k] = v;
    }
    fs.writeFileSync(`./data/textJson/${group_id}.json`, JSON.stringify(obj, "", "\t"));
  } else {
    return true;
  }

  setGroupId(e);

  e.reply("删除成功：" + msg);

  Bot.logger.mark(`[${e.group_name}] 删除成功:${msg}`);

  return true;
}

export async function list(e) {
  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (!group_id) {
    return false;
  }

  setGroupId(e);

  let page = e.msg.replace(/#|表情列表/g, "").trim();
  let pageSize = 24;
  if (!page) {
    page = 1;
  }

  let path = `./data/face/${group_id}/`;
  if (!fs.existsSync(path)) {
    e.reply("暂无表情");
    return true;
  }

  let face = fs.readdirSync(path);

  if (face.length <= 0) {
    e.reply("暂无表情");
    return true;
  }

  //按时间顺序
  let faceArr = [];
  for (let val of face) {
    let tmp = fs.statSync(path + val);
    faceArr.push({
      val,
      mtimeMs: tmp.mtimeMs,
    });
  }
  faceArr = faceArr.sort(function (a, b) {
    return b.mtimeMs - a.mtimeMs;
  });

  let allNum = faceArr.length;
  faceArr = pagination(page, pageSize, faceArr);

  if (faceArr.length <= 0) {
    e.reply("没有了");
    return true;
  }

  face = [];
  for (let val of faceArr) {
    face.push(val.val);
  }

  let base64 = await render("face", "list", {
    save_id: group_id,
    face,
    group_id: group_id,
    total: Math.ceil(allNum / pageSize),
    page,
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true;
}

export async function listFuzzy(e) {
  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (!group_id) {
    return false;
  }

  setGroupId(e);

  let msg = e.msg.replace(/#|表情|列表/g, "");

  if (!msg) {
    return true;
  }

  let pageSize = 48;
  let page = 1;

  let path = `./data/face/${group_id}/`;
  if (!fs.existsSync(path)) {
    return true;
  }

  let face = fs.readdirSync(path);

  if (face.length <= 0) {
    return true;
  }

  //按时间顺序
  let faceArr = [];
  for (let val of face) {
    let tmp = val.split(".")[0];
    if (!tmp.includes(msg)) {
      continue;
    }
    tmp = fs.statSync(path + val);

    faceArr.push({
      val,
      mtimeMs: tmp.mtimeMs,
    });
  }

  if (faceArr.length <= 0) {
    return true;
  }
  faceArr = lodash.orderBy(faceArr, ["mtimeMs"], ["desc"]);

  let allNum = faceArr.length;
  faceArr = pagination(page, pageSize, faceArr);

  if (faceArr.length <= 0) {
    // e.reply("没有了");
    return true;
  }

  face = [];
  for (let val of faceArr) {
    face.push(val.val);
  }

  let base64 = await render("face", "list", {
    save_id: group_id,
    face,
    group_id: group_id,
    total: Math.ceil(allNum / pageSize),
    page,
  });

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }

  return true;
}

async function getGroupId(e) {
  if (e.sender.group_id) {
    return e.sender.group_id;
  }

  //redis获取
  let key = `Yunzai:group_id:${e.user_id}`;
  let group_id = await global.redis.get(key);
  if (group_id) {
    return group_id;
  }

  let list = Bot.gl.values();
  for (let val of list) {
    let group = Bot.pickGroup(val);

    let member = await group.pickMember(e.user_id);

    if (member) {
      return val.group_id;
    }
  }

  return false;
}

async function setGroupId(e) {
  if (!e.isGroup) {
    return;
  }

  let key = `Yunzai:group_id:${e.user_id}`;
  global.redis.set(key, e.group_id.toString(), {
    EX: 1209600,
  });
}

//数组分页
function pagination(pageNo, pageSize, array) {
  var offset = (pageNo - 1) * pageSize;
  return offset + pageSize >= array.length ? array.slice(offset, array.length) : array.slice(offset, offset + pageSize);
}

//随机表情
export async function random(e) {
  if (!e.img || !e.groupConfig.imgRate || !BotConfig.BaiduOcr || !BotConfig.BaiduOcr.APP_ID) {
    return;
  }
  if (e.img.length > 1) {
    return;
  }
  if (!e.message[0].asface) {
    return;
  }
  //偷表情
  if (lodash.random(0, 300) <= 1) {
    let msgd = segment.image(e.img[0]);
    msgd.asface = true;
    e.reply(msgd);
    return true;
  }
  if (lodash.random(0, 100) > e.groupConfig.imgRate) {
    return;
  }

  //百度识图得到关键字
  let keyWord = await baiduOcr(e);
  if (!keyWord) return;

  //关键字获取图片
  let iamges = await getRandomImg(keyWord);
  if (!iamges) return;

  Bot.logger.mark(`[${e.group_name}] 表情：${keyWord}`);

  let msg = segment.image(iamges);
  msg.asface = true;
  e.reply(msg);

  return true;
}

//根据关键词随机获取表情
export async function getRandomImg(keyWord, page = 1, type = 1) {
  let url;
  switch (type) {
    case 1:
      url = `https://www.pkdoutu.com/search?keyword=${keyWord}&page=${page}`;
      break;
    case 2:
      url = `https://fabiaoqing.com/search/bqb/keyword/${keyWord}/type/bq/page/${page}.html`;
      break;
  }

  let response = {};
  try {
    response = await fetch(url);
  } catch (error) {
    Bot.logger.mark("获取表情失败");
    return;
  }
  if (!response.ok) {
    Bot.logger.mark("获取表情失败");
    return;
  }

  const body = await response.text();

  let iamges = body.match(/data-original="(http[s]?:\/\/.*?)"/g);
  if (!iamges || iamges.length <= 0) {
    return;
  }

  iamges = iamges.filter((item) => !item.includes("oss"));
  iamges = lodash.sample(iamges).replace(/data-original="|"|'/g, "");

  return iamges;
}

//百度通用文字识别
async function baiduOcr(e) {
  let pattern =
    /LV|lv|群|管理|扫一扫|二维码|嘿|伤害|元素|攻击|爆|上限|生命|防御|百分|染血|宗室|斗士|少女|魔女|渡火|野花|雷|\+|%|操|图|色|涩|妈|母|死|id|ID|唯|★|☆/g;

  let key = `Yunzai:baiduOcr:${e.toString()}`;
  let resRedis = await redis.get(key);
  if (resRedis) {
    redis.expire(key, 3600 * 72);
    if (pattern.test(resRedis)) {
      return;
    }
    return resRedis;
  }

  if (!baiduClient) {
    // 新建一个对象，建议只保存一个对象调用服务接口
    baiduClient = new AipOcrClient(BotConfig.BaiduOcr.APP_ID, BotConfig.BaiduOcr.API_KEY, BotConfig.BaiduOcr.SECRET_KEY);
  }

  var url = e.img[0];

  // 调用通用文字识别, 图片参数为远程url图片
  let res = await baiduClient.generalBasicUrl(url).catch(function (err) {
    Bot.logger.mark(`表情识图错误 :${err}`);
    return;
  });

  if (!res || !res.words_result || res.words_result.length <= 0) {
    return;
  }

  let word = lodash.map(res.words_result, "words");

  if (word.length > 4) {
    return;
  }

  let index = 0;

  for (let i in word) {
    if (pattern.test(word[i])) {
      continue;
    }

    if (!isNaN(Number(word[i]))) {
      continue;
    }

    if (word[i].length > word[index]) {
      index = i;
    }
  }

  if (pattern.test(word[index])) {
    return;
  }

  //过滤特殊符号
  word[index] = word[index].replace(
    /\ |\/|\~|\!|\@|\#|\\$|\%|\^|\&|\*|\(|\)|\_|\+|\{|\}|\:|\<|\>|\[|\]|\,|\.|\/|\;|\'|\`|\-|\=|\\\|\|/g,
    ""
  );

  if (!word[index]) {
    return;
  }

  pattern = new RegExp("[\u4E00-\u9FA5]+");
  if (!pattern.test(word[index])) {
    return;
  }

  let wordLength = word[index].replace(/[\u4e00-\u9fa5]/g, "*").length;
  if (wordLength > 8) {
    return;
  }

  //缓存识图结果
  global.redis.set(key, word[index], {
    EX: 3600 * 24,
  });

  return word[index];
}
