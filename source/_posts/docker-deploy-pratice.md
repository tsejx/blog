---
title: Web 前后端应用 Docker 容器化独立部署实践
date: '2020-04-20'
---

在人类社会大分工越来越精细的大背景下，各式各样的软件技术公司层出不穷，为各行各业提供着或大众化或具有特色的软件服务，大部分软件服务是公有性质的，也就是这些服务提供商内部单独的运营软件平台，使用者获取软件使用权后在其平台生产内容，并由服务商提供数据存储服务，这种性质的平台对于软件开发商来说需要考虑数据的隔离，对于使用者来说则减少了维护成本，但是数据并非私自存储无法确保安全性。而相对于公有性软件服务的就是私有化软件服务，这类型产品提供可部署至客户私自的服务器上的版本，数据由客户自身存储，某种程度上保证的了数据的安全性。

在 PPmoney 内部，龙猫 X 配置平台提供给理财及借贷两个技术团队使用，对于页面、模版、组件、素材都需要在公共空间进行共享存储，而现有的人员权限机制无法对这些要素进行筛选区分，无可避免出现管理混乱的局面。而根据不同的团队、不同的部署环境进行系统部署也是需求的关注点。考虑到对数据的隔离，以及未来龙猫 X 作为软件服务对外提供商业性质的服务，为龙猫 X 增强可独立部署的功能的事宜即提上开发的日程。

在对龙猫 X 的独立部署的技术选型上我们选择了 Docker 容器化技术。之所以选择 Docker 是因为容器技术对进程进行封装隔离，能够高效地在利用服务器资源以及便捷地在多平台间进行迁移。

在这篇文章中我尝试把容器化改造过程中遇到的坑位记录下来为后人提供借鉴，也是对整个坎坷的过程的记录。

<!-- more -->

## 容器化技术

容器技术对进程进行封装隔离，属于操作系统层面的虚拟化技术。由于隔离的进程独立于宿主和其他的隔离的进程，因此称为容器。

