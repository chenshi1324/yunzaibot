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

const _path = process.cwd().trim("\\lib");

async function add(e) {
  if (!e.img || e.at || e.hasReply) {
    return false;
  }

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

  msg = msg.trim();

  if (msg.replace(/[\u4e00-\u9fa5]/g, "*").length > 8) {
    e.reply(`关键字长度不能超过8`);
    return true;
  }

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

  return true;
}

async function get(e) {
  if (!e.msg || e.img || e.at || e.hasReply) {
    return false;
  }

  if (e.msg.replace(/[\u4e00-\u9fa5]/g, "*").length > 8) {
    return false;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  }

  if (!group_id) {
    return false;
  }

  let img = `/data/face/${group_id}/${e.msg}`;

  //判断文件是否存在
  if (fs.existsSync(`.${img}.jpg`)) {
    img += ".jpg";
  } else if (fs.existsSync(`.${img}.gif`)) {
    img += ".gif";
  } else {
    return false;
  }

  setGroupId(e);

  var dimensions = sizeOf(`.${img}`);
  let tmp = dimensions.width / dimensions.height;

  if (dimensions.height > 150 && ((tmp > 0.7 && tmp < 1.3) || tmp > 2.5)) {
    let msg = segment.image(`file:///${_path}${img}`);
    msg.asface = true;
    e.reply(msg);
  } else {
    e.reply(segment.image(`file:///${_path}${img}`));
  }

  return true;
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
  if (lodash.random(0, 100) > e.groupConfig.imgRate) {
    return;
  }
  let keyWord = await baiduOcr(e);
  if (!keyWord) return;

  let url = "https://www.doutula.com/search?keyword=" + keyWord;
  const response = await fetch(url);
  const body = await response.text();

  let iamges = body.match(/data-original="(http:\/\/img.*?)"/g);
  if (!iamges || iamges.length <= 0) {
    return;
  }

  Bot.logger.mark(`斗图:${e.group_name}：${keyWord}`);

  iamges = lodash.sample(iamges).replace(/data-original="|"/g, "");

  e.reply(segment.image(iamges));
}

async function baiduOcr(e) {
  // 新建一个对象，建议只保存一个对象调用服务接口
  var client = new AipOcrClient(BotConfig.BaiduOcr.APP_ID, BotConfig.BaiduOcr.API_KEY, BotConfig.BaiduOcr.SECRET_KEY);

  var url = e.img[0];

  // 调用通用文字识别, 图片参数为远程url图片
  let res = await client.generalBasicUrl(url).catch(function (err) {
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
    let pattern =
      /LV|lv|群|管理|扫一扫|二维码|嘿|伤害|元素|攻击|爆|上限|生命|防御|百分|染血|宗室|斗士|少女|魔女|渡火|野花|雷|\+|%|操|图|色|涩|妈|母|id|ID|唯|★|☆/g;
    if (pattern.test(word[i])) {
      return;
    }
    if (word[i].length > word[index]) {
      index = i;
    }
  }
  word[index] = word[index].replace(
    /\ |\/|\~|\!|\@|\#|\\$|\%|\^|\&|\*|\(|\)|\_|\+|\{|\}|\:|\<|\>|\?|\[|\]|\,|\.|\/|\;|\'|\`|\-|\=|\\\|\|/g,
    ""
  );

  if (!word[index]) {
    return;
  }
  if (word[index].length <= 1) {
    return;
  }

  let pattern = new RegExp("[\u4E00-\u9FA5]+");
  if (!pattern.test(word[index])) {
    return;
  }

  let wordLength = word[index].replace(/[\u4e00-\u9fa5]/g, "*").length;
  if (wordLength > 6) {
    return;
  }

  return word[index];
}
export { add, del, get, list, random };
