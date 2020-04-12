---
title: 前端相关业务性能优化技术手段总结
date: '2019-05-19'
description: 总结从客户端到服务端全链路可优化的技术方法
---

技术社区中其实已经有较多的关于前端性能优化的相关文章，看了多篇之后总是觉得内容还有很多遗漏或写得不够完美，尽管还没接手过流量特别大的网站应用项目，但是本人认为日常项目中也需要尽可能地进行性能优化的工作，因为前端工程师的工作很大程度上可以描述为“用尽量少的代价为用户提供效率尽可能高、功能尽可能多、体验尽可能好的网页应用”，而性能优化很大程度上就是实现“尽可能少的代价”、“效率尽可能高”以及“体验尽可能好”。

因此，此文会根据网络请求到网页呈现的完整流程，针对性地提出相关阶段供开发决策者考虑采取的优化方案，因此本文更像是性能优化方案的决策树，而非标准方案：

- 网络链路层面
- 服务端层面
- 客户端渲染层面
- 编码层面

**网络请求到网页呈现的大致流程**

```
发送网络请求 => 网络链路 => 返回资源(服务端) => 渲染资源(客户端)
```

# 关键渲染路径

在提出各层次的优化方案之前，有必要了解一下性能优化方案实际上解决了哪些性能问题以及解决这些问题的核心归结点。

