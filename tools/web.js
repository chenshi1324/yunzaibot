import express from 'express';
import template from 'express-art-template'
import fs from "fs";


/*
* npm run dev开启Bot后
* 可另外通过 npm run web 开启浏览器调试
* 访问 http://localhost:8080/${type} 即可看到对应页面
* 页面内的资源需使用 {{_res_path}}来作为resources目录的根目录
* 可编辑模板与页面查看效果
* todo：hotreload
*
* */



var app = express();

var _path = process.cwd();

app.engine('html', template);
app.set('views', _path + '/resources/genshin');
app.set('view engine', 'art');
app.use(express.static(_path + "/resources"));

app.get('/', function (req, res) {
  res.send("页面服务已启动，触发消息图片后访问 http://localhost:8080/${type} 调试页面")
});
app.get('/:type', function(req,res){
   let page = req.params.type;
  let data = JSON.parse(fs.readFileSync(_path + "/data/ViewData/" + page + ".json", "utf8"));
  data = data || {};
  data._res_path = "";
  res.render(`${page}/${page}.html`, data)
});

app.listen(8080);
console.log('页面服务已启动，触发消息图片后访问 http://localhost:8080/${type} 调试页面')