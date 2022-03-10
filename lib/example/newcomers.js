import { segment } from "oicq";
import fetch from "node-fetch";
import lodash from "lodash";

//项目路径
const _path = process.cwd();

//简单应用示例

//1.定义命令规则
export const rule = {
  newcomers: {
    reg: "^#欢迎新人$", //匹配消息正则，命令正则
    priority: 5000, //优先级，越小优先度越高
    describe: "【#欢迎新人】开发简单示例演示", //【命令】功能说明
  },
};

//2.编写功能方法
//方法名字与rule中的newcomers保持一致
//测试命令 npm test 例子
export async function newcomers(e) {
  return;

  //定义入群欢迎内容
  // let img = "http://tva1.sinaimg.cn/bmiddle/6af89bc8gw1f8ub7pm00oj202k022t8i.jpg";//图片
  let msg = "欢迎新人！";//文字
  //冷却cd 10s
  let cd = 30;

  //不是群聊
  if (!e.isGroup) {
    return;
  }

  //cd
  let key = `Yunzai:newcomers:${e.group_id}`;
  if (await redis.get(key)) {
    return;
  }
  redis.set(key, "1", { EX: cd });

  //发送消息
  if (typeof img != "undefined") msg = [segment.image(img), msg];
  e.reply(msg);

  return true; //返回true 阻挡消息不再往下
}
