---
title: 前端深耕落地页业务心得总结
date: '2020-06-07'
---

在科技繁荣的今天，计算机给现代社会带来的是信息化的变革，本质上打破的是原有社会人们地理、语言、人种等各维度上的差异，通过互联网人们能通过便捷的方式足不出户口，就可以购买到全国乃至全球的商品货物、享受到各式各样的差异化服务。因此，对于一家互联网企业来说，用户无疑是最重要的资产，让更多的用户知道、了解甚至享受企业的产品，是企业立足的前提条件，毕竟有了用户方有盈利的可能性，企业才能可持续发展。

对于国内很多大厂的来说，某种程度上在用户这个维度上会投入大量资源，诸如设立专门负责用户增长的组织单位。他们关注用户在产品终端的体验，相关从业人员需要懂得抓住用户心里，结合各种业务场景制定对应的营销策略，最终目的就是留住用户，让用户心甘情愿地消费。

笔者就职于与某互联网金融企业，由于最近经常需要和产品、推广、运营打交道，多多少少会接触到很多庞杂的知识边界外的领域，所以打算系统整理这段时间来的业务分析方法论和实践心得。

<!-- more -->

## 落地页

所谓的落地页（Landing Page）就是用于承接用户通过付费搜索渠道进入的推广页面。

在如今广告横霸天下的互联网社会，我们用百度搜索结果出来后插在开头的结果，在腾讯视频看剧时突然蹦出来的小广告，刷知乎或者微信朋友圈穿插在信息流当中的「伪」信息，抑或是淘宝店家、保险公司、移动联通电信等隔三差五给你发的短信里的短链接，基本都可以归类为落地页的入口。通常由知名度不足的广告商付费购买推广位，利用知名度较高的渠道建立用户与自家产品的认知关系，而落地页就是关键的载体。

其实落地页的类型能细分出很多种，主要分为营销活动页、信息收集页、应用推广页、唤醒找回页等，各有各的职责。

### 营销活动页

营销活动页的目的是为了让你的用户知道你的产品是什么、能提供什么服务、能解决用户什么需求。通过落地页能直接展示或跳转至 APP 内的核心业务，起到承接流量的作用。页面的内容通常比较简洁，会用到大量设计感高的图片和醒目的文案，为用户展示自己的活动和商品，通过类似优惠价格和赠品等手段引导用户点击，获取到用户信息后，后续再与客户联系，最终将这些潜在的用户转化为真正的用户。

