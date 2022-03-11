import { segment } from "oicq";
import fs from "fs";
import lodash from "lodash";
import sizeOf from "image-size";

//项目路径
const _path = process.cwd();
let fileArr = {
  img: {},
  record: {},
};

/**
 * 全局表情，表情图片放到resources/global_img
 * 全局语音，语音文件放到resources/global_record
 * 【文件名】就是触发指令，多个命令可以用-隔开
 * 图片支持格式（jpg,png,gif,bmp）
 * 语音支持格式（amr,silk）
 */
export const rule = {
  resources: {
    reg: "", //匹配消息正则，命令正则
    priority: 4900, //优先级，越小优先度越高
    describe: "【文件名】就是触发指令", //【命令】功能说明
  },
};

init();

export async function resources(e) {
  if (!e.msg || !e.message || e.hasReply) {
    return false;
  }

  let msg = e.msg.replace(/#|＃|\./g, "");

  if (fileArr.img[msg]) {
    let img = lodash.sample(fileArr.img[msg]);
    let dimensions = sizeOf(img);
    let tmp = dimensions.width / dimensions.height;
    if (dimensions.height > 150 && ((tmp > 0.6 && tmp < 1.4) || tmp > 2.5)) {
      msg = segment.image(img);
      msg.asface = true;
      e.reply(msg);
    } else {
      e.reply(segment.image(img));
    }
  } else if (fileArr.record[msg]) {
    e.reply(segment.record(lodash.sample(fileArr.record[msg])));
  } else {
    return false;
  }

  return true;
}

//获取所有资源文件
function init() {
  readdirectory("./resources/global_img", "img");
  watchFile("./resources/global_img", "img");
  readdirectory("./resources/global_record", "record");
  watchFile("./resources/global_record", "record");
}

function readdirectory(dir, type) {
  let files = fs.readdirSync(dir, { withFileTypes: true });
  for (let val of files) {
    let filepath = dir + `/` + val.name;
    if (!val.isFile()) {
      readdirectory(filepath, type);
      continue;
    }
    let re;

    if (type == "img") {
      re = new RegExp(`.(jpg|jpeg|png|gif|bmp)$`, "i");
    }
    if (type == "record") {
      re = new RegExp(`.(amr|silk|mp3)$`, "i");
    }

    if (!re.test(val.name)) {
      continue;
    }
    let name = val.name.replace(re, "");
    name = name.split("-");
    for (let v of name) {
      v = v.trim();
      if (!fileArr[type][v]) {
        fileArr[type][v] = [];
      }
      fileArr[type][v].push(filepath);
    }
  }
}

function watchFile(dir, type) {
  let fsTimeout = {};
  let recursive = false;
  if (process.platform == "win32") {
    recursive = true;
  }
  fs.watch(dir, { recursive: recursive }, async (eventType, filename) => {
    let re;
    if (type == "img") {
      re = new RegExp(`.(jpg|jpeg|png|gif|bmp)$`, "i");
      fileArr.img = {};
    }
    if (type == "record") {
      re = new RegExp(`.(amr|silk|mp3)$`, "i");
      fileArr.record = {};
    }
    if (fsTimeout[type] || !re.test(filename)) {
      return;
    }
    fsTimeout[type] = true;
    setTimeout(async () => {
      readdirectory(dir, type);
      fsTimeout[type] = null;
    }, 500);
  });
}
