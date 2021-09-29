---
title: 常用移动前端开发调试方式
date: '2020-05-27'
---

# 常用移动前端开发调试方式

因为日常开发经常需要在移动设备上调试测试开发的 H5 页面，但是一直都没怎么总结过移动前端开发相关的调试工具或方法，今天稍微总结一下比较好用的调试工具，也罗列了一些没有用过但是值得了解的工具

## 通用调试工具方法

### Chrome 移动设备模拟器

Chrome 浏览器开发者工具内置了可用于模拟移动设备的功能，这也是最常用的调试方式，这里只是简单说明操作步骤：

1. 在 PC 端打开 Chrome 浏览器并打开目标页面，然后 F12 打开开发者工具
2. 点击开发者工具左上角的手机图标，刷新页面后即可调试
3. 页面顶部设备选择下拉菜单可选择默认的多种品牌机型，以及仿真的网络状态
4. 选择下来菜单中的 `Edit` 进入适配设备的机型选择，既有浏览器提供的机型，也可以根据需要设定自定义机型（主要是测试宽高比）

因为使用起来方便，所以开发调试的大部分都能满足需求，但是要更仿真更严谨还是需要在真机中调试。

### vConsole 移动端网页上的调试控制台

[vConsole](https://github.com/Tencent/vConsole) 是一款轻量级、可拓展、针对手机网页的前端开发者调试面板。

通过该工具可以方便地在移动真机的 Web 页面中通过以下特性实现调试功能：

- 查看 console 日志
- 查看网络请求信息
- 查看页面 element 结构
- 查看 Cookie、localStorage 和 SessionStorage
- 手动执行 JavaScript 命令行
- 自定义插件

<!-- more -->

这款类库应该是使用最广泛的工具，而且使用起来也比较简单，与 PC 端 Chrome 等开发者调试工具使用方式类似，所以就不多叙述了。

更多关于此工具的使用教程可以参阅 [vConsole 使用教程](https://github.com/Tencent/vConsole/blob/dev/doc/tutorial_CN.md)

除此之外，有个同样是 AlloyTeam 出品的错误监控上报、支持生产环境通过 URL 带参数唤起 vConsole 的库 [AlloyLever](https://github.com/AlloyTeam/AlloyLever) 也值得关注一下。

同类型的产品有 [eruda](https://github.com/liriliri/eruda)

#### 实现原理

通过在页面注入 JavaScript 脚本实现模拟类似 Chrome DevTool 的调试面板。

通过重写 `XHMLHttpRequest`、`fetch`、`console` 方法实现网络请求和日志打印的拦截，并输出到控制面板中的 `Network` 和 `Console` 标签。

通过遍历 Cookie、LocalStorage、SessionStorage 对象下的所有存储键值以获取当前网页的本地存储数据。

而 `Element` 标签中的页面 DOM 树结构，则通过从 `document.documentElement` 节点开始向子孙节点递归生成。

### Charles 数据传输抓包工具

试想以下在日常开发中可能会遇到的场景：

1. 在本地开发完移动 H5 页面后，想与后端联调接口，但是接口部署在机房服务器上，域名非 IP 地址，这个时候联调会存在跨域问题，应该怎样解决？
2. 线上 Web App 表现异常，没法在线上页面使用调试面板进行调试，怎样定位问题？
3. 线上 Web App 表现异常，接口请求响应表现正常，单从代码层面无法定位问题根源，怎样更好地定位问题？

在 Charles 强大的抓包功能面前，这些问题通通都不是问题。我们先介绍一下 Charles：

[Charles](https://www.charlesproxy.com/) 是一款基于 HTTP 协议的代理服务器，通过截取请求和请求结果达到分析抓包的目的。

以下是 Charles 的功能特性：

- 支持 HTTP 和 HTTPS 代理，截取分析 SSL 请求
- 支持流量控制，可以模拟弱网测试环境
- 支持接口并发请求
- 支持重发网络请求，方便后端调试
- 支持修改网络请求参数
- 支持网络请求的截获并动态修改
- 支持断点调试，构建异常的测试场景

#### 使用方式

使用 Charles 抓包手机向服务器发送请求的操作步骤：

1. 安装根证书：`菜单 -> Help -> SSL Proxying -> Install Charles Root Certificate`

![安装根证书](https://img.mrsingsing.com/wireless-debugger-install-charles-certificate.jpg)

2. 找到安装好 Charles 的根证书后，确保证书的所有选项均为始终信任（这个证书后续会下载到你的手机中使用）

![总是信任](https://img.mrsingsing.com/wireless-debugger-always-trust-certificate.jpg)

3. 然后开启 Charles 的代理服务：`Proxy -> Proxy Setting`，`port` 端口填 `8888`，选中 `Enable transparent HTTP proxying`

找到当前使用的 Mac 笔记本的 IP 地址（通过 `Charles -> Help -> Local IP Address` 可以获取）

![开启Charles代理](https://img.mrsingsing.com/wireless-debugger-enable-charles-proxying.jpg)

4. 给 iPhone 设置代理

- 打开 iPhone，连接 Wifi（需要确保 iPhone 与 Mac 连接的是相同的 Wifi）
- 打开 Wifi 名后的蓝色感叹号，在最下面找到 `HTTP 代理`，点击进入
- 选择 `手动`，服务器上填上端口号 `8888`

5. 随便打开网页，这个时候 Charles 会弹出请求连接的确认菜单，选择左边选项 `Allow`

6) 在手机浏览器中（最好是 Safari），输入 `chls.pro/ssl`，会弹出安装证书的请求，输入密码，一直点安装即可

- 打开设置，点击 `通用 -> 关于本机 -> 证书信任设置`，找到当前要作为代理的电脑名，打开信任开关

这个时候既可以截取到 HTTP/HTTPS 的网络请求了。

#### 实现原理

![Charles实现原理](https://img.mrsingsing.com/wireless-debugger-charles-principle.jpg)

事实上 Charles 就是充当所谓的 `中间人` 角色，把我们的设备发送的请求拦截下来，并转发给我们的目标服务器，而后将响应的信息返回给我们的设备。

前提是设备上需要安装并信任 Charles 的证书，这个为了当 HTTPS 传输时，Charles 需要拦截解密数据并利用服务端的证书公钥和 HTTPS 连接的对称密钥做后续的传输加密。

由于本人使用 Charles 比较多，但其实还有很多类似的抓包工具，例如：

- 软件类
  - [Fiddler](https://www.telerik.com/fiddler)
  - [Wireshark](https://www.wireshark.org/download.html)
  - [Weinre](https://github.com/nupthale/weinre)：基于 Web Inspector 的远程调试工具，可以在 PC 上直接调试运行在手机上的页面
- 工具包类
  - [spy-debugger](https://github.com/wuchangming/spy-debugger)：一站式页面调试、抓包工具，能远程调试任何手机浏览器页面，任何手机移动端 Webview，无需 USB 连接设备（实现原理与 Charles 类似）
  - [whistle](https://github.com/avwo/whistle)：基于 Node 实现的跨平台抓包调试代理工具，功能强大，支持 WebSocket、反响代理、插件扩展等特性

## 基于 iOS 的开发调试

### Safari + 数据线 远程设备调试

前期准备：iPhone + MacBook + 各自安装 Safari

调试方式：

1. 打开 iPhone `设置 -> Safari 浏览器 -> 高级 -> Web 检查器`
2. 打开 MacBook 上的 Safari 浏览器 `偏好设置 -> 高级 -> 在菜单栏中显示“开发”菜单`
3. 用数据线连接 iPhone 和 MacBook，并选择 `信任` 设备，在 iPhone 上的 Safari 浏览器打开需要调试的页面，并在 MacBook 上的 Safari 中选择 `开发 -> （连接设备名称）-> （调试页面域名）`
4. 选中后会出现如下图所示的界面，这样就可以实现如 PC 端的调试功能

如果 Safari 调试面板一片空白可以下载个 [Safari Technology Preview](https://developer.apple.com/safari/download/)

## 基于 Android 的开发调试

### Chrome + USB 远程设备调试

通过安卓手机与任意系统的电脑同时安装 Chrome 浏览器，并通过 USB 进行有线连接，可以通过浏览器内置的功能实现远程调试，简单来说就是通过 PC 端 Chrome 的开发者工具调试手机上 Chrome 打开的网页。

调试方式：

1. Android 手机和 PC 电脑同时下载 Chrome 浏览器
2. 打开 Android 手机 `设置 -> 开发者选项 -> USB 调试`（可能不同厂商的设定不一致，最终目的就是打开 USB 调试，如果打开路径不一样的，可以自行探索或搜索对应设备打开 USB 调试的方式）。
3. 利用 USB 数据线，将 Android 手机与 PC 电脑连接，手机理论上会提示是否允许 USB 调试，选择 `确认` 的选项的就好了
4. 打开 PC 电脑上的 Chrome 浏览器，打开开发者工具 `Console -> 右侧 Customize and control DevTools -> More tools -> Remote devices`
5. 每个页面右侧均有一个 Inspect 检查的按钮，点击就会出现你熟悉的画面，

更详尽的调试方式可以参考 Google 官方的开发者文档相关章节：

- [Android 设备的远程调试入门](https://developers.google.com/web/tools/chrome-devtools/remote-debugging/)
- [访问本地服务器](https://developers.google.com/web/tools/chrome-devtools/remote-debugging/local-server)
- [远程调试 WebView](https://developers.google.com/web/tools/chrome-devtools/remote-debugging/webviews)

## 微信

### 微信开发者工具

微信生态包括公共号网页开发、小程序、小游戏等使用微信开发者工具就行了，这没有什么争议，毕竟官方提供的工具。

[文档：微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)

### 缓存清除方法

这里提提搜到的一个微信内网页缓存的清除方法：

1. 微信中打开网页 [http://debugx5.qq.com](http://debugx5.qq.com)
2. 滑动到底部，选中四个缓存选项 `Cookie`、`文件缓存`、`广告过滤缓存` 和 `DNS 缓存`，点击清除即可

## 其他付费服务

在调研过程中也发现了一些挺不错的付费调试工具：

- [岩鼠：提供租用的云端真机平台远程调试，覆盖市面热门品牌机型](https://yanshu.effirst.com/)
- Charles Proxy on iOS：iOS 版的 Charles，可以直接在 iPhone 手机上调试

---

**参考资料：**

- [移动端前端开发调试](https://yujiangshui.com/multidevice-frontend-debug/)
- [各种真机远程调试方法汇总](https://github.com/jieyou/remote_inspect_web_on_real_device)
- [H5 移动调试全攻略](https://zhuanlan.zhihu.com/p/51794821)
- [移动端调试痛点？送你五款开发利器](https://juejin.im/post/5b72e1f66fb9a009d018fb94)
- [你需要的 App 内 H5 的调试方法](https://zhuanlan.zhihu.com/p/103642413)
- [微信开发如何做本地调试](https://www.zhihu.com/question/25456655)
