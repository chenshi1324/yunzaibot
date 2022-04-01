FROM centos:centos8

WORKDIR /app

ENV GreenBG="\\033[42;37m"\
    Font="\\033[0m" \
    Info="${Green}[信息]${Font}"

RUN sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-* \
    && sed -i 's|^#baseurl=http://mirror.centos.org/\$contentdir/\$releasever|baseurl=https://mirrors.cloud.tencent.com/centos-vault/8.5.2111|g' /etc/yum.repos.d/CentOS-* \
    && yum makecache \
    && yum install -y dnf git \
    && dnf module install nodejs:16 -y \
    && yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 -y && yum install libdrm libgbm libxshmfence -y && yum install nss -y && yum update nss -y \
    && yum groupinstall fonts -y \
    && yum clean all \
    && rm -rf /tmp/*

RUN git clone --depth 1 https://gitee.com/Le-niao/Yunzai-Bot.git

WORKDIR Yunzai-Bot
COPY docker-entrypoint.sh entrypoint.sh

RUN git config pull.rebase false \
    && chmod +x entrypoint.sh \
    && npm install cnpm -g --registry=https://registry.npmmirror.com \
    && cnpm install \
    && npm cache clean --force

ENTRYPOINT ["./entrypoint.sh"]