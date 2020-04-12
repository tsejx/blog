---
title: Vue 响应式系统实现探究
date: '2019-07-04'
description: 从双向绑定到依赖追踪，剖析 Vue 框架响应式系统的实现原理
---

对 Vue 的响应式原理的实现分析似乎已经是前端界烂大街的话题，尽管如此，在对 Vue 源码研究了一周之后还是想尝试用自己的语言把整个实现原理记录下来。

这份研究**不会对源码作逐行解读**，只会对响应式系统的流程中 Vue 对不同情况的处理方式以及数据的流向叙述清楚。

开局借用 [ustbhuangyi](https://github.com/ustbhuangyi) 的一张图，对整个响应式系统有个宏观的概念。

Vue 的响应式原理的核心就是观察这些数据，包括 data、props、computed 和 watch 的变化，当这些数据发生变化以后，能通知到对应的观察者（Watcher）以实现相关的逻辑，从而驱动视图的更新。整个响应式原理最核心的实现就是 Dep 类（语义为依赖 Dependency），这个类实际上是连接**数据对象**与**观察者**的桥梁。

![Vue Reactive](http://img.mrsingsing.com/vue-reactive-workflow.png)

## 双向绑定

在 Vue 初始化阶段，会对传入构造函数的配置对象根据不同的选项作相关的处理。

对于 data 和 props 而言，Vue 会通过 observe 和 defineReactive 等一系列的操作把 data 和 props 的每个属性变成响应式属性。

在初始化 data 过程中，data 数据对象经由 observe 以参数形式传入 Observer 类的构造函数。在实例化过程中，Observer 会根据 data 的数据类型执行相关的操作。

- 若 data 为**数组类型**，Observer 会改写该数组原型中的变异方法（Mutation Method），包括 push、pop、shift、unshift、splice、sort 和 revers 共七个方法，这么做的目的是解决使用这些方法的原生实现会无法监测数据的变化的问题。随后，会遍历数组成员并逐个执行 observe 函数，这样就实现了通过递归的方式监测多维数组中的每个成员的数据变化。
- 若 data 或递归数组成员为**对象类型**，则会遍历并调用 defineReactive 函数。

而在初始化 props 时，经过 vm 实例键名的重名校验后，同样也是遍历调用 [defineReactive](https://github.com/vuejs/vue/blob/3b8925bc7973bb71b33374281db10a945ca9854e/src/core/observer/index.js#L132-L194) 函数。

defineReactive 函数是对数据进行双向绑定（或称为响应式化）的核心。

defineReactive 函数内部先实例化一个 [Dep](https://github.com/vuejs/vue/blob/3b8925bc79/src/core/observer/dep.js#L9-L50) 类，该类的建立是搭建起数据与 Watcher 的桥梁，同时也作为收集和存储 Watcher 的容器。随后，通过 Object.defineProperty 方法改写监测的数据字段的 get 函数和 set 函数。当我们访问监测的数据字段的时候，会触发 get 函数，get 函数内部和 set 函数内部都引用了在上层作用域中对 Dep 类实例化的常量 dep 实例对象。这里巧妙地运用了闭包的原理，以确保每个数据字段在访问和修改时都引用着属于自己的 dep 常量。get 函数会执行 dep 的 depend 方法用于<span style="color:red;font-weight:bold">收集依赖</span>，这些依赖是当前正在计算的 Watcher，并最终经由 watcher 的 addDep 和 dep 的 addSub 添加到 dep 实例中的 subs 数组中（subs 意为 Subscriber 订阅者，该数组可以理解为依赖收集的存储容器）。而当修改数据（执行 set 函数）的时候，会触发 dep 的 notify 方法遍历 subs 数组中的依赖（也就是 watcher 实例）并调用它们原型上的 update 方法和 run 方法，最终通知这些订阅者执行<span style="color:red;font-weight:bold">派发更新</span>的逻辑。这两个函数背后的执行路径在 dep 实例和 watcher 实例之间穿梭，这样实现的目的从源码分析来看，是为了区分不同的 Watcher（有 renderWatcher、computedWatcher 和 userWatcher，后面会提及）以及作相应的性能优化（譬如避免重复收集依赖或基于组件层级作缓存处理等）。

总结 get 函数和 set 函数的触发时机，以及其职能功用：

- get 函数在**访问**数据字段时触发，其主要职能是**获取监测数据字段的值**并触发 Watcher 的**依赖收集**。
- set 函数在对数据字段**修改**时触发，主要职责是**对新的赋值进行响应式化**以及向 Watcher **派发更新**，从而触发视图的重渲染。

谈到这里肯定会有个疑问， get 函数所收集的依赖具体是什么？依赖是如何被收集的？set 函数是如何通知所有的 Watcher 更新的？派发更新的过程究竟做了什么？这些疑问都在下节揭晓。

## 渲染函数

在谈及依赖的追踪和触发前，我们有必要先了解 **「依赖」** 这个那么虚的名词用 JavaScript 语言怎么描述。

谈及双向数据绑定，这里所指的双向指的就是 Data 到 View 以及 View 到 Data 的结合。体现在我们的代码中，就是 Vue 的配置选项即为 Data 的储存容器，而 template 即为概念上的 View。我们知道浏览器在读取 JavaScript 脚本文件后必然经历 DOM 操作方可将相关数据渲染到 DOM 树中，比如使用字符串模版 innerHTML 或通过 appendChild、insertBefore 等 DOM 节点操作插入。

在 Vue 中，模版 template 会经由 Compiler 被编译成渲染函数（Render Function），以下以直观的感受体验模版和渲染函数的表现形式。

```html
<div id="foo">
  <p>{{name}}</p>
</div>
```

```js
// 编译生成的渲染函数是一个匿名函数
function anonymous() {
  with(this) {
    return _c('div',
      { attrs: {"id": "foo" }},
      { _v("\n      "+s_(name)+"\n    ")}
    )
  }
}
```

经编译生成后的渲染函数会被挂载至对应 vm 组件实例的 `$options.render` 属性下。

这里也解开了绑定的数据字段是如何和在哪里触发 getter 和 setter 的了。

下面我们谈谈渲染函数与依赖追踪关系。

## 追踪依赖及响应变化

在 Vue 创建过程中，渲染视图的入口为 `_init` 函数中执行 vm 实例对象的 `$mount` 函数。对于每个组件而言，它都会执行组件的 `$mount` 方法，而不同编译版本的 `$mount` 执行的落脚点都是 mountComponent 函数。

mountComponent 函数内部定义了一个 [updateComponent](https://github.com/vuejs/vue/blob/d9b27a92bd5277ee23a4e68a8bd31ecc72f4c99b/src/core/instance/lifecycle.js#L169-L192) 函数，而 updateComponent 函数的内部以 `vm._render()` 函数的返回值作为第一个参数调用 `vm._update()` 函数。此处我们只需简单地认为：

- `vm._render` 函数的作用就是根据渲染函数（`vm.$options.render`）返回生成的虚拟节点
- `vm._update` 函数的作用就是把 `vm._render` 函数生成的虚拟节点渲染成真正的 DOM 节点

因此，对于 updateComponent 而言，我们可以把它理解为把虚拟 DOM 转化为真实 DOM 的过程。

在 [mountComponet](https://github.com/vuejs/vue/blob/d9b27a92bd5277ee23a4e68a8bd31ecc72f4c99b/src/core/instance/lifecycle.js#L141-L213) 函数内部除了定义从虚拟 DOM 到真实 DOM 的执行函数外，还把 updateComponent 作为第一参数传入实例化的 Watcher 中。

此时的 [Watcher 实例对象](https://github.com/vuejs/vue/blob/d9b27a92bd5277ee23a4e68a8bd31ecc72f4c99b/src/core/instance/lifecycle.js#L197-L203)被称为 render watcher（亦即<span style="color:red;font-weight:bold">渲染函数的观察者</span>）。而实例化过程中 Watcher 会对 updateComponent 函数求值，而 updateComponent 函数的执行会间接触发渲染函数（`vm.$options.render`）的执行，而渲染函数的执行则会触发数据字段（包括 data、props 或 computed 等配置选项对象的子孙属性）的 get 拦截器函数，进而将该 render watcher 收集到依赖容器内，也就 dep 实例对象中的 subs 数组中，从而实现**依赖收集**。这个 dep 实例对象属于数据字段自身所持有，这样当我们尝试修改相应数据字段的值的时候，程序会触发数据字段的 set 拦截器函数里的 dep.notify，从而触发 render watcher 的 update，然后执行其 run 方法，执行过程最终会调用 updateComponent 方法，该方法会重新进行视图渲染。这样触发 set 拦截函数并通过一系列操作后更新视图的过程称为**派发更新**。

追踪依赖示意流程图：

由于 mountComponent 作为数据更新视图的函数，那么肯定是频繁调用的，换言之函数内部会不断重复实例化 Watcher，但实际上对于数据表达式的依赖追踪不必重复执行该流程。在 Watcher 实例内部通过唯一标识区分 watcher 实例，并以标识集合作为区分依据，避免了**一次求值过程中收集重复依赖**以及**多次求值收集重复依赖**两类问题。

## 计算属性

计算属性 computed 在 [initComputed](https://github.com/vuejs/vue/blob/dev/src/core/instance/state.js#L169-L208) 函数中构建。

对于 computed 计算属性而言，实际上会在内部创建一个 computed watcher，每个 computed watcher 会持有一个 Dep 实例，当我们访问 computed 属性的时候，会调用 computed watcher 的 [evaluate](https://github.com/vuejs/vue/blob/dev/src/core/observer/watcher.js#L210-L213) 方法，这时候会触发其持有的 depend 方法用于收集依赖，同时也会收集到正在计算的 watcher，然后把它计算的 watcher 作为 Dep 的 Subscriber 订阅者收集起来，收集起来的作用就是当计算属性所依赖的值发生变化以后，会触发 computed watcher 重新计算，如果重新计算过程中计算结果变了也会调用 dep 的 notify 方法，然后通知订阅 computed 的订阅者触发相关的更新。这类 watcher 有个特点：当计算属性依赖于其他数据时，属性并不会立即重新计算，只有之后其他地方需要读取属性的时候，它才会真正计算，即具备 lazy（懒计算）特性，这类 watcher 的 expression 是计算属性的中的属性名。

## 侦听属性

侦听属性 watch 在 [Vue.prototype.\$watch](https://github.com/vuejs/vue/blob/dev/src/core/instance/state.js#L303-L317) 函数中构建。

对于配置的 watch 数据对象而言，会实现基于 Watcher 的封装并创建 user watcher，可以理解为用户的 watcher，也就是由开发者自定义的回调函数，它可以观察 data 的变化，也可以观察 computed 的变化。当这些数据发生变化以后，会通知这个该 watch 数据对象的 Dep 实例然后调用这个 Dep 实例去遍历所有 user watchers，然后调用它们的 update 方法，然后求值发生新旧值变化就会触发 run 执行用户定义的回调函数（user callback）。

## 收获

- 对 Vue 处理配置选项的数据字段与视图数据绑定的工作流程以及响应式系统的工作流程有完整的认识，加深了解相关配置或 API 的 What 和 Why，定位框架相关问题的时候更快速
- 学会了很多编码层面的优化方式，根据流程避开非最佳的写法，让框架以最短路径完成双向绑定的工作，尽管以现时 JavaScript 引擎的性能而言，这些优化显得微不足道，但追求极致的代码书写应该是每个工程师应该具备的素养
- 在了解甚至读懂源码实现原理的前提下，若遇到技术选型或缺陷治理等情况，与他人协商的沟通成本能大幅下降，最重要的是暗中观察业界大佬在讨论问题时起码不会再一脸懵逼。

## Todo

- Vue 初始化流程：Vue API 挂载流程以及实现原理，读懂这部分源码应该对业务实践帮助很大
- 模版编译，结合编译相关 Babel 以及 JSX 编译实现，探索前端编译实现方式
- 研究 Virtual DOM 的算法与实现，并与 React 实现的 Virtual DOM 作比较

## 参考资料

- [Vue 官方中文网](https://cn.vuejs.org/)
  - [深入响应式原理](https://cn.vuejs.org/v2/guide/reactivity.html)
  - [渲染函数](https://cn.vuejs.org/v2/guide/render-function.html)
- [Vue 技术内幕](http://hcysun.me/vue-design/)
  - [揭开数据响应系统的面纱](http://hcysun.me/vue-design/art/7vue-reactive.html)
  - [渲染函数的观察者与进阶的数据响应系统](http://hcysun.me/vue-design/art/8vue-reactive-dep-watch.html)
- [Vue 技术揭秘 - 深入响应式原理](https://ustbhuangyi.github.io/vue-analysis/reactive/)
- [Vue 双向数据绑定原理分析](https://zhuanlan.zhihu.com/p/21706165?utm_source=wechat_session&utm_medium=social&utm_oi=58000878338048)
