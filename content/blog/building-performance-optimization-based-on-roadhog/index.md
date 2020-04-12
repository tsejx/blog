---
title: 基于 roadhog^2.x 的后台项目构建性能优化
date: '2019-01-20'
description: 结合构建工具的极致化运用和构建产物的研究分析对 roadhog 的项目进行构建优化
---

## 技术选型

目前我司后台系统采用基于 [Webpack](https://github.com/webpack/webpack) 为底层封装的打包工具 [roadhog](https://github.com/sorrycc/roadhog)。开发者通过工具暴露的有限的可配置参数，可以简单明了地针对项目需要进行自定义配置。该款工具的目的很明确，就是为了简化 webpack 的配置。这对于入门级别的工程师是非常友好的，因为降低了学习 webpack 的成本，免去捣鼓 webpack 复杂的配置，方便开发者快速进入开发流程。

从目前项目版本的 `package.json` 向上层依赖溯源可以得出这样的依赖关系：

> roadhog^2.4.2 => af-webpack^0.23.0-beta.1 => webpack^3.56

roadhog 基于 [`umi/af-webpack`](https://github.com/umijs/umi/tree/master/packages/af-webpack) 作为底层。从社区反馈的信息得知，现时（2019.1）作者的工作重点都在 [umi](https://github.com/umijs/umi)，而 roadhog 无打算迭代升级的打算。即便将 roadhog 升级至最新版本，所依赖的底层 webpack 的版本也只是 3.5.6，webpack4+ 的优化配置均无法使用。由于工具文档提供信息有限，因此要将优化进行到极致从源码依赖着手推动项目构建优化是免不了的工作。

## 构建现况分析

> 版本 release/2.29.0

**分析材料**

- 通过 [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) 对打包模块进行可视化分析
- 对打包出来后的资源文件进行分析
- 项目组织结构分析

**构建情况分析**

- 构建内存占用过高：130% 需要给 node 配置更多内存防止内存溢出导致失败
- 构建进度观察：卡在 10%、86%、**91%**
- 构建使用时间：407s 366s 386s 380s 372s => 平均 382s
- 静态资源数量：分割成共 92 个资源文件（包括入口文件，但除去默认拷贝输出的文件）
- 静态资源大小
  - Start：总 150MB，平均，最大 5.05MB
  - Parsed：总 88MB，平均，最大 2.48MB
  - Gzipped：总 25MB，平均，最大 686.48KB

| 静态资源大小 | 数量 |
| ------------ | ---- |
| >2MB         | 5    |
| >1MB         | 24   |
| >500KB       | 60   |

## 项目构建优化方案

按照 [Webpack 构建性能优化探索](https://github.com/pigcan/blog/issues/1) 提供的思路，可以从四个维度着手项目构建的优化：

- 从环境着手，提升下载依赖速度
- 从项目自身着手，代码组织是否合理，依赖使用是否合理，反面提升效率
- 从 Webpack 自身优化手段着手，优化配置，提升 Webpack 效率
- 从 Webpack 可能存在的不足着手，优化不足，进一步提升效率

### 去除废弃依赖

观察 `package.json`，发现一些项目中废弃的依赖并没有及时处理，因此把无用的和重复安装的依赖去除。

### 提取第三方公共模块

此前项目中页面代码根据路由按需加载，每个页面 route 和 model 引用的第三方模块，例如 `react`、`dva`、`query-string`、`antd`、`moment` 等，都会在各自的页面中重复打包一份，这就导致根据页面分割的资源文件尺寸较大，冗余代码较多。

除此之外，值得注意的是，项目中使用的 [AntDesign](https://github.com/ant-design/ant-design) 组件，尽管通过 [babel-plugin-import](https://github.com/ant-design/babel-plugin-import) 实现了组件模块的按需加载，页面引用并不会将完整的 AntDesign 引入。但是由于开始时候大部分页面都不会从零开始写，而是会选择移植相似页面的逻辑再加以修改，因此会导致相当一部分页面会将没有使用到的组件进行打包，同样会造成冗余。

因此，整个项目的性能优化必然从资源依赖的第三方库着手，提前编译提取。

分析 `package.json` 可以得知整个项目依赖主要有几个部分：

- [antd](https://github.com/ant-design/ant-design) 基础 UI 组件库 📌
- [dva](https://github.com/dvajs/dva) 数据管理框架
- [moment](https://github.com/moment/moment) 时间操作工具库 📌
- [ali-oss](https://github.com/ali-sdk/ali-oss) 阿里云 OSS 插件
- [react](https://github.com/facebook/react) 界面框架
- react-dom
- react-router-dom
- universal-cookie
- ...等等

roadhog 暴露了 commons 参数对应 Webpack 中 plugins 的多个 `webpack.CommonsChunkPlugin` 实例。下面有两种可选择的方案供实现：

- 被至少固定个数（默认两个） entry/page 依赖即提取公共，这样 common 公共模块会比较大，项目整体尺寸最小，但页面首屏渲染需要加载的资源尺寸会比较大
- 被所有 entry/page 依赖才提取为公共，这样 common 公共模块比较小，项目整体尺寸较大

最终决定将所有依赖的第三方模块提前打包，在用户访问页面时需要将基础工具和基础组件的打包文件先加载，后续用户界面资源文件加载就会相对另一种方案会更加快速。

相关扩展：

- [详解 CommonsChunkPlugin 的配置和用法](https://segmentfault.com/a/1190000012828879)

- [webpack.optimize.CommonsChunkPlugin 详解](https://juejin.im/post/5c2205e15188257507558c5a)

- [webpack、manifest、runtime、缓存与 CommonsChunkPlugin](https://www.jianshu.com/p/95752b101582)

### 第三方模块不同兼容库重复打包

![优化前打包结果](http://img.mrsingsing.com/roadhog-performance-build-analyze.jpg)

vendor 提取第三方模块后，发现几个比较大的页面资源文件里仍然存在 antd.lib 组件库的代码，而且这些 `ant.lib` 都是完整一个模块被打包进了这些页面当中，但其实 AntDesign 已经被我完整单独地打包成另外一个文件了，这个打包的文件是由 `ant.es` 打包出来的。

- antd.es
- antd.lib

通过对打包后的文件以及业务代码的检查，发现是引用 Antd 组件库发生了问题，由于使用了 webpack-plugin-import 插件，将 Antd 中名为 es 的组件库按需加载并通过 babel 转化独立打包成 vendor，因此当使用 `import {message} from "antd/lib/index"` 这种写法的时候，当前页面会将 Antd lib 目录下的组件全部打包，造成页面打包文件臃肿。

书写规范
使用了 extraBabelPlugins 就会按需加载

```js
// wrong
import { message } from 'antd/lib/index';

// good
import { message } from 'antd';
```

### 忽略 moment 语言包的打包

![忽略 moment 语言包](http://img.mrsingsing.com/roadhog-performance-moment-locale.jpg)

打包后 moment 包的体积比较大，其中 locale 语言包部分占据了比较大的体积，由于我们的项目没有国际化需求，因此可以通过配置 roadhog 提供的 `ignoreMomentLocale: true` 减少打包出来的 vendor 尺寸。

但是，如果项目中使用到 AntDesign 组件，并且使用到时间选择组件 `date-picker`（默认是英文文案），那么这里需要做一些处理以使项目中组件能够显示中文。

我是在项目最上层，单独引入 moment 的中文语言包。

```js
import moment from 'moment';
import 'moment/locale/zh-cn';

moment.locale('zh-cn');
```

这样项目中使用到 moment 工具库的 `date-picker` 都会显示中文文案。

### 压缩耗时

项目构建过程会卡在 91%，通过查阅相关资料和了解社区反馈后，明确原因为该阶段 Webpack 正在对代码进行混淆压缩操作，但同时由于 Webpack 的压缩插件 UglifyJS 无法对 ES6+ 的代码进行压缩，需要使用 [babel-minify](https://github.com/babel/minify) 获取更好的 treeshaking 效果（虽然 Webpack4 已经支持 ES6+ 代码压缩，但是目前 Roadhog 采用的是 Webpack3+）。

[构建速度慢的解决方法@sorrycc](https://hackmd.io/YHK_yuRtT0ePPVLY0_kUzw)

体现特征：

- 构建速度慢
- 内存消耗高

解决方法：

- 减少依赖文件
  - 优化 common 提取策略，让整体尺寸尽可能少
  - externals 掉一些大的库，降低整体尺寸
  - 利用 webpack 的 TreeShaking + es module，排除掉一些没有用到的模块
- 减少需要压缩的文件

### 外部扩展

externals 是非常有效的一个方案，可以一下子减少大量需要编译、压缩的模块。将一些不常更新版本比较稳定的模块文件直接注入 HMTL 文件，当读取到该脚本时将自动加载，这不仅能加快构建速度，而且能够利用 CDN 进行资源缓存。

但是会带来的问题是：

- 无法利用 Webpack 的 Tree-Shaking
- 多个库之间如果存在公共模块（比如 lodash），就无法复用

使用 externals 需要在 HTML 里引用额外的 JS 文件，这里也有几个潜在的问题：

- 如果你的 CDN 不支持 Combo，并且不是 http/2，那么速度会很慢
- 你需要手动维护一份 CDN 文件列表，并且跟进他们的更新，也是件麻烦的事情

这里主要将三个尺寸较大且比较少项目页面引用的模块 externals 掉。

```js
externals: {
    'ali-oss': 'window.OSS',
    'react': 'window.react',
    'react-dom': 'window.ReactDOM'
}
```

### 项目样式文件减少

ExtractTextPlugin 提取 CSS (antd + 业务)

能用公共就用公共（因为大部分的页面的样式几乎一样），不然每个页面开一个 less 引用公共，会重复打包，造成冗余。

### Gzip 传输压缩

gzip 需要在服务器配置开启

这里提供一种 Nginx 的配置。[传送门](https://blog.csdn.net/qq_36030288/article/details/54576503)

[前端性能优化：gzip 压缩文件传输数据](https://www.cnblogs.com/zs-note/p/9556390.html)

## 优化效果分析

![优化效果分析](http://img.mrsingsing.com/roadhog-performance-optimizition-result.jpg)

- 开发体验：70s => 20s 启动项目时间提升 71%
- 构建速度：382s => 40s 项目构建速度提升 89%
- 资源文件：88Mb（未开启 Gzip） => 25Mb（开启 Gzip） => 1Mb（优化后开启 Gzip） 资源文件尺寸大幅度降低

## 后续需要解决的问题

### 单独打包的 AntDesign 尺寸过大

- 可视化分析尺寸较大的文件包括 rc-editor-core / draft.js 等
- 通过依赖找到根源是 rc-editor-mention => rc-editor-core => draft-js 来自 Mention 组件，但是项目中并没有使用到
- 得出结果提取打包将整个组件库都打包进来了

社区中有反应希望提取公共模块打包时将其中某些部分忽略不打包，而维护者似乎告知需要使用 `babel-plugin-import` 按需引用，并没提供提取公共模块的解决方案。 [传送门](https://github.com/ant-design/ant-design/issues/10180)

## 参考资料

- [支持 vendor 的配置 Issue #370](https://github.com/sorrycc/roadhog/issues/370)
- [roadhog2 如何成功提取 vendor · Issue #577](https://github.com/sorrycc/roadhog/issues/577)
- [编译很慢 #722](https://github.com/sorrycc/roadhog/issues/722)
- [roadhog 1.3x 打包慢的解决办法](https://github.com/liangxinwei/blog/blob/master/webpack/2.md)
- [Roadhog 构建优化](http://www.mamicode.com/info-detail-2413081.html)
- [JS/CSS 体积减少了 67%，我们是如何做到的？](https://www.itcodemonkey.com/article/12011.html)
- [Webpack 日常使用与优化](https://github.com/creeperyang/blog/issues/37)
