---
title: 关于 CDN 内容分发网络
date: '2020-08-20'
path: 'aboute-content-delivery-network'
---

**內容分发网络（Content Delivery Network 或 Content Distribution Network，简称 CDN）** 通过将源站内容分发至 **最接近用户** 的节点，从而 **降低核心系统负载（系统、网络）**，使用户可就近取得所需内容，**提高用户访问的响应速度**。这种技术方案解决了因分布、带宽、服务器性能带来的访问延迟问题，适用于图片小文件、大文件下载、音视频点播、全站加速和安全加速等场景。

## 工作原理

通过在网络各处放置节点服务器所构成的在现有的互联网基础之上的一层智能虚拟网络，CDN 系统能够实时地根据 **网络流量** 和 **各节点的连接**、**负载状况** 以及 **到用户的距离** 和 **响应时间** 等综合信息将用户的请求重新导向离用户最近的服务节点上。

利用公式简述 CDN 可表示为：

```js
CDN = 更智能的镜像 + 缓存 + 流量导流;
```

简单地说，CDN 是一个经策略性部署的整体系统，包括**分布式存储**、**负载均衡**、**网络请求的重定向** 和 **内容管理** 4 个要件，而内容管理和全局的网络流量管理（Traffic Management）是 CDN 的核心所在。

## 工作流程

用户终端访问 CDN 的过程分为两个步骤，一是用户通过 DNS 找到最近的 CDN 边缘节点 IP，二是数据在网络中送达用户终端。

最简单的 CDN 网络由一个 DNS 服务器和几台缓存服务器组成，假设您的加速域名为 `www.taobao.com`，接入 CDN 网络，开始使用加速服务后，当终端用户（广州）发起 HTTP 请求时，处理流程如下：