以下部分关于优化关键渲染路径的建议摘录自 Google 开发者文档：
[📖 Optimizing the Critical Rendering Path](https://developers.google.com/web/fundamentals/performance/critical-rendering-path/optimizing-critical-rendering-path)

为了尽快完成首次渲染，我们需要最大限度减小以下三种可变因素：

- 关键资源的数量
- 关键路径长度
- 关键字节的数量

关键资源是可能阻止网页首次渲染的资源。这些资源越少，浏览器的工作量就越小，对 CPU 以及其他资源的占用也就越少。

同样，关键路径长度受所有关键资源与其字节大小之间依赖关系图的影响：某些资源只能在上一资源处理完毕之后才能开始下载，并且资源越大，下载所需的往返次数就越多。

最后，浏览器需要下载的关键字节越少，处理内容并让其出现在屏幕上的速度就越快。要减少字节数，我们可以减少资源数（将它们删除或设为非关键资源），此外还要压缩和优化各项资源，确保最大限度减小传送大小。

**优化关键渲染路径的常规步骤如下：**

1. 对关键路径进行分析和特性描述：资源数、字节数、长度
2. 最大限度减少关键资源的数量：删除它们，延迟它们的下载，将它们标记为异步等
3. 优化关键字节数以缩短下载时间（往返次数）
4. 优化其余关键资源的加载顺序：您需要尽早下载所有关键资产，以缩短关键路径长度

# 网络链路层面

网络链路作为网络资源和数据的传输通道，充分利用网络技术手段能有效地减少网页资源响应的速度、提升网页资源传输速度以及避免重复传输导致的资源浪费等问题。

## 传输策略

### DNS 查询

DNS 域名解析协议简单来就说负责将域名 URL 转化为服务器主机 IP。了解更多 [DNS 域名解析协议](https://tsejx.github.io/JavaScript-Guidebook/computer-networks/dns.html)

DNS 查询能从两方面进行优化：

- **减少 DNS 查询次数**
- **DNS 预解析**

通过在文档中使用值为 `http-equiv` 的 `<meta>` 标签打开 DNS 预解析：

```html
<meta http-equiv="x-dns-prefetch-control" content="on" />
```

通过 `rel` 属性值为 `dns-prefetch` 的 `<link>` 标签对特定域名进行预读取

```html
<link rel='dns-prefetch" href="//host_name_to_prefetch.com"/>
```

**相关链接：**

- [MDN：X-DNS-Prefetch-Control](https://developer.mozilla.org/zh-CN/docs/Controlling_DNS_prefetching)
- [DNS Prefetching](https://dev.chromium.org/developers/design-documents/dns-prefetching)
- [DNS Prefetching for Firefox](https://bitsup.blogspot.com/2008/11/dns-prefetching-for-firefox.html)

### TCP 连接

**持久化连接**：避免重复进行 TCP 的三次握手，HTTP/1.1 默认开启，HTTP/1.0 可以使用。

Keep-Alive 不会永久保持连接，开发者可通过服务器配置限定时间。

```http
Connection: keep-alive
```

### HTTP 请求

- **减少 HTTP 请求**
  - 通过前端构建工具合并脚本和样式表
  - CSS Sprites 精灵图
  - 图片使用 Base64 编码嵌入网页，减少图片外部载入的请求数
- **资源分布式部署至不同域名**
  - **原因**：主流浏览器对相同域名的并发 HTTP 请求数限制在 4~8 个，当资源过多时，可以采用增加域名的方法增加 HTTP 请求的并发量
  - **原理**：利用多个不同的域名可以保证这些域名能够同时加载图片，而不用排队。不过如果当使用的域名过多时，响应时间就会慢，因为不同响应域名时间不一致
- **避免重定向**
  - URL 末尾应该添加 `/` 但未添加
- **消除不必要的请求字节**
- **Cookie**
  - 压缩 Cookie 大小
    - 去除不必要的 Cookie
    - 注意设置 Cookie 的 domain 级别，如没必要，不要影响子域名
    - 设置合适的过期时间
  - 静态资源使用无 Cookie 域名
- [HTTP/2](https://tsejx.github.io/JavaScript-Guidebook/computer-networks/http/http2.html)
  - 二进制分帧
  - 多路复用
  - 服务器推送
  - 头部压缩
  - 了解更多 [HTTP/2]
- [HTTP/3](https://zh.wikipedia.org/wiki/HTTP/3)

**相关链接：**

- [前端性能优化 - 资源预加载](http://bubkoo.com/2015/11/19/prefetching-preloading-prebrowsing/)
- [HTTP/2 简介和基于 HTTP/2 的 Web 优化](https://github.com/creeperyang/blog/issues/23)

## 缓存策略

制定有效的缓存策略，很大程度上能实现资源的重复利用及传输路径的优化，减少客户端对服务端的网络请求压力，减轻宽度流量。

- [HTTP 缓存](https://tsejx.github.io/JavaScript-Guidebook/browser-object-model/browser-cache/http-cache.html)
  - [强缓存](<[https://tsejx.github.io/JavaScript-Guidebook/browser-object-model/browser-cache/http-cache.html#%E5%BC%BA%E7%BC%93%E5%AD%98](https://tsejx.github.io/JavaScript-Guidebook/browser-object-model/browser-cache/http-cache.html#强缓存)>)
    - Expires 绝对时间 `Expires: Thu, 21 Jan 2017 23:59:59 GMT` 服务器和客户端时间可能不一致
    - Cache-Control 相对时间 `Cache-Control: max-age=3600`
  - [协商缓存](<[https://tsejx.github.io/JavaScript-Guidebook/browser-object-model/browser-cache/http-cache.html#%E5%8D%8F%E5%95%86%E7%BC%93%E5%AD%98](https://tsejx.github.io/JavaScript-Guidebook/browser-object-model/browser-cache/http-cache.html#协商缓存)>)
    - Last-Modified / If-Modified-Since 绝对时间 `Expires: Wed, 26 Jan 2017 00:35:11 GMT` 资源上次修改的时间
    - Etag / If-None-Match 随机生成的乱码值
  - 优先使用强缓存
    - 当资源文件发生变化时，通过更新页面中引用的资源路径，让浏览器放弃缓存，加载新资源
    - 通过 [数据摘要算法](https://link.zhihu.com/?target=http%3A//baike.baidu.com/view/10961371.htm) 精准到单个文件粒度的缓存控制
- [CDN 缓存](https://tsejx.github.io/JavaScript-Guidebook/computer-networks/cdn.html)： 将静态资源和动态网页分集群部署
  - HTML 部署在自身的服务器上
  - 打包后的图片 / JavaScript 脚本文件 / CSS 样式文件等资源部署到 CDN 节点上，文件带上 Hash 值
  - 由于浏览器对单个域名请求的限制，可以将资源放在多个不同域的 CDN 上，可以绕开该限制
  - CDN 没有 Cookie，使用 CDN 可以减少 Cookie
  - CDN 会自动合并脚本文件等，减少请求数量
  - 但是，CDN 同时也增加了域名，增大了同时请求数量
- **服务器缓存：**将不变的数据、页面缓存到**内存**或**远程存储**（如 Redis 等）上
- **浏览器缓存**: 通过设置请求的过期时间，将各种不常变的数据进行缓存，合理运用浏览器缓存，缩短数据的获取时间
  - [Cookie](https://tsejx.github.io/JavaScript-Guidebook/browser-object-model/browser-cache/cookie.html)
  - [WebStorage](https://tsejx.github.io/JavaScript-Guidebook/browser-object-model/browser-cache/web-storage.html)
    - LocalStorage
    - SessionStorage
  - IndexDB
  - [ServiceWorker](https://tsejx.github.io/JavaScript-Guidebook/html5-scripting-programming/offline-and-storage/service-worker.html)
  - AppCache：采用 mainfest 文件进行缓存

**相关链接：**

- [大公司里怎样开发和部署前端代码？](https://www.zhihu.com/question/20790576)
- [使用 SRI 增强 LocalStorage 代码安全](https://link.juejin.im/?target=https%3A%2F%2Fimququ.com%2Fpost%2Fenhance-security-for-ls-code.html)

# 服务端层面

由于本文只涉及前端性能优化，但为求流程完整，简单罗列与服务端相关的优化方案的常见手段。

- 多域名资源加载
- 负载均衡
- 数据缓存
- 反向代理

# 客户端层面

- 资源渲染数量/大小
- 资源渲染路径
- 用户体验

## 资源渲染数量/大小

- **压缩静态资源，清除无用代码**
  - Tree Shaking 无用代码移除
  - UglifyJs 混淆 / 压缩代码
  - Code Spliting 代码分割（资源按需加载或并行加载）
- **开启 Gzip 压缩**
  - 请求头 `Accept-Encoding: gzip, deflate`
  - 响应头 `Content-Encoding: gzip`
  - Gzip 能够压缩任何文本类型的响应，包括 HTMl、XML 和 JSON
  - 已经压缩过的内容如图片、和 PDF 不要使用 Gzip，这些资源内容本身体积就小，再使用 Gzip 反而会增加资源下载时间，浪费 CPU 资源，而且有增加文件体积的可能
- **多份编译文件按条件引入**
  - 针对现代浏览器直接给 ES6 文件，只针对低端浏览器引用编译后的 ES5 文件
  - 可以利用 `<script type="module"> / <script type="module">`进行条件引入用
- **动态 Polyfill**
  - 只针对不支持的浏览器运行环境引入 Polyfill
- **图片优化**
  - 根据业务场景，与 UI 探讨选择 **合适质量，合适尺寸**
  - 根据需求和平台，选择 **合适格式**，例如非透明时可用 jpg；非苹果端，使用 webp
  - 小图片合成 **雪碧图 CSS Sprite**，低于 5K 的图片可以转换成 B**ase64** 内嵌
  - 合适场景下，使用 I**confont** 或者 **SVG**
  - 压缩 favicon.ico 并缓存
  - 使用 Blob 异步加载
  - 使用 [img-2](https://link.juejin.im/?target=https%3A%2F%2Fgithub.com%2FRevillWeb%2Fimg-2) 代替 img 标签
  - 嵌入资源：Base64 嵌入资源（针对小的静态图片资源）
- **字体优化**
  - 浏览器为了避免 FOUT（Flash Of Unstyled Text），会尽量等待字体加载完成后，再显示应用了该字体的内容。带来了 FOIT（Flash Of Invisible Text 问题），导致空白
  - 设置多字体，降级方法：使用默认字体
  - 异步加载字体文件：通过异步加载 CSS，即可避免字体阻塞渲染，还是会空白
- **多媒体优化**
  - 音视频

## 资源渲染路径

- **优化加载顺序**
  - CSS 样式文件放在文档 `<head>` 标签中引入
    - 把样式表放在 `<head>` 中可以让页面渐进渲染，尽早呈现视觉反馈，给用户加载速度很快的感觉
  - JavaScript 脚本文件放在 `<body>` 标签底部引入
    - **原因**：加载脚本文件会对后续资源渲染造成阻塞
    - **方案**：制定合理的脚本文件加载策略
      - 动态脚本加载（异步加载、延迟加载、按需加载）
      - 添加 `defer` 属性的脚本文件是在 HTML 解析完之后才会执行。如果是多个，按照加载的顺序依次执行
      - 添加 `async` 属性的脚本文件是在加载之后立即执行，如果 HTML 还没解析完，会阻塞 HTML 继续解析。如果是多个，执行顺序和加载顺序无关
  - 影响首屏的，优先级很高的脚本文件也可以 `<head>` 或 `<body>` 首子节点引入，甚至利用 `style` 或 `script` 内联
- **资源加载方式**

  - 非关键性的文件尽可能的**异步加载和延迟加载**，避免阻塞首页渲染
  - **资源提示指令**
    - Preload
    - Prefetch
    - Preconnect
    - Subresource
  - **异步加载（预加载）**
    - 利用浏览器空闲时间请求将来要使用的资源，以便用户访问下一页面时更快地响应
    - 预判用户的行为，提前加载所需要的资源，则可以快速地响应用户的操作，从而打造更好的用户体验。另一方面，通过提前发起网络请求，也可以减少由于网络过慢导致的用户等待时间。
    - Preload 规范 W3CPreload
      - rel 明确告知浏览器启用 preload 功能
      - as 明确需要预加载资源的类型，包括 JavaScript、Images、CSS、Media 等
  - **延迟加载（懒加载、按需加载）**
    - 页面初始加载时将非绝对必须的资源延迟加载，从而提高页面的加载和响应速度
      - 非首屏使用的数据、样式、脚本、图片等
      - 用户交互时才会显示的内容
    - **实现方式：**
      - 虚拟代理技术：真正加载的对象事先提供一个代理或者说占位符。最常见的场景是在图片的懒加载中，先用一种 loading 的图片占位，然后再用异步的方式加载图片。等真正图片加载完成后就填充进图片节点中去。
      - 惰性初始化技术：将代码初始化的时机推迟（特别是那些初始化消耗较大的资源）
    - **选择时机：**
      - 滚动条监听：大型图片流场景，通过对用户滚动结束区域进行计算，从而只加载目标区域的资源，这样可以实现节流的目的
      - 事件回调：常用于需要用户交互的地方，如点击加载更多之类的，这些资源往往通过在用户交互的瞬间（如点击一个触发按钮），发起 AJAX 请求来获取资源。比较简单，在此不再赘述。
    - 遵循渐进增强理念理念开发网站：JavaScript 用于增强用用户体验，但没有（不支持） JavaScript 也能正常工作，完全可以延迟加载 JavaScript
    - 将首屏以外的 HTML 放在不渲染的元素中，如隐藏的 `<textarea>`，或者 `type` 属性为非执行脚本的 `<script>` 标签中，减少初始渲染的 DOM 元素数量，提高速度。等首屏加载完成或者用户操作时，再去渲染剩余的页面内容。

- **资源渲染**
  - 避免重排，减少重绘，避免白屏，或者交互过程中的卡顿
  - 通过 [CSS Trigger](https://csstriggers.com/) 查询哪些样式属性会触发重排与重绘
  - **减少重排的方法**
    - 页面初始化
    - 减少对 DOM 元素内容改变（如：文本改变、图片被另一个同尺寸元素替代）
    - 减少对 DOM 元素尺寸改变（因为边距、填充、边框宽度、宽度、高度等属性改变）
    - 减少对 DOM 元素位置改变
    - 减少对可见 DOM 元素的操作（如：增加、移动和删除）
      - 多次 DOM 操作合并为一次处理
      - 大量操作时，可将 DOM 脱离文档流或者隐藏，待操作完成后再重新恢复
    - 减少旋转屏幕的操作
    - 减少改变浏览器窗口尺寸的操作
    - 减少设置元素 style 属性
    - 减少设置元素 class 属性
    - 通过延迟访问布局信息避免重排版
      - 如 `offsetWidth`、`offsetHeight` 和 `getComputedStyle` 等
      - 原因：浏览器需要获取最新准确的值，因此必须立即进行重排，这样会破坏了浏览器的队列整合，尽量将值进行缓存使用
    - 减少在 HTML 中缩放图片
    - 避免对大部分页面进行重排版
      - 使用绝对坐标定位页面动画的元素，使它位于页面布局流之外
      - 启动元素动画，当它扩大时，它临时覆盖部分页面
      - 当动画结束时，重新定位，从而只一次下移文档其他元素的位置
    - 开启 GPU 加速
      - transform
      - opacity
      - filter

**相关链接：**

- [前端性能优化之加载技术](https://juejin.im/post/59b73ef75188253db70acdb5#heading-5)
- [资源提示——什么是 Preload，Prefetch 和 Preconnect？](https://juejin.im/post/5b5984b851882561da216311)
- [preload-webpack-plugin](https://link.juejin.im/?target=https%3A%2F%2Fgithub.com%2FGoogleChrome%2Fpreload-webpack-plugin)
- [Preload 技术细节](https://link.juejin.im/?target=https%3A%2F%2Fwww.smashingmagazine.com%2F2016%2F02%2Fpreload-what-is-it-good-for%2F)

## 用户体验

- 谨慎控制好 Web 字体，一个大字体包足够让你功亏一篑
  - 控制字体包的加载时机
  - 如果使用的字体有限，那尽可能只将使用的文字单独打包，能有效减少体积
- 分清轻重缓急
  - 重要的元素优先渲染
  - 视窗内的元素优先渲染
- 服务端渲染（SSR）
  - 减少首屏需要的数据量，剔除冗余数据和请求
  - 控制好缓存，对数据/页面进行合理的缓存
  - 页面的请求使用流的形式进行传递
- 优化用户感知
  - 利用一些动画 **过渡效果**，能有效减少用户对卡顿的感知
  - 尽可能利用 **骨架屏（Skeleton）/ Loading** 等减少用户对白屏的感知
  - 动画帧数尽量保证在 **30 帧** 以上，低帧数、卡顿的动画宁愿不要
  - JavaScript 执行时间避免超过 100ms ，超过的话就需要做：
    - 寻找可缓存的点
    - 任务的分割异步或 web worker 执行

# 编码层面

编码优化，指的就是在代码编写时的，通过一些 **最佳实践**，提升代码的执行性能。通常这并不会带来非常大的收益，但这属于**程序员的自我修养**，而且这也是面试中经常被问到的一个方面，考察自我管理与细节的处理。

## JavaScript 优化

- **数据读取**
  - 通过作用域链 / 原型链读取变量或方法时，需要更多的耗时，且越长越慢
  - 对象嵌套越深，读取值也越慢
  - 最佳实践：
    - 尽量在局部作用域中进行 **变量缓存**
    - 避免嵌套过深的数据结构，**数据扁平化** 有利于数据的读取和维护
- **循环**：循环通常是编码性能的关键点
  - 代码的性能问题会在循环中被指数倍放大
  - 最佳实践:
    - 尽可能 减少循环次数；
      - 减少遍历的数据量
      - 完成目的后马上结束循环
    - 避免在循环中执行大量的运算，避免重复计算，相同的执行结果应该使用缓存
    - JavaScript 中使用 **倒序循环** 会略微提升性能
    - 尽量避免使用 for-in 循环，因为它会枚举原型对象，耗时大于普通循环
- **条件流程性能**：Map / Object > switch > if-else
- **模块化**：尝试使用 `import()`

## DOM 优化

- 减少 DOM 的层级，可以减少渲染引擎工作过程中的计算量
- 减少访问 DOM 的次数，如需多次，将 DOM 缓存于变量中
- 使用事件委托，避免大量的事件绑定
- 使用 `requestAnimationFrame` 来实现视觉变化：一般来说我们会使用 `setTimeout` 或 `setInterval` 来执行动画之类的视觉变化，但这种做法的问题是，回调将在帧中的某个时点运行，可能刚好在末尾，而这可能经常会使我们丢失帧，导致卡顿

## CSS 优化

- **层级扁平**，避免过于多层级的选择器嵌套
- **特定的选择器**：好过一层一层查找：`.xxx-child-text{}` 优于 `.xxx .child .text{}`
- **减少使用通配符与属性选择器**
  - 选择器越复杂，匹配用的时间越多
- **减少不必要的多余属性**
- 使用 **动画属性** 实现动画，动画时脱离文档流，开启硬件加速，优先使用 CSS 动画
- 使用 `<link>` 替代原生 @import
- 避免使用表达式，例如 `font-color: expression((new Date()).getHours()%3?"#FFF":"#AAA")` 这个表达式会持续地在页面上计算样式，影响页面性能

## HTML 优化

- 写对文档类型声明 `<!DOCTYPE html>` 这能确保浏览器按照最佳的相关规范进行渲染
- **减少 DOM 数量**，避免不必要的节点或嵌套；
- 避免空的 `src` 和 `href`：当 `src` 和 `href` 为空时，浏览器会默认填充链接，并将页面的内容加载进来作为它们的值，具体规则如下：
  - IE 向**页面所在的目录**发送请求
  - Safari、Chrome、Firefox 向页面本身 URL 发送请求
  - Opera 不执行任何操作
- 图片提前 **指定宽高** 或者 **脱离文档流**，能有效减少因图片加载导致的页面回流
- **语义化标签** 有利于 SEO 与浏览器的解析时间
- 减少使用 table 进行布局，避免使用 `<br/>` 与 `<hr/>`

# 参考资料

**性能优化方案清单**

- 🧾 [2018 前端性能优化清单](https://juejin.im/post/5a966bd16fb9a0635172a50a)
- 🧾 [嗨，送你一张 Web 性能优化地图](https://github.com/berwin/Blog/issues/23)
- 🧾 [Web 性能优化总结](https://segmentfault.com/a/1190000018263418?utm_medium=hao.caibaojian.com&utm_source=hao.caibaojian.com&share_user=1030000000178452)
- 🧾 [大前端性能总结](https://juejin.im/post/5b025d856fb9a07aa0484e54)
- 🧾 [CSS 性能优化的 8 个技巧](https://juejin.im/post/5b6133a351882519d346853f)
- 🧾 [精读 《高效 JavaScript》](https://juejin.im/post/5b7e1f81f265da436a075db4)
- 🧾 [Web 性能优化清单](https://juejin.im/post/5c011e0c5188252ea66afdfa)
- 🗃 [性能相关基础知识点研究](https://github.com/barretlee/performance-column/milestone/1)
- 🗃 [前端性能优化资源列表](https://github.com/liangsenzhi/awesome-wpo-chinese)
- 🗃 [awesome-wpo](https://github.com/davidsonfellipe/awesome-wpo)
- 🗃 [A Frontend Checklist for Websites](https://github.com/drublic/checklist)

**优化方向**

- 🎡 [浏览器的工作原理：新式网络浏览器幕后揭秘](https://www.html5rocks.com/zh/tutorials/internals/howbrowserswork/)
- 🎡 [16 毫秒的优化](http://velocity.oreilly.com.cn/2013/ppts/16_ms_optimization--web_front-end_performance_optimization.pdf)
- 🎡 [Optimize JavaScript Execution 优化 JavaScript 执行](https://developers.google.com/web/fundamentals/performance/rendering/optimize-javascript-execution)