![服务器中的容器](https://img.mrsingsing.com/docker-in-server.png)

Docker 容器化技术关键核心只需要掌握三个概念：

- 镜像 Image
- 容器 Container
- 仓库 Repository

从小白的角度理解的话可以把 **镜像** 和 **容器** 类比为面向对象编程中的类和实例，镜像是静态的定义，而容器则是镜像运行时的形态。我们可以把容器想像成包装盒，包装盒里装载着一个微型操作系统，其内部运行着我们的应用程序。

仓库则是存放镜像的地方，可以为镜像打 tag（标签），就好像我们为 git commit 打版本号的 tag 一样，使用者可以根据需要选择版本部署，程序故障时也能立马根据版本进行回滚。

Docker Hub 是 Docker 官方的公开的仓库，私有仓库则有 Harbor，商业化的容器服务提供商有阿里云、Dao Cloud 等。我们公司采用的是内部自建的 Harbor 仓库。

因为本篇文章非科普性质，所以对于 Docker 的介绍就不过于深入叙述，有兴趣可以搜索相关文章进行研究，当然首推还是把 [官方文档](https://docs.docker.com/) 看一遍，毕竟第一手资料才是最具参考价值的。

## 镜像制作

对龙猫 X 进行容器化改造需要部署四个子项目，分别是 React 全家桶的客户端项目、Koa 服务端项目、页面爬虫项目以及 MongoDB 数据库。

在 Docker 中，镜像是根据配置文件 Dockerfile 构建的。通过以下命令可以执行构建的工作：

```bash
# docker build -t <镜像名称> <构建目录>
$ docker build -t totorox-admin .
```

`-t` 表示将镜像命名为 `totorox-admin`。

### 前端项目

如下图所示为前端项目镜像的配置文件：

![Dockerfile in Frontend Project](https://img.mrsingsing.com/frontend-dockerfile.png)

在 Dockerfile 中 `FROM` 指令是必然存在的并且作为构建的开头，该指令初始化一个新的构建阶段（也就是有多少个 `FROM` 指令就有多少个镜像构建阶段）并为后续指令设置基础映像。

`COPY` 指令表示拷贝资源至镜像内部，这里有个优化的小技巧，就是在项目根目录添加 `.dockerignore` 文件，与 `.gitignore` 或 `.npmignore` 类似，添加到该文件下的目录 Docker 构建镜像时将忽略其中的文件。我们可以把只用于代码开发阶段或者规范性的文件排除在构建之外，例如 `.vscode`、`.eslint`、`dist` 等。

接下来就是常规的安装依赖、项目构建打包的指令，`npm install` 可以指定为淘宝镜像，在国内的话下载速度相对有保障，能够缩减镜像的构建时间。

类似地，由于我们的项目中使用到了 Sass 预编译，Webpack 打包需要用到 `node-sass` 插件，每次都必须下载 `win32-x64-57_binding.node` 文件，所以要不需要漫长的等待（因为从国外源仓库下载），要不下载失败报一系列的错。幸好它提供了人性化的配置，可以通过环境变量改变下载的地址。我们在 `.npmrc` 中将一些依赖包中需要额外下载的文件的链接地址的环境变量指定为国内的镜像地址。当然啦并非所有依赖包都支持这样做，有些写死了下载地址是无法通过这样的方法优化的。除了上面提到的 `node-sass`，其余可以在 [淘宝镜像](https://developer.aliyun.com/mirror/NPM?from=tnpm) 找到对应的镜像地址，后面会提到的页面爬虫项目中使用的 `phantomjs` 也是通过这种方式大幅度压缩了构建时间。

![.npmrc配置文件](https://img.mrsingsing.com/npmrc.jpg)

第二阶段我们从镜像仓库获取 Nginx 镜像。一般地，前端项目构建打包后生成静态资源文件，需要 Web 代理服务器进行请求转发，我们这里用的是 Nginx，当然也可以用 Express 实现一个 Web 服务作为代理转发。

Nginx 配置和使用相对来说比较简单，通过简单的配置即可拥有高性能和高可用性，下面是 Nginx 的示例配置：

![Nginx配置](https://img.mrsingsing.com/nginx-conf.png)

在该阶段中，主要是将第一阶段生成的产物转移到第二阶段，这是因为镜像最终的启动指令 `CMD` 是在第二阶段，而且分阶段的镜像构建能够使得最终容器内只需放置打包后的静态资源文件即可，不用包含源代码文件，镜像的体积也会因此而大幅度缩减，在某种程度也确保了源代码的不对外泄漏。

最终 `CMD` 命令是容器运行时在内部执行的指令。考虑到不同使用者的 API 服务器域名是不同的是动态变化的，在源代码中把 API 域名写死显然是个不明智的做法。因此，我们通过在运行容器时的环境变量植入写好的 Shell 脚本，通过 Shell 脚本生成包含域名等信息的 JavaScript 文件，HTML 文档通过写好的外链该脚本文件实现加载，这样即可满足动态域名变更的需求。

在镜像构建过程中，如果细心观察打印的日志，会发现有这么一句：

![移除中间容器](https://img.mrsingsing.com/removeing-intermediate-container.jpg)

其实从构建的日志中可以看到，实质上镜像构建的每个指令都会生成一个临时的中间容器，每层中间容器都是以前面一层中间容器为基础的。当对应的指令执行完毕后，对应层级就不会再发生改变，会移除该临时创建的中间容器，然后再进行下一个指令操作。

构建成功后，在命令行中输入 `docker images` 即可查看当前宿主机的 Docker 镜像列表：

![容器镜像](https://img.mrsingsing.com/docker-images.jpg)

由于我们的项目所需要的镜像在公司内部有私有仓库，所以构建时速度有一定的保障，如果是个人开发者在自己的服务器上构建镜像可能需要从公有仓库例如 Docker Hub 拉取所需要的镜像，这里提供一个优化的手段，可以通过修改 Docker Daemon 配置 `/etc/docker/daemon.json` 的镜像地址，实现镜像的加速，Docker 官方和国内很多云服务器平台都提供了国内的加速服务。

🌰 **示例：**

这里提供的镜像地址仅供参考，可以到对应的云服务商找到对应的镜像加速地址。

![镜像加速](https://img.mrsingsing.com/docker-image-acceleration.png)

除此之外，在使用 Docker 构建部署应用前最好确认好 Docker 的版本，例如 CentOS 7 系统默认的 Docker 版本是 13，而 `FROM AS` 的语法则需要 Docker 版本 17 以上才支持，这个时候需要先对宿主机的 Docker 进行版本更新。

安装最新版本的 Docker 可以参考：

[CentOS 安装最新版本的 Docker](https://www.jianshu.com/p/2e208721aa39)

升级 Docker 后重启容器出现错误 `Unknown runtime specified docker runc` 的解决方案：

```bash
$ grep -rl 'docker-runc' /var/lib/docker/containers/ | xargs sed -i 's/docker-runc/runc/g'

$ systemctl stop docker

$ systemctl start docker
```

### 服务端项目

接下来我们看看用 Koa 搭建的服务端项目如何部署，类似操作指令就不再重复赘述了，主要谈谈需要注意的地方。

![服务端Dockerfile](https://img.mrsingsing.com/backend-dockerfile.png)

因为项目中通过开启子进程的方式执行 Webpack 命令进行页面的生成，因此我们需要在容器内全局安装 Webpack。

我们看到这里为一个名为 `wait-for-it.sh` 的提供了可执行的权限，而且在后续的 `CMD` 指令中先执行了该脚本文件。应用容器化后，Docker 容器启动时，默认使用非 root 用户执行命令，所以应用内的脚本文件无法正常执行，这时候就需要执行 `chmod a+x` 为脚本文件提供可执行的权限。至于这个脚本的存在意义我们在后面容器通讯的部分再详细说明，暂且跳过。

下面我们谈谈 Dockerfile 中的输入参数 `ARG`、环境变量 `ENV` 以及如何将 Dockerfile 中的环境变量/传入参数在 `CMD` 指令中的使用。

指令 `ARG` 定义一个变量，用户可以在使用 `docker build` 命令使用 `--build-arg <varname>=<value>` 标志，在构建时将其传递给构建器。

```dockerfile
ARG env

# 指定默认值
ARG env=local
```

如果 `ARG` 对应的值有缺省值，并且如果在构建时没有传递值，则构建器使用缺省值。

Dockerfile 的 `ENV` 指令有两种书写方式：

```dockerfile
ENV <key> <value>

# 这种写法键/值与等号之间不能存在空格
ENV <key>=<value>

# 通过斜杠 \ 换行一次性声明多个环境变量
ENV API_URL=example.com \
    NODE_ENV=production \
    COMMAND=dev
```

与 `ARG` 指令对比，`ENV` 始终存在于镜像当中，而 `ARG` 仅在执行时存在。

关于 dockerfile 中的环境变量替换可以阅读官方文档中有关 [环境变量替换](https://docs.docker.com/engine/reference/builder/#environment-replacement) 的相关章节。

`CMD` 指令有三种书写方式：

```dockerfile
# 使用 exec 执行，这类格式在解析时会被解析成 JSON 数组，因此一定要使用双引号
CMD ["command", "instructions", "options"]

# 使用 /bin/sh 中执行，提供给需要交互的应用
# 实际命令会被包装为 sh -c 的参数形式进行执行
CMD command param1 param2
```

指定启动容器时执行命令，每个 Dockerfile 只能有一个 `CMD` 指令。如果指定了多条命令，则只有最后一条会被执行。如果用户启动容器时指定了运行的命令，则会覆盖掉 `CMD` 指定的命令。

在我们的项目中，除了前面谈过的前端项目需要将 API 域名等在 Docker 运行初期动态植入外，服务端项目也需要传入数据库相关的信息。经过实验发现，`exec` 形式的 `CMD` 是通过 Docker 来运行命令的，并不支持参数替换。而 `shell` 形式的 `CMD` 则是通过 Docker 来运行 `sh`，`sh` 再运行我们写的命令，而 `sh` 是支持参数替换的。

所以如果想将 Dockerfile 中的环境变量 `ENV` 或参数 `ARG` 在 `CMD` 指令中使用，就需要采用 `shell` 的形式书写启动命令。

```dockerfile
# docker run 后添加的参数传入
ARG env=production

# 从执行 shell 命令的执行环境中读取 ENV 变量作为 dockerfile 中的 env 变量值
ENV env=${ENV}

# 启动命令是执行脚本 /scripts/setup.sh
# 该脚本需要传入环境变量 env，也就是 dockerfile 中定义的变量
CMD /scripts/setup.sh ${env}
```

### 爬虫项目

接着我们谈谈页面爬虫项目的镜像构建。

由于龙猫 X 主要用于移动端营销活动，页面的加载体验对用户转化率起到至关重要的作用，因此发布页面都经由无头浏览器爬取发布页面的首屏渲染的 HTML 文档以缩减页面的白屏时间。

在 Linux 系统中使用 PhantomJS 需要从源代码仓库中拉取整包，下载速度因众所周知的原因非常慢，所以这里改用阿里国内的镜像作为下载地址，后续经过一系列解压缩、移动文件、建立软链接等，在容器内能够直接通过命令行执行 PhantomJS 的相关命令。

前面提及每个指令都是新的构建层，所以这里也是通过管道连接的方式实现一连串的操作，这种方式是很好的压缩镜像体积的方法。

![爬虫项目 Dockerfile](https://img.mrsingsing.com/spider-dockerfile.png)

### 数据库项目

下面需要对 MongoDB 数据库实现容器化管理。先给大家看看 MongoDB 数据库的 Dockerfile 文件：

![](https://img.mrsingsing.com/mongodb-dockerfile.png)

由于独立部署版本的龙猫 X 在初始化时需要导入默认的数据，例如组件数据、组件类型数据、标签数据、页面类型数据等。我们从已有的项目中导出数据并进行适当修正后，将数据文件保存到项目指定默认数据的目录下，在 Dockerfile 中指定 `RUN` 通过下面的 shell 脚本对数据库进行初始化，并向数据库中导入数据。

![MongoDB 初始化脚本](https://img.mrsingsing.com/docker-entrypoint-initdb.png)

为了提高数据库的扩展性，数据库的用户名、密码、名称可以通过环境变量的方式进行设置，方便不同的团队根据自身需求修改。

我们将四个项目分别通过 `docker build` 命令构建独立的镜像后，通过命令 `docker images` 能够查看到所有已构建的镜像列表，通过 `docker history <image-id>` 命令能够查看镜像构建过程中的细节：包括每层指令执行的指令、构建后的产物占镜像的体积大小等，通过分析构建历史能够让我们掌握依据对 Dockerfile 进行优化。

![容器构建历史](https://img.mrsingsing.com/docker-history.jpg)

除此之外，构建好的镜像需要持久化保存的话，需要 `docker tag` 打标签并 `docker push` 到远程仓库中进行保存。

## 容器互联

我们知道服务端项目运行时是需要与数据库保持连接的，那么 Docker 是否提供某种机制让不同容器之间进行通信呢？

当 Docker 启动时，实际上会自动在宿主机上创建一个 `docker0` 虚拟网桥，相当于 Linux 上的一个 bridge，可以理解为一个软件交换机。它会在挂载到它的网口之间进行转发。

![容器互联](https://img.mrsingsing.com/docker-network.png)

回到我们的需求上，我们需要将服务端项目、数据库项目和爬虫项目包裹在一个网络当中，也就是建立这三个项目对应容器的“局域网”。将容器加入指定的局域网其实很简单，talk is cheap，show you the code：

```bash
# 创建虚拟局域网 `totorox-net` 是该局域网的名称
docker network create -d bridge totorox-net

# 启动容器时带上 `--network <你创建的局域网名称>` 即可加入到指定的局域网内
docker run -d --name totorox-server -p 3012:3012 --network totorox-net ...
```

以此类推在对应的容器启动时也加入局域网内，那么局域网内的容器之间就能够通过加入局域网时随机分配的域名进行访问。

<!-- ![docker network ls 查询 docker]() -->

那么问题来了，从服务端容器的角度出发，怎么知道数据库容器的域名是 `xxx.xxx.xxx.xxx` 呢，总不能每次启动后 `docker network ls` 查看容器分配到的局域网域名，然后再到对应的容器内部进行修改，这显然不太科学。

docker 作为广泛使用的技术，其开源团队显然不会犯如此低级的设计错误。实际上，除了运行容器时将容器加入局域网外，为容器命名也是必不可少的步骤。容器名称类比来理解，相当于我们需要申请购买域名以替代 IP 地址一样，一般用户只需要记住辨识度高的网站地址，访问时通过 DNS 解析到 IP 地址再对服务器进行访问，这里 docker 容器互联的原理是高度类似的，局域网内直接访问容器名称也能解析到对应的容器当中并进行访问。

多说无益，我们看看如何在服务端项目中用 Mongoose 连接数据库容器的 MongoDB：

```js
// username 为数据库账户名称
// password 为数据库账户密码
// containerName 为数据库项目容器的名称
// databaseName 为数据库名称
const uri = `mongodb://${username}:${password}@${containerName}/${databaseName}`;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: false,
});
```

这里踩了不少坑，Mongoose 连接 MongoDB 的域名使用容器名称作为标识，而非使用随机分配的固定 IP 地址，或容器网络的名称。

除此之外，很多中文文章中都没有提到一个遇上机率比较大的坑，就是服务端是需要等待 MongoDB 数据库启动并就绪后，才能连接成功的。

在使用 `docker run` 方式启动容器时要先启动 MongoDB 的容器，再启动服务端项目的容器，两个启动命令执行需要有段时间差，不能执行前一个，马不停蹄地就执行下一个。这是因为 `docker run` 只是作为启动容器的起点，容器内部实际对外服务的数据库正在执行启动中，容器局域网内并不能第一时间对其进行访问，而是需要等待一段时候后暴露的端口才可接受外部请求。在容器外来看，`docker run` 命令执行后容器是启动了，但是内部实际提供服务的数据库还没准备就绪，这就有可能导致服务端项目连接数据库容器出现超时的问题发生。

因此，我们需要对 mongoose 设立重连机制，当连接超时等情况出现时，也能自动对数据库进行重连操作。

```js
const connect = () => {
  mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: false,
  });
};
db.on('error', error => {
  console.error('Error in MongoDB connection:' + error);
  mongoose.disconnect();
});
db.on('disconnected', () => {
  console.log('MongoDB disconnected!');
  connect();
});
db.on('close', () => {
  console.log('Lost MongoDB connection...');
  connect();
  console.log('Reconnect to MongoDB, wait...');
});
```

除了服务端内部进行数据库重连的保障外，后面会提到容器编排也会出现这样的情况，server 项目依赖 database 项目的启动，`docker-compose.yml` 中有个配置项是 `depends_on`，表示等待指定的容器启动后再进行当前容器的启动。在容器的角度来看，它只知道容器的是否已经启动，也可以理解为是否已经执行了 `docker run` 的命令，容器内部的项目是否启动，容器的管不着的，它也不知道，所以如果内部服务启动时间久于容器之间编排启动的时间，同时两者强依赖性质的，那么就会导致某方出现错误，这样的情况大部分出现在对数据库的连接上。

可能由于接收到的反馈太多，官方文档中 [Control startup and shutdown order in Compose](https://docs.docker.com/compose/startup-order/) 也明确表示这个问题，它提供了几个轮训容器服务的解决方案，包括 [wait-for-it.sh](https://github.com/vishnubob/wait-for-it)、[dockerize](https://github.com/jwilder/dockerize) 和 [wait-for](https://github.com/Eficode/wait-for)。

## 服务部署

首先我们先部署好前端项目，前端项目容器内部执行 Nginx 命令启动代理服务器从而转发请求，如果按照前面所列的 Nginx 配置，理论上应该能顺利启动容器。

不过这里也提一下实践中遇到的问题：

```bash
# 启动容器
$ docker run -d --name totorox-admin -p 8200:80 hub.ppmoney.io/telescope/totorox-admin
Starting nginx ... done
Attating to nginx
```

就是执行完毕后，界面会一直停留在 `Attating to nginx`，没有报错也没有提示运行成功。

这个问题，是由于容器内部 `/etc/nginx/conf.d/default.conf` 路径下的 `default.conf` 文件的缺失所导致，换句话说就是 Nginx 启动所需要执行的默认配置丢失了。在容器的层面分析，有可能是因为容器挂载了 `volumes`，而宿主机的 `conf.d` 目录下为空覆盖了容器内部对应目录下的文件，具体原因可以 `docker exec -it totorox-admin .` 进入容器内部检查。

下面罗列了根据构建好的镜像在服务器上启动运行容器：

![运行容器命令](https://img.mrsingsing.com/docker-run.png)

容器启动后，可以输入 `docker ps -a` 查看宿主机上所有的容器列表。

![查看宿主机容器列表](https://img.mrsingsing.com/docker-container-list.jpg)

从上图可以表格中的 STATUS 和 PORTS 可以看出来，有三个容器已经启动，但是 MongoDB 的容器则启动失败了。

查看日志 `docker logs <container-name>` 查看容器的运行日志，找到出错的原因（这里只是为了演示而出错，上述相关代码均验证有效）。

这里可能会有些疑问，是否应该使用 PM2 等守护进程工具对进程进行守护呢？

实际上容器中的应用都应该前台执行运行，而非后台执行，容器内没有后台服务的概念。对于容器而言，其启动程序就是容器应用进程，容器就是为了主进程而存在的，主进程退出，容器就失去了存在的意义。 比如 `CMD service nginx start` 它等同于 `CMD [ "bash", "-c", "service nginx start"]` 主进程实际上是 `bash`，`bash` 也就结束了，`bash` 作为主进程退出了。因此在我们的镜像构建配置文件中，均直接开启服务而非通过 PM2 或 Forever 等工具开启。

容器的启动相对比较简单，根据需要使用配置项即可快速启动/停止容器。但是，每次部署都需要输入一大串的命令，哪天忘记了哪个参数忘了传怎么办，命令的执行顺序调换了怎么，这个时候就需要一种容器编排的方式，让每次容器更新部署都能通过更简便的命令实现。

## 容器编排

docker-compose 负责实现对 Docker 容器集群的快速编排。使用者通过 `docker-compose.yml` 模版文件定义一组关联的应用容器为一个项目。它默认管理对象是项目，通过子命令对项目中的一组容器进行便捷地生命周期管理。简单来说，就是把刚才一连串的命令利用静态的配置文件记录下来，启动容器只需通过 `docker compose up -d` 命令运行即可。

![容器编排](https://img.mrsingsing.com/docker-compose.png)

首先，我们需要注意 `docker-compose` 的版本问题，有的配置项是 version2.0 没有，而 version3.0 新增的，详情直接看官方文档 [Compose file versions and upgrading](https://docs.docker.com/compose/compose-file/compose-versioning/) 即可。

`docker-compose.yml` 定义了启动容器名称、镜像地址、对外暴露的端口、环境变量、数据卷以及容器启动的先后顺序等。

`docker-compose` 启动时会先获取本地镜像，如果本地已经有对应的镜像则会直接使用，如果本地没有找到，则会从远程仓库拉取到本地后再启动。

`restart: always` 配置项可以让容器在内部服务挂掉的时候，自动重新启动内部服务。

仓库公开的代码应该需要对文件进行脱敏，也就是将配置文件（包括登录数据库的用户名密码等）排除公开的文件列表中。

```bash
$ docker run -e VARIABLE1 --env VARIABLE2=foo --env-file ./env.list ubuntu bash
```

---

**参考资料：**

- [Passing variables to Docker](https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file)
- [Pass Docker Environment Variables During The Image Build](https://vsupalov.com/docker-build-pass-environment-variables/)
- [How To Pass Environment Info During Docker Builds](https://blog.bitsrc.io/how-to-pass-environment-info-during-docker-builds-1f7c5566dd0e)
- [How to setup Node environment variable in Dockerfile for running node.js application?](https://stackoverflow.com/questions/42992397/how-to-setup-node-environment-variable-in-dockerfile-for-running-node-js-applica)
- [How to create a Node App within a Docker container with Mongo](https://hn.werick.codes/how-to-create-a-node-app-within-a-docker-container-with-mongo-cjwjd3l4t00067rs18w7035oc)
- [Cannot connect from node to mongo replicaset in docker](http://quabr.com/57123227/cannot-connect-from-node-to-mongo-replicaset-in-docker)
- [Docker Node 项目连接 MongoDB](https://blog.csdn.net/weixin_30466953/article/details/97366689)
- [升级 Docker 后重启容器出现错误 Unknown runtime specified docker-runc](https://blog.csdn.net/wxb880114/article/details/88869215)
- [Mongoose 远程连接 MongoDB，当客户端断开网络重连时报错 topology was destoryed？](https://segmentfault.com/q/1010000010768993)
- [这可能是网络上唯一一篇给前端写的 Docker+Node+Nginx+MongoDB 的本地开发+部署实战](https://juejin.im/post/5ddb3f85e51d45231576af3c)
