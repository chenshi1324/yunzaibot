# Yunzai-Bot
云崽，原神qq群机器人，通过米游社接口，查询原神游戏信息

快速生成图片返回，平均100-300ms，基本秒回

## 使用方法
>环境准备： Windows or Linux，Node.js（[版本至少v14以上](http://nodejs.cn/download/)），[Redis](resources/readme/命令说明.md#window安装redis)
>
>[Linux环境一键搭建](https://github.com/Le-niao/Yunzai-Bot/issues/3)，[Windows按下面的就行](https://www.bilibili.com/read/cv15119056)，[安卓手机搭建](https://www.bilibili.com/read/cv15126105)
```
1.克隆项目
git clone https://github.com/Le-niao/Yunzai-Bot.git
cd Yunzai-Bot

用cnpm安装
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install

2.首次运行，按提示输入完成配置登录
node app

3.需要后台运行的，停止现在的输入下面命令
npm start
```

## 操作指令
>
>#帮助 查看命令说明，下面详细指令展示
>
>[其他说明](resources/readme/命令说明.md)，[如何获取cookie](resources/readme/命令说明.md#如何获取米游社-cookie)，[抽卡记录说明](resources/logHelp/记录帮助.md)，[更新日志](resources/readme/更新日志.md)

### 
![示例](https://user-images.githubusercontent.com/12881780/149643554-ec12f18a-e00c-4cd4-bc89-e651a9812168.png)

<details>
<summary>#刻晴/#老婆/#老公</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639092-922533ce-8000-4df2-b390-cf40c8d7c12f.png" alt="#早柚">
</details>

<details>
<summary>#刻晴卡片/戳一戳</summary>
<img src="https://user-images.githubusercontent.com/12881780/149643684-7aec38db-7fcc-4cfe-b3f2-050ad8640b87.png" alt="#温迪">
</details>

<details>
<summary>#角色、#角色卡片、#探索度</summary>

>#角色卡片
<img src="https://user-images.githubusercontent.com/12881780/151143032-1ae13f1f-e1e0-473f-9c9a-635230d07537.png" alt="#角色卡片">
  
>#角色
<img src="https://user-images.githubusercontent.com/12881780/148639137-cf773512-d78e-46ec-894c-bbd05f1182a0.png" alt="#角色">

>#探索度
<img src="https://user-images.githubusercontent.com/12881780/149620677-96b28966-9a57-49b1-b3ec-5724287c6722.jpg" alt="#探索度">
</details>

<details>
<summary>#深渊，#上期深渊，#深渊十二层</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639158-7f800191-35b6-4a29-8fb7-72b90aa0424d.png" alt="#深渊">
  
>#深渊十二层
<img src="https://user-images.githubusercontent.com/12881780/149620552-8cfed4e4-8e8c-42f9-b190-703a4433484a.png" alt="#深渊十二层">
</details>

<details>
<summary>#四星/#五星</summary>
<img src="https://user-images.githubusercontent.com/12881780/149619476-c96b5afd-2902-4f95-9be1-8da0908efa50.png" alt="#五星">
</details>

<details>
<summary>#武器</summary>
<img src="https://user-images.githubusercontent.com/12881780/149620853-c35b19e0-2289-4583-b804-6057b48f3f32.jpg" alt="#武器">
</details>

<details>
<summary>#体力/#体力帮助</summary>

需要配置cookie（私聊发送给机器人） [体力查询说明](resources/readme/命令说明.md#体力查询说明)

<img src="https://user-images.githubusercontent.com/12881780/148639174-675bee67-b3e5-41ef-8a3c-89e4fb909610.png" alt="#体力">
</details>


<details>
<summary>#角色记录/#常驻记录/#武器记录</summary>
<img src="https://user-images.githubusercontent.com/12881780/155257884-4aa214e3-3a70-4bdf-893a-91c4ea33a59f.png" alt="#角色记录">
</details>
<details>
<summary>#角色统计/#武器统计</summary>
  
按卡池统计抽卡记录

<img src="https://user-images.githubusercontent.com/12881780/154597893-795b4e00-7c56-48b3-aaff-ef0fce68b321.png" alt="#角色统计">
</details>
<details>
<summary>#十连、#十连2（角色卡池2）、十连武器</summary>
<img src="https://user-images.githubusercontent.com/12881780/154387499-55086c06-791b-4308-b7a1-3b4c9ec956ae.png" alt="#十连">
<img src="https://user-images.githubusercontent.com/12881780/151505221-15efaccb-c073-4f7a-8131-6043f0a2bedc.png" alt="#十连武器">
</details>

<details>
<summary>添加表情</summary>
<img src="https://user-images.githubusercontent.com/12881780/149620139-9505a175-40b6-4d8f-894d-f3f308a7eb22.png" alt="添加表情">
</details>

## 致谢
| Nickname                                                     | Contribution                        |
| :----------------------------------------------------------: | ----------------------------------- |
|[GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源 |
|[lulu666lulu](https://github.com/lulu666lulu) | 提供了最新的DS算法 |

## 其他
- 有什么问题、Bug，或有其它建议，欢迎提 [issue](https://github.com/Le-niao/Yunzai-Bot/issues)。
- 也可以加群 [213938015](https://qm.qq.com/cgi-bin/qm/qr?k=HN2YuYXT-Ks3eFhXmuk94OhkDood4sBy&jump_from=webapi) 反馈 ，最后再求个star，你的支持是维护本项目的动力~~
- 图片素材来源于网络，仅供交流学习使用
- [爱发电](https://afdian.net/@Le-niao)