![CDN Workflow](http://img.mrsingsing.com/about-cdn-cdn-workflow.jpg)

<!-- more -->

1. 当终端用户（广州）向 `www.taobao.com` 下的某资源发起请求时，首先向 LDNS（本地 DNS）发起域名解析请求。
2. LDNS 检查缓存中是否有 `www.taobao.com` 的 IP 地址记录。如果有，则直接返回给终端用户；如果没有，则向授权 DNS 查询。
3. 当授权 DNS 解析 `www.taobao.com` 时，返回域名 CNAME `www.taobao.alicdn.com` 对应 IP 地址。
4. 域名解析请求发送至 DNS 调度系统，并为请求分配最佳节点 IP 地址。
5. LDNS 获取 DNS 返回的解析 IP 地址。
6. 用户获取解析 IP 地址。
7. 用户向获取的 IP 地址发起对该资源的访问请求。
   - 如果该 IP 地址对应的节点已缓存该资源，则会将数据直接返回给用户，例如，图中步骤 7 和 8，请求结束。
   - 如果该 IP 地址对应的节点未缓存该资源，则节点向它的上级缓存服务器请求内容，直至追溯到网站的源站发起对该资源的请求。获取资源后，结合用户自定义配置的缓存策略，将资源缓存至节点，例如，途中的杭州节点，并返回给用户，请求结束。

> Local DNS 通常是你的运营商提供的 DNS，一般域名解析的第一站会到这里
> 回源 HOST 是指 CDN 节点在回源过程中，在源站访问的站点域名。

在步骤四中，DNS 调度系统可以实现负载均衡功能，负载均衡分为全局负载均衡和区域负载均衡，其内部逻辑大致如下：

1. CDN 全局负载均衡设备会根据用户 IP 地址，以及用户请求的内容 URL，选择一台用户所属区域的**区域负载均衡设备**，告诉用户向这台设备发起请求。
2. 区域负载均衡设备会为用户选择一台合适的**缓存服务器**提供服务，选择的依据包括：
   - 根据用户 IP 地址，判断哪一台服务器距用户最近；
   - 用户所处的运营商；
   - 根据用户所请求的 URL 中携带的内容名称，判断哪一台服务器上有用户所需内容；
   - 查询各个服务器当前的负载情况，判断哪一台服务器尚有服务能力。
     基于以上这些条件的综合分析之后，区域负载均衡设备会向全局负载均衡设备返回一台缓存服务器的 IP 地址。
3. 全局负载均衡设备把服务器的 IP 地址返回给用户。

## 组成部分

典型的 CDN 系统由下面三个部分组成：

- **分发服务系统**：最基本的工作单元就是 Cache 设备，Cache（边缘 Cache）负责直接响应最终用户的访问请求，把缓存在本地的内容快速地提供给用户。同时 Cache 还负责与源站点进行内容同步，把更新的内容以及本地没有的内容从源站点获取并保存在本地。Cache 设备的数量、规模、总服务能力是衡量一个 CDN 系统服务能力的最基本的指标。
- **负载均衡系统**：主要功能是负责对所有发起服务请求的用户进行访问调度，确定提供给用户的最终实际访问地址。两级调度体系分为全局负载均衡（GSLB）和本地负载均衡（SLB）。GSLB 主要根据用户就近性原则，通过对每个服务节点进行”最优“判断，确定向用户提供服务的 Cache 的物理位置。SLB 主要负责节点内部的设备负载均衡
- **运营管理系统**：分为运营管理和网络管理子系统，负责处理业务层面的与外界系统交互所必须的收集、整理、交付工作，包含客户管理、产品管理、计费管理、统计分析等功能。

CDN 通常由源站负责内容生产，主干节点负责二级缓存和加速，通常在 BGP 网络。

广义上的内容分发网络可以包含源站一起，甚至多媒体分发（视频）。商业意义上的 CDN 只包含 CDN 提供商的网络，不包含源站。部分 CDN 支持图片及多媒体处理扩展等附加功能：压缩、剪切、水印、鉴黄。

**CDN 切面**

![CDN 切面](http://img.mrsingsing.com/about-cdn-section.jpg)

**CDN 数据流向**

![CDN 切面](http://img.mrsingsing.com/about-cdn-data-flow.jpg)

## 应用场景

### 网站加速

站点或者应用中大量静态资源的加速分发，建议将站点内容进行动静分离，动态文件可以结合云服务器 ECS，静态资源如各类型 HTML、CSS、JS、图片、文件、短视频等，建议结合对象存储 OSS 存储海量静态资源，可以有效加速内容加载速度，轻松搞定网站图片、短视频等内容分发。

![七牛云网站加速](http://img.mrsingsing.com/about-cdn-qiniu-accelerate.png)

建议将 CDN 产品与 OSS 产品结合使用，可以加速资源的加载速度，提高网站图片、短视频等分发效率。

**业务价值：**

- 终端用户访问慢：网站小文件内容多打开速度太慢
- 跨区域访问质量差：终端用户分布在不同区域，不同区域的访问速度和质量高低不一
- 高并发压力大：运营推广期间，源站服务器压力大，容易挂掉，造成服务不可用
- 图片格式分辨率处理复杂：无法根据适合的终端情况进行图片压缩和优化

### 超大文件下载

大文件下载优化加速分发：网站或应用 App 的主要业务为大文件下载，例如：安装包文件 `apk`、音频文件 `mp3`、驱动程序 `exe`、应用更新文件 `zip` 等，平均单个文件大小在 20M 以上，如游戏、各类客户端下载和 App 下载商店等。

![七牛云超大文件下载](http://img.mrsingsing.com/about-cdn-qiniu-file.png)

**业务价值：**

- 终端用户无法下载或者下载太慢。
- 网络环境不稳定时，下载容易中断。重新下载会耗费额外的资源。
- 网站内容不安全，容易被劫持。
- 文件存储成本过高，同时对源站性能要求高。

### 音视频点播

音视频点播优化加速服务：网站或应用 App 的主要业务为视频点播或短视频类。支持例如：`mp4`、`flv`、`rmvb`、`wmv`、`HLS` 等主流视频格式。

视音频点播主要适用于各类视音频站点，如影视类视频网站、在线教育类视频网站、新闻类视频站点、短视频社交类网站以及音频类相关站点和应用。

CDN 支持流媒体协议，例如 RTMP 协议。在很多情况下，这相当于一个代理，从上一级缓存读取内容，转发给用户。由于流媒体往往是连续的，因而可以进行预先缓存的策略，也可以预先推送到用户的客户端。

对于静态页面来讲，内容的分发往往采取 **拉取** 的方式，也即当发现未命中的时候，再去上一级进行拉取。但是，流媒体数据量大，如果出现回源，压力会比较大，所以往往采取主动推送的模式，将热点数据主动推送到边缘节点。

对于流媒体来讲，很多 CDN 还提供 **预处理** 服务，也即文件在分发之前，经过一定的处理。例如将视频转换为不同的码流，以适应不同的网络带宽的用户需求；再如对视频进行分片，降低存储压力，也使得客户端可以选择使用不同的码率加载不同的分片。这就是我们常见的，超清、标清、流畅等。

**业务价值：**

- 终端用户访问视频时打不开视频或容易卡顿，观看不流畅。
- 上传、转码、存储、分发、播放的开发配置流程复杂，点播服务技术门槛高。
- 视频资源容易被劫持或盗用，版权得不到有效保护。
- 终端客户上传的小视频等内容无法被快速审核，导致政策风险。

### 音视频直播

视频流媒体直播服务，支持媒资存储、切片转码、访问鉴权、内容分发加速一体化解决方案。结合弹性伸缩服务，及时调整服务器带宽，应对突发访问流量；结合媒体转码服务，享受高速稳定的并行转码，且任务规模无缝扩展。

### 边缘程序

传统的 CDN 服务是纯粹的缓存和分发服务，缺乏可以直接提供给您的计算能力。访问 CDN 的海量请求中，复杂的计算逻辑必须回服务器源站执行，这增加了您的服务器消耗以及架构的复杂性。ER 可提供直接在 CDN 边缘节点计算处理的能力，将极大提高 CDN 的可定制化，可编程化，从而大量减少需回源的请求，降低用户的请求延时。同时 CDN 边缘节点拥有天然的高可用、高伸缩、全球负载均衡的特性，边缘的计算服务可应用于更多的使用场景。

- Geo：边缘打点服务，可以采集到边缘节点的请求相关信息：如 IP、地理、设备信息等
- Fetch：边缘代理服务，在 JS 代码中调用内置 api fetch 做了 http 自请求，响应给客户端 fetch 的最终内容
- AB test：AB 测试的功能
- Precache/Prefetch：CDN 预热功能，预热任务在响应客户端时将异步完成
- Race：回源同拉功能，将回源速度最快的源站的内容优先返回给客户端
- Log：边缘日志服务，在响应结束后异步地生成日志并回传给您的 Server
- 3xx：回源 302 跟随功能
- Redirect：边缘请求重定向功能
- Deny bot：边缘反爬虫服务
- Waf：边缘 waf 服务，当满足某些条件时，将禁止该请求

通常，使用了 CDN 后，您可以根据延时、下载速度、打开速度、丢包率、回源率和缓存命中率判断加速效果。

## 衡量指标

使用 CDN 加速，能够帮助您分担源站压力，加速资源访问速度。除了通用的数据观测指标外，不同的场景下也有更具体的指标。观测这些指标，不仅可以帮助您体验 CDN 加速的效果，也能观测自身业务使用 CDN 的情况，帮助您更好地做出调整和决策。

### 通用指标

您可以根据以下几个主要性能指标，观察使用 CDN 前后，您的网站情况。这些指标包含但不限于：

- **延时**：指一个数据包从用户的计算机发送到网站服务器，然后再立即从网站服务器返回用户计算机的来回时间。延时越低，性能越好。
- **下载速度**：指用户从网络上或者网络服务器上下载的数据时的传输速度。下载速度越快，性能越好。
- **打开速度**：指用户打开网站的速度。打开速度越快，性能越好。
- **丢包率**：指用户在网络传输中所丢失数据包数量占所发送数据组的比率。
- **回源率**：回源率分为回源请求数比例及回源流量比例两种。
  - **回源请求数比**：指边缘节点对于没有缓存、缓存过期（可缓存）和不可缓存的请求占全部请求记录的比例。越低则性能越好。
  - **回源流量比**：回源流量是回源请求文件大小产生的流量和请求本身产生的流量。所以 `回源流量比=回源流量/（回源流量+用户请求访问的流量）`，比值越低，性能越好。
- **缓存命中率**：指终端用户访问加速节点时，该节点已缓存了要被访问的数据的次数占全部访问次数的比例。缓存命中率越高，性能越好。

> 说明：上文提到的回源率、缓存命中率都是指使用 CDN 后衡量的指标。如果您还没有使用 CDN，那么回源请求数为 100%，缓存命中率为 0。

一般情况下，使用 CDN 后，您的网络延时、丢包率和回源率都会降低，与之相对的下载速度、打开速度、缓存命中率则会提高。但是，由于业务场景和业务类型的不同，即使选择了相同配置的 CDN 服务，实际产生的加速效果也不相同。因此，这里只是提供了定性的指标以供观测。

CDN 的各类应用场景都各自具有一些具体指标。您可以根据您的业务场景，进一步观测。

### 加速小文件的主要指标

小文件，主要指 `html`、`js`、`jpg`、`css` 等文件后缀的网页素材。这类加速对延迟要求较高，因为通常而言，页面加载时间的加长对用户流失会造成巨大影响。

延迟主要包括以下 3 个性能指标：建立连接时间、首包时间、内容下载时间。其中，**首包时间**是最核心的指标。

- 建立连接时间：指 DNS 解析完成，然后找到对应 IP 地址后建立 TCP 连接的过程。建立连接的时间长短，基本可以反映 **CDN 服务的节点资源以及调度能力**。
- 首包时间：指从客户端开始发送请求到收到服务器端发来的第一个包之间所需要的时间。这反映了 CDN 服务节点程序的整体性能。

在上传路径中，首包时间主要包含了 DNS 解析时间、TCP 用时、SSL 用时、发送时间和响应时间。上传

![CDN Upload Flow](http://img.mrsingsing.com/about-cdn-upload-flow.png)

在下载路径中，首包时间主要包含了 DNS 解析时间、TCP 用时、SSL 用时、发送时间、响应时间和下载用时。下载

![CDN Download Flow](http://img.mrsingsing.com/about-cdn-download-flow.png)

### 加速大文件下载的主要指标

大文件下载，一般指各类单个文件大小大于 20M 的下载。因此对这类场景，最核心的指标就是 **下载速度** 和 **下载总时间**。

### 加速音视频点播的主要指标

视音频点播的场景，主要涵盖 `flv`、`mp4`、`wmv`、`mkv` 等视音频文件。在这类场景中的主要衡量指标包括首播时间和卡顿率：

- **首播时间**：首播时间是从打开到看到视频画面的时间。往往会受域名解析、连接、首包时间的影响。
- **卡顿率**：卡顿指视音频播放、资源加载等场景下出现画面滞帧。因此卡顿率主要指把所有用户播放视频的卡顿时间上报，每 100 个用户里面播放出现卡顿的比例。卡顿率越低，性能越好。

## CDN 提供商

每个 CDN 服务提供商的配置信息不同。

- [阿里云](https://www.aliyun.com/product/cdn)
- [腾讯云](https://cloud.tencent.com/product/cdn)
- [华为云](https://www.huaweicloud.com/product/cdn.html)
- [七牛云](https://www.qiniu.com/products/fusion)

### 动态 CDN

动态加速针对动态资源进行加速分发。

- **边缘计算的模式**：既然数据是动态生成的，所以 **数据的逻辑计算和存储**，也相应的放在边缘的节点。其中定时从源数据那里同步存储的数据，然后在边缘进行计算得到结果。就像对生鲜的烹饪是动态的，没办法事先做好缓存，因而将生鲜超市放在你家旁边，既能够送货上门，也能够现场烹饪，也是边缘计算的一种体现。
- **路径优化的模式**：数据不是在边缘计算生成的，而是在源站生成的，但是数据的下发则可以通过 CDN 的网络，对路径进行优化。因为 CDN 节点较多，能够找到离源站很近的边缘节点，也能找到离用户很近的边缘节点。中间的链路完全由 CDN 来规划，选择一个更加可靠的路径，使用类似专线的方式进行访问。

对于常用的 TCP 连接，在公网上传输的时候经常会丢数据，导致 TCP 的窗口始终很小，发送速度上不去。根据前面的 TCP 流量控制和拥塞控制的原理，在 CDN 加速网络中可以调整 TCP 的参数，使得 TCP 可以更加激进地传输数据。可以通过多个请求复用一个连接，保证每次动态请求到达时。连接都已经建立了，不必临时三次握手或者建立过多的连接，增加服务器的压力。另外，可以通过对传输数据进行压缩，增加传输效率。所有这些手段就像冷链运输，整个物流优化了，全程冷冻高速运输。不管生鲜是从你旁边的超市送到你家的，还是从产地送的，保证到你家是新鲜的。

### 刷新预热

- 刷新功能是指提交 URL 刷新或目录刷新请求后，CDN 节点的缓存内容将会被强制过期，当您向 CDN 节点请求资源时，CDN 会直接回源站获取对应的资源返回给您，并将其缓存。刷新功能会降低缓存命中率。
- 预热功能是指提交 URL 预热请求后，源站将会主动将对应的资源缓存到 CDN 节点，当您首次请求时，就能直接从 CDN 节点缓存中获取到最新的请求资源，无需再回源站获取。预热功能会提高缓存命中率。

## 参考资料

- [📖 维基百科：内容分发网络](https://zh.wikipedia.org/wiki/%E5%85%A7%E5%AE%B9%E5%82%B3%E9%81%9E%E7%B6%B2%E8%B7%AF)
- [📝 CDN 的基本工作过程](http://book.51cto.com/art/201205/338756.htm)
- [📝 CDN 知识详解](https://zhuanlan.zhihu.com/p/28939811)
- [📝 HTTP 缓存与 CDN 缓存配置指南](http://dopro.io/http-cache-and-cdn-cache.html)
- [📝 江湖失传的最后一份 CDN 秘籍](https://zhuanlan.zhihu.com/p/31167721?group_id=915177705310674944)
- [📝 CDN HTTPS 安全加速基本概念、解决方案及优化实践](https://juejin.im/post/59f9538f6fb9a0450a66aa2b)
- [📝 面向前端的 CDN 原理介绍](https://github.com/renaesop/blog/issues/1)
- [📝 阿里云 CDN 文档：CDN 的衡量指标](https://help.aliyun.com/document_detail/140425.html)
- [📝 SSR 页面 CDN 缓存实践](https://juejin.im/post/6847902220222988301)