import { segment } from "oicq";
import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import sizeOf from "image-size";
import { render } from "../render.js";

const _path = process.cwd().trim("\\lib");

async function add(e) {
  if (!e.img || e.at || e.hasReply) {
    return false;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  } else {
    let key = `Yunzai:group_id:${e.user_id}`;
    global.redis.set(key, group_id.toString(), {
      EX: 1209600,
    });
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

  let type = "jpg";
  if (response.headers.get("content-type") == "image/gif") {
    type = "gif";
  }

  const streamPipeline = promisify(pipeline);
  await streamPipeline(response.body, fs.createWriteStream(`${path}${group_id}/${msg}.${type}`));

  e.reply(`添加成功：${msg}`);

  return true;
}

async function get(e) {
  if (!e.msg || e.img || e.at || e.hasReply) {
    return false;
  }

  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  } else {
    let key = `Yunzai:group_id:${e.user_id}`;
    global.redis.set(key, group_id.toString(), {
      EX: 1209600,
    });
  }

  if (!group_id) {
    return false;
  }

  if (e.msg.replace(/[\u4e00-\u9fa5]/g, "*").length > 8) {
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
  } else {
    let key = `Yunzai:group_id:${e.user_id}`;
    global.redis.set(key, group_id.toString(), {
      EX: 1209600,
    });
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

  fs.unlinkSync(img);

  e.reply(`删除成功：${msg}`);
}

async function list(e) {
  let group_id = e.group_id;
  if (e.isPrivate) {
    group_id = await getGroupId(e);
  } else {
    let key = `Yunzai:group_id:${e.user_id}`;
    global.redis.set(key, group_id.toString(), {
      EX: 1209600,
    });
  }

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

//数组分页
function pagination(pageNo, pageSize, array) {
  var offset = (pageNo - 1) * pageSize;
  return offset + pageSize >= array.length ? array.slice(offset, array.length) : array.slice(offset, offset + pageSize);
}

export { add, del, get, list };
