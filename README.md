# Yunzai-Bot
云崽，原神qq群机器人，通过米游社接口，查询原神游戏信息，快速生成图片返回

## 使用方法
>环境准备： Windows or Linux，Node.js（[版本至少v14以上](http://nodejs.cn/download/)），[Redis](resources/readme/命令说明.md#window安装redis)
>
>[Linux环境一键搭建](https://github.com/Le-niao/Yunzai-Bot/issues/3)，Windows按下面的就行([需要安装redis](resources/readme/命令说明.md#window安装redis))
```
1.安装
git clone https://github.com/Le-niao/Yunzai-Bot.git
cd Yunzai-Bot

用cnpm安装
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install

2.运行
node app

后台运行 or 停止
npm start / npm stop
```

## 操作指令
>
>#帮助 查看命令说明，下面详细指令展示
>
>[其他说明](resources/readme/命令说明.md)，[如何获取cookie](resources/readme/命令说明.md#如何获取米游社-cookie)，[抽卡记录说明](resources/logHelp/记录帮助.md)，[更新日志](resources/logHelp/更新日志.md)

### 
![示例](https://user-images.githubusercontent.com/12881780/148473565-effe31d9-a0b3-4ebc-852a-45eb198162b5.png)

<details>
<summary>#角色名称/#神里/#老婆/#老公</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639092-922533ce-8000-4df2-b390-cf40c8d7c12f.png" alt="#早柚">
</details>

<details>
<summary>戳一戳/#温迪2</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639108-9d39fce4-fca0-4115-80c6-cd7ee8aa5bff.png" alt="#早柚">
</details>

<details>
<summary>#角色、#角色2</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639137-cf773512-d78e-46ec-894c-bbd05f1182a0.png" alt="#角色">
</details>

<details>
<summary>#深渊，#上期深渊，#深渊十二层</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639158-7f800191-35b6-4a29-8fb7-72b90aa0424d.png" alt="#深渊">
</details>

<details>
<summary>#四星/#五星</summary>
<img src="resources/readme/五星.png" alt="#五星">
</details>

<details>
<summary>#体力/#体力帮助</summary>

需要配置cookie（私聊发送给机器人） [体力查询说明](resources/readme/命令说明.md#体力查询说明)

<img src="https://user-images.githubusercontent.com/12881780/148639174-675bee67-b3e5-41ef-8a3c-89e4fb909610.png" alt="#体力">
</details>


<details>
<summary>#角色记录/#常驻记录/#武器记录</summary>
<img src="resources/readme/角色记录.png" alt="#角色记录">
</details>

<details>
<summary>#十连、#十连2</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639188-830c9554-86ed-49a2-a3f8-9e7b89763c97.png" alt="#十连">
</details>

<details>
<summary>添加表情</summary>
<img src="https://user-images.githubusercontent.com/12881780/148639195-a15c2f86-5616-48b1-9137-cc64caddc8c0.png" alt="添加表情">
</details>

## 致谢
| Nickname                                                     | Contribution                        |
| :----------------------------------------------------------: | ----------------------------------- |
|[GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源 |
|[lulu666lulu](https://github.com/lulu666lulu) | 提供了最新的DS算法 |

### 其他
有什么问题、Bug，或有其它建议，欢迎提 [issue](https://github.com/Le-niao/Yunzai-Bot/issues)。

也可以加群 213938015 反馈 ，最后再求个star ~~

图片素材来源于网络，仅供交流学习使用

