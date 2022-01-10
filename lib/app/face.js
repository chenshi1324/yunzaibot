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

const _path = process.cwd().trim("\\lib");

let faceArr = {}; //所有表情对象
let context = {}; //添加图片上下文

async function add(e) {
  if (!e.msg && !e.img) {
    return false;
  }

  let msg = e.msg;
  //有图片
  if (e.img && !e.msg) {
    //有上下文
    if (context[e.user_id]) {
      msg = context[e.user_id];
    }
  }

  if (!/^#*添加(.*)$/.test(msg)) {
    return false;
  }

  if (!e.img) {
    if (msg.replace(/[\u4e00-\u9fa5]/g, "*").length > 8) {
      e.reply(`关键字长度不能超过8`);
      return true;
    }
    context[e.user_id] = msg;
    let name = lodash.truncate(e.sender.card, { length: 8 });
    e.reply([segment.at(e.user_id, name), `请发送表情`]);
    return true;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (!group_id) {
    return true;
  }

  msg = msg.replace(/#|图片|表情|添加|删除|列表|\./g, "");

  if (!msg) {
    return true;
  }

  msg = msg.trim();

  if (context[e.user_id]) {
    delete context[e.user_id];
  }

  if (msg.replace(/[\u4e00-\u9fa5]/g, "*").length > 8) {
    e.reply(`关键字长度不能超过8`);
    return true;
  }

  Bot.logger.mark(`[${e.group_name}] 添加:${msg}`);

  let path = "data/face/";

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
  if (!fs.existsSync(`${path}${group_id}`)) {
    fs.mkdirSync(`${path}${group_id}`);
  }

  const response = await fetch(e.img[0]);

  if (!response.ok) {
    e.reply("图片下载失败。。");
    return true;
  }

  let type = "jpg";
  if (response.headers.get("content-type") == "image/gif") {
    type = "gif";
  }

  const streamPipeline = promisify(pipeline);
  await streamPipeline(response.body, fs.createWriteStream(`${path}${group_id}/${msg}.${type}`));

  setGroupId(e);

  e.reply(`添加成功：${msg}`);

  if (!faceArr[group_id]) {
    getFileData(group_id);
  }
  faceArr[group_id].set(msg, { suffix: type });

  return true;
}

async function get(e) {
  if (!e.msg || e.img) {
    return false;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (!group_id) {
    return false;
  }

  if (!faceArr[group_id]) {
    getFileData(group_id);
  }

  if (faceArr[group_id].size <= 0) {
    return;
  }

  if (e.msg.replace(/[\u4e00-\u9fa5]/g, "*").length > 8) {
    return false;
  }

  let msg = e.msg.replace(/#|\./g, "");

  let face = faceArr[group_id].get(msg);

  if (!face) {
    return;
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

async function del(e) {
  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (!group_id) {
    return false;
  }

  let msg = e.msg.replace(/#|图片|表情|添加|删除|列表|\./g, "");

  if (!msg) {
    return false;
  }

  let img = `./data/face/${group_id}/${msg}`;

  //判断文件是否存在
  if (fs.existsSync(`${img}.jpg`)) {
    img += ".jpg";
  } else if (fs.existsSync(`${img}.gif`)) {
    img += ".gif";
  } else {
    return false;
  }

  setGroupId(e);

  fs.unlinkSync(img);

  faceArr[group_id].delete(msg);

  e.reply(`删除成功：${msg}`);
}

async function list(e) {
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

async function listFuzzy(e) {
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

//斗图
async function random(e) {
  if (!e.img || !e.groupConfig.imgRate || !BotConfig.BaiduOcr || !BotConfig.BaiduOcr.APP_ID) {
    return;
  }
  if (e.img.length > 1) {
    return;
  }
  if (!e.message[0].asface) {
    return;
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

  Bot.logger.mark(`[${e.group_name}] 斗图：${keyWord}`);

  let msg = segment.image(iamges);
  msg.asface = true;
  e.reply(msg);

  return true;
}

//根据关键词随机获取表情
async function getRandomImg(keyWord, page = 1) {
  let url = `https://www.doutula.com/search?keyword=${keyWord}&page=${page}`;

  let response = {};
  try {
    response = await fetch(url);
  } catch (error) {
    Bot.logger.mark("获取斗图表情失败");
    return;
  }
  if (!response.ok) {
    Bot.logger.mark("获取斗图表情失败");
    return;
  }

  const body = await response.text();

  let iamges = body.match(/data-original="(http:\/\/img.*?)"/g);
  if (!iamges || iamges.length <= 0) {
    return;
  }

  iamges = lodash.sample(iamges).replace(/data-original="|"/g, "");

  return iamges;
}

//百度通用文字识别
async function baiduOcr(e) {
  if (!baiduClient) {
    // 新建一个对象，建议只保存一个对象调用服务接口
    baiduClient = new AipOcrClient(BotConfig.BaiduOcr.APP_ID, BotConfig.BaiduOcr.API_KEY, BotConfig.BaiduOcr.SECRET_KEY);
  }

  var url = e.img[0];

  // 调用通用文字识别, 图片参数为远程url图片
  let res = await baiduClient.generalBasicUrl(url).catch(function (err) {
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
  let pattern =
    /LV|lv|群|管理|扫一扫|二维码|嘿|伤害|元素|攻击|爆|上限|生命|防御|百分|染血|宗室|斗士|少女|魔女|渡火|野花|雷|\+|%|操|图|色|涩|妈|母|id|ID|唯|★|☆/g;

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

  if (
    /LV|lv|群|管理|扫一扫|二维码|嘿|伤害|元素|攻击|爆|上限|生命|防御|百分|染血|宗室|斗士|少女|魔女|渡火|野花|雷|\+|%|操|图|色|涩|妈|母|id|ID|唯|★|☆/g.test(
      word[index]
    )
  ) {
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

  return word[index];
}

//at回复表情
async function atRandom(e) {
  if (!e.msg || !e.at || e.at != BotConfig.account.qq || e.hasReply) {
    return;
  }

  if (!/[\u4e00-\u9fa5]+|\?/g.test(e.msg)) {
    return;
  }

  //过滤特殊符号
  e.msg = e.msg.replace(/\ |\/|\~|\!|\@|\#|\\$|\%|\^|\&|\*|\(|\)|\_|\+|\{|\}|\:|\<|\>|\[|\]|\,|\.|\/|\;|\'|\`|\-|\=|\\\|\|/g, "");

  if (!e.msg) {
    return;
  }

  let wordLength = e.msg.replace(/[\u4e00-\u9fa5]/g, "*").length;

  if (wordLength < 2 || wordLength > 4) {
    return;
  }

  //关键字获取图片
  let iamges = await getRandomImg(e.msg);
  if (!iamges) return;

  Bot.logger.mark(`[${e.group_name}] 斗图：${e.msg}`);

  let msg = segment.image(iamges);
  msg.asface = true;
  e.reply(msg);
}

export { add, del, get, list, listFuzzy, random, getRandomImg, atRandom };
