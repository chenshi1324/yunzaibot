import { segment } from "oicq";
import fs from "fs";
import lodash from "lodash";
import sizeOf from "image-size";

//项目路径
const _path = process.cwd();
let fileArr = new Map();

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
    priority: 20000, //优先级，越小优先度越高
    describe: "【文件名】就是触发指令", //【命令】功能说明
  },
};

init();

export async function resources(e) {
  if (!e.msg || !e.message || e.hasReply) {
    return false;
  }

  let msg = e.msg.replace(/#|＃|\./g, "");
 
  let tmp = fileArr.get(msg);
  if (!tmp) return;

  let filePath = lodash.sample(tmp);
  
  Bot.logger.mark(`[${e.group_name}] 全局表情：${msg}`);
  
  if(/.(jpg|jpeg|png|gif|bmp)$/.test(filePath)){
    let dimensions = sizeOf(filePath);
    let tmp = dimensions.width / dimensions.height;
    if (dimensions.height > 150 && ((tmp > 0.6 && tmp < 1.4) || tmp > 2.5)) {
      msg = segment.image(filePath);
      msg.asface = true;
      e.reply(msg);
    } else {
      e.reply(segment.image(filePath));
      return true;
    }
  }

  if(/.(amr|silk|slk|mp3)$/.test(filePath)){
    e.reply(segment.record(filePath));
    return true;
  }
  
  return false;
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
      if(!v) continue;
      let tmp = fileArr.get(v);
      if(tmp){
        tmp.push(filepath);
      }
      else{
        fileArr.set(v,[filepath]);
      }
    }
  }
}

function watchFile(dir, type) {
  let fsTimeout = {};
  let recursive = false;
  // if (process.platform == "win32") {
  //   recursive = true;
  // }
  fs.watch(dir, { recursive: recursive }, async (eventType, filename) => {
    if (fsTimeout[type]) return;

    let re;
    if (type == "img") {
      Bot.logger.mark("更新全局图片");
      re = new RegExp(`.(jpg|jpeg|png|gif|bmp)$`, "i");
      fileArr.img = {};
    }

    if (type == "record") {
      Bot.logger.mark("更新全局语音");
      re = new RegExp(`.(amr|silk|mp3)$`, "i");
      fileArr.record = {};
    }

    if (!re.test(filename)) return;

    fsTimeout[type] = true;

    setTimeout(async () => {
      readdirectory(dir, type);
      fsTimeout[type] = null;
    }, 5000);
  });
}