![营销活动页](https://img.mrsingsing.com/landing-page-marketing.jpg)

### 信息搜集页

信息搜集页适用于业务复杂或低频类的产品，当产品核心业务设计到大额交易、定制服务、响应周期长等特征的时候，落地页的任务更像是给用户一个承诺，许诺会有大量优惠的福利，留下个人信息以便平台后续专员的电访。回想起很多诸如职业培训的公司，是不是网页加载后都会弹窗让你填写个人信息，然后几天内就会接到他们电话向你推销课程。

![信息搜集页](https://img.mrsingsing.com/landing-page-information.jpg)

### 应用推广页

应用推广页的目的很明确，就是引导用户下载应用、注册、登录等。

![应用推广页](https://img.mrsingsing.com/landing-page-application-promotion.jpg)

### 唤醒找回页

日活月活是互联网应用很重要的活性指标，唤醒找回页的使命就是激活那些流失掉的用户，通过短信、邮件、消息通知等主动反馈的形式吸引老用户回归应用。

![唤醒找回页](https://img.mrsingsing.com/landing-page-awaken.jpg)

## 数据指标与转化率分析

### 数据指标

落地页的实际效果需要量化指标来衡量，下面从运营角度列出了一些落地页建设需要关注的指标。

![落地页指标](https://img.mrsingsing.com/landing-page-pointer.jpg)

- **页面浏览量**：指页面被用户浏览的次数，严格意义上指用户向网站发出并完成下载页面的请求
- **点击率**：网页内某内容被点击次数与显示次数之比
- **跳出率**：衡量落地页质量好坏的重要指标。页面跳出率的计算为该页面作为落地页跳出的访问次数占该页面作为落地页访问次数的百分比，全站跳出率则为跳出的访问次数除以总的访问次数。
- **停留时长**：用于衡量用户与网站/APP 交互深度，一般有页面停留时长，会话时长以及平均停留时长等概念，其计算的核心原理在于记录下用户行为发生时的时间戳，后期再应用相应公式来计算
- **交互深度**：指用户在一次浏览网页或 APP 过程中，访问了多少页面。用户在一次浏览中访问的页面越多，交互深度就越深。交互深度能够侧面反映网站或 APP 对于用户的吸引力。
  可以通过 Session 来计算用户的平均交互深度。

除此之外还有一些我们会经常听到的一些核心指标：

- **DAU（Daily Activited Users）**：日活跃用户数量，统计单日内，登录或使用某个产品的用户数（去除重复登录的用户）
- **MAU（Monthly Activited Users**）：月活跃用户数量，统计单月内，登录或使用某个产品的用户数（去除重复登录的用户）
- **PV（Page View）**：页面浏览量和点击量，用户每次对网页进行访问被记录为一次
- **UV（Unique View）**：独立访客，访问网站的一个终端为一个访客
- **转化率**：一个统计周期内，完成转化行为的次数占推广信息总点击次数的比率。
- **留存率**：某一统计时段内的新增用户数中经过一段时间后仍启动该应用的用户比例。

### 漏斗模型

衡量指标需要落实到具体的分析模型，而漏斗模型则是最常用的评判落地页转化效果的工具。漏斗模型的实现原理是在潜在用户从访问页面到最终转换成真正用户这个行为路径上的关键节点进行埋点收集行为数据，并根据不同关键节点的特性设定不同目标，最后通过各阶段的转化情况改善关键节点转化的流程设计，从而提升用户体验。

以我最熟悉的引导流量的注册落地页为例，页面呈现仅有手机号输入框、短信验证码输入框、密码输入框和注册按钮等四个主要的可交互元素，理想的新用户注册流程大概是这样的：

```
访问页面 -> 输入手机号 -> 下发短信验证码 -> 输入验证码 -> 输入账号密码 -> 点击注册按钮 -> 服务端进行注册处理 -> 注册成功
```

转化漏斗可以添加多个交互步骤，比如当用户输入手机号后，前端自动检测输入值由正则校验有效后，则上报标记为 `输入手机号` 的埋点，在用户获取到短信验证码，同样地输入短信验证码并校验有效后，即上报 `输入验证码` 的埋点。通过添加两个关键节点的埋点，使用转化漏斗配合可视化视图，我们就能清晰地知道有多少用户完成了 `输入手机号` 到 `输入验证码` 这个步骤，而通过 `输入手机号` 的人数减去 `输入验证码` 的人数，我们就能获知该阶段流失的用户数。

转化率需要 **对比**，不能在分析的时候发现某个环节的转化率太低，就认为一定是这个环节出现了问题。比如从 `输入手机号` 到 `注册成功` 这个环节转化率只有 40%（虚构数据），是所有环节中最低的，但我们可以用历史数据进行比较，从**趋势**的变化分析转化效果，上个月同期该环节的转化率页是 38%，行业同类产品均值是 36%，那么其实该环节做得还是不错的。我们看后面的环节，从 `注册成功` 到 `进入 APP 应用` 的环节的转化率是 62%（虚构数据），跟其他环节相比较起来，这个转化率是最高的，但是我们对比行业同类型产品会发现均值是 90%（虚构数据），对比上个月同期这个比率是 91%（虚构数据），那么我们可以发现当前这个月，落地页从注册成功到登录 APP 应用的转化率是做得非常不好的，其实这个就回到我们数据分析中的对比分析了，我们需要与自己的历史数据做对比，才能得出完整的结论，当然另外一点是不同的用户，对比在交互流程中的转化率是可以有很大的差异的，像客户来自不同的渠道、不同的区域、不同的生命周期、不同性别、不同年龄，他们在漏斗中的表现都是不一样的，所以我们在进行漏斗分析的时候，往往还需要进行细分的漏斗模型分析，

如果转化率并不理想，我们可以通过 **细分维度** 对转化率进行拆解，比如我们可以通过操作系统维度（例如分为 Android 和 iOS）看到不同操作系统的阶段转化情况，也可以选择浏览器（Chrome、Safari、Firefox 和 微信内置浏览器等）看到不同浏览器的阶段转化情况，甚至可以选择设备的品牌来看到对应的阶段转化情况。如果某个转化率明显低于正常的转化率情况，那么我们可以合理怀疑页面这个操作系统、品牌或浏览器上，兼容性做得不够。

综合以上，可以得出基于漏斗模型的分析方法有以下几种：

- **趋势（Trend）**：从 `时间轴` 的变化情况进行分析，适用于对某一流程或其中某个步骤进行改进或优化的效果监控。
- **比较（Compare）**：通过比较 `类似产品或服务间` 购买或使用流程的转化率，发现某些产品或应用中存在的问题。
- **细分（Segment）**：细分来源或 `不同的客户类型` 在转化率上的表现，发现一些高质量的来源或客户，通常用于分析网站的广告或推广的效果及 ROI。

### A/B 测试

A/B 测试是为了 Web 或 App 界面或流程制作两个或多个版本，在相同时间维度，分别让组成成分相同（相似）的访客群组（目标人群）随机的访问这些版本，收集各群组的用户体验数据和业务数据，最后分析、评估初最好版本，正式采用。

通过 A/B 测试可以有效减少基于假设前提的各种无谓争论。通过 A/B 测试可以看到用户面对不同落地页元素的真实反应、用户更容易点击落地页的哪些位置，从而得出修改页面元素的有力证据。

因为经常需要在流量分配时有所权衡，一般有以下几个情况：

- 不影响用户体验：如 UI 实验、文案类实验等，一般可以均匀分配流量实验，可以快速得到实验结论
- 不确定性较强的实验：如产品新功能上线，一般需小流量实验，尽量减少用户体验影响，在允许的时间内得到结论
- 希望收益最大化的实验：如运营活动等，尽可能将效果最大化，一般需要大流量实验，留出小部分对照组用于评估 ROI

因为通常单个链接的落地页不具备 A/B test 的功能，需要配合专门用于 A/B test 页面分发的系统进行流量分配，实际上通过类似反向代理的原理，根据分配到不同的页面的比例将标识 A/B 不同页面返回给用户展示。

由于我们的注册落地页是使用可视化页面搭建系统配置的，并不支持 A/B 测试，所以搭配另一套前端的集成系统和客户端的 CMS 系统，能够实现对页面的 A/B 测试。而在页面的埋点统计中，需要上报 A/B 的标识，以便后续业务数据的追踪和评估结果，进而得出测试结论并指导落地页改进。

### 数据校验流程

对于分析师来说，数据分析的结论正确的前提是数据来源的正确性，也就是技术人员需要确保数据采集的准确性。

数据采集的正确性校验：

1. 事件是否上报
2. 事件属性是否上报，上报的属性值是否正确
3. 公共属性是否上报，上报的公共属性值是否过正确
4. 如果上传了用户属性，用户属性是否上报正确
5. 事件属性和用户属性的属性值类型是否正确

用户关联的正确性校验：

1. 是否做了用户关联
2. 登录 ID 是否上传正确
3. 是否正确调用用户关联的接口

如果使用漏斗模型进行分析时，上报埋点的时机要确保符合顺序，在用户端上报时间与统计平台的埋点入库时间也是需要注意的点。

`埋点管理` -> `实时导入数据查询` -> `用户 ID` 查询用户关联的准确性

---

**参考资料：**

- 产品设计
  - [高转化率的 APP 推广落地页是怎样炼成的](http://www.woshipm.com/pd/3079851.html)
  - [那些制作落地页的套路](https://www.jianshu.com/p/21db3a53b9e7)
  - [如何提升落地页转化率](https://www.shujike.com/blog/77744)
  - [什么是落地页](https://zhuanlan.zhihu.com/p/33882407)
  - [你问我答 12 个流量和转化相关的实战问题解答](https://www.27sem.com/article/3634.html)
  - [高转化的落地页长啥样](https://zhuanlan.zhihu.com/p/36165204)
- 数据分析
  - [产品运营的基本功 漏斗模型](https://www.yunyingpai.com/user/199.html)
  - [案例分享 渠道落地页数据分析](https://www.sohu.com/a/345808493_165070)
  - [网页转化率与漏斗模型](http://menvscode.com/detail/5bfc20d030be6232a69c5d94)
  - [优秀产品人必懂的数据驱动增长模型](https://www.niaogebiji.com/article-26780-1.html)
  - [使用 Sensors Analytics 进行 A/B Test](https://www.sensorsdata.cn/blog/shi-yong-sensors-analytics-jin-xing-a-b-test/)
  - [深度 A/B 测试中的因果推断——潜在结果模型](https://juejin.im/post/585b7fc161ff4b0058032b84)
  - [销售线索居低不上，你唯一要做的是落地页 A/B 测试](https://www.infoq.cn/article/PyOwiqA1zmuIcXqySb7V)
- 扩展阅读
  - [淘宝用户行为数据分析详解](https://www.jianshu.com/p/4f64d739fba2)
  - [美团 DSP 广告策略实践](https://tech.meituan.com/2017/05/05/mt-dsp.html)
  - [日志采集与用户行为链路分析](https://www.jianshu.com/p/ab04b1e3a512)
