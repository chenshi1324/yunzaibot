import { segment } from "oicq";

//项目路径
const _path = process.cwd();

//简单应用示例

//1.定义命令规则
export const rule = {
  sample: {
    reg: "^#例子$",  //匹配消息正则，命令正则
    priority: 5000, //优先级，越小优先度越高
    describe: "【#例子】开发简单示例演示", //【命令】功能说明
  },
};

//2.编写功能方法
//方法名字与rule中的sample保持一致
//测试命令 npm test 示例
export function sample(e) {
  //e参数
  console.log(e);
  //e.msg 用户的命令消息
  console.log(e.msg);

  //执行的逻辑功能.....
  

  //最后回复消息
  let msg = [
    //@用户
    segment.at(e.user_id), 
    //文本消息
    "\n欢迎使用Yunzai-Bot",
    //图片
    segment.image(`file:///${_path}/resources/help/help.png`), 
  ];

  //发送消息
  e.reply(msg);

  return true;//返回true 阻挡消息不再往下
}
