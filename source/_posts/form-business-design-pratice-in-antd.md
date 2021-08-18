---
title: AntDesign 组件化开发探索之表单业务设计实践总结
date: '2019-04-05'
---

## 需求分析

最近接到一块关于促销活动功能的需求，除了常规的数个日志类型和筛选统计类型展示的列表之外，还需要完成关于促销活动的创建与编辑页面的组件化设计。

活动的创建页面与编辑页面是一个分步表单，分别为活动的基本信息、领取条件以及使用条件三个部分。

按照往常的开发习惯，会把这单个页面的分步表单的三个部分都写在一个组件内，但是这样处理明显是不合理的，因为按照这几个部分的表单需求来看，至少也需要上千行的代码实现，无论从代码可读性或者后期维护的便利性来说，都是不可取的。所以如何合理地设计整个表单页对整个功能的实现以及后期需求迭代的便捷性至关重要。

通过细分可能涉及到的逻辑难点做了以下分析：

- 顶层组件主要负责各个步骤表单的渲染分发器，以及整个分步表单提交前相关数据处理，分发器通过设定标识变量控制用户可视部分表单渲染，数据处理则需要根据接口需求的数据结构进行转换
- 可视表单在进入下一个步骤之前需要对当前步骤表单信息进行信息校验
- 根据 antd 表单组件的设计原则封装复合表单项（单选+多选+时间选择输入框）
  - 复合表单组件支持复用，并提供一键自动填充功能
  - 动态增减输入框控件并支持控件间的严格规则校验
- 兼容新建页面和编辑页面，主要区别在于编辑页面需要获取并设置表单默认值

<!-- more -->

## 分步表单实践分析

### 分步表单组织结构

整个分步表单页面从 UI 上划分大体上分为三个部分：步骤进度条、对应的表单项以及切换页面的按钮组。

根据 `antd` 组件库的表单设计原则，如果需要 Form 组件自带的收集校验功能，需要使用 `Form.create()` 对自定义的组件进行包装，而且每个需要收集的值还需要 `getFieldDecorator` 进行注册。

`Form.create()` 用于创建一个具有注册、收集、校验功能的实例。

```jsx
class Basic extends React.Component {
  render(){
    <Form>
      <Form.Item>
        {
          getFieldDecorator('expiration', {
            initialValue: fields.expiration ? fields.expiration : undefined,
            validateFirst: true,
            rules: [
              { required: true, message: '必填' }
            ]
          })(<SuffixInput unit="天" placeholder="请输入整数" />)
        }
      </Form.Item>
    <Form>
  }
}

Form.create()(Basic)
```

整个页面的数据储存方式决定了整个分步表单的组织结构，也决定了编写业务逻辑时对数据流的处理方法。因此我对两种功能方案进行了对比。

### 数据存储方案

**顶层组件**

**隔层传送：** 如果在顶层组件包装，那么就需要把 Form 内部创建的实例以及一些修饰器 `getFieldDecorator`、校验表单值 `validateFields` 等方法通过 Props 再传递给各个步骤组件。

**同步卸载：** 在对当前步骤表单填充完成并切换步骤后后，上个步骤的组件会从页面卸载，最终表单提交时候会无法获取之前已经填充的表单的值。因为这些步骤的组件卸载后存储表单值的实例也会同时卸载。

**各个步骤组件**

**需同步数据：** 如果在顶层组件下的各个步骤组件进行包装，那么就需要在切换下个步骤前对表单值进行验证，验证失败会进行拦截，而验证成功则会将数据映射到顶层组件的 State 中，该分步骤组件以及 Form 创建的表单数据存储实例均会一并卸载。若页面再切换到其他步骤的页面时，需要从 Props 获取该步骤页面的表单值，再通过 `initialValue` 映射到 Form 组件内部生成的实例中。

**功能明确：** 这样设计的好处是将各个分步的表单分为单独的表单看待，功能分工更加明确，无论从功能实现还是后期维护上只需要对该组件内的业务逻辑进行修改即可，不用兼容顶层组件的逻辑。

**兼容页面：** 更重要的是，顶层组件对各个步骤的表单域值进行分发，再通过 `initialValue` 设置表单默认值的方式在编辑页面的应用上会更加合理。因此最终采用对各个步骤组件进行封装的方法。

### 同步数据的时机

尽管已经决定在各个步骤组件中进行 Form 组件包装，但是另一方面需要考虑当用户填充功能表单时数据是在切换页面时统一校验再存储在上级组件，还是实时存储呢。

如果是采用实时存储的方案的话，可以使用 AntDesign 提供的官方案例 [表单数据存储于上层组件](https://ant.design/components/form-cn/#components-form-demo-global-state) ，但是这时候会面临一个问题是，每次变更输入框内的值时都会触发上层组件的 Re-Render ，当分步组件中表单项比较多的时候，或者表单项嵌套的是一个复杂的需要频繁变更值的控件就很可能出现页面卡顿等的性能问题。

如下图所示，即是实时更新表单域值的数据同步方案：

- 通过 Form 组件内部监听函数 onFieldsChange 获取实时变化的表单值，并通过上层组件的 `handleFormChange` 存储在 State 中
- 上层组件 State 发生变化，表单值通过 Props 传递给子组件，在传递给子组件之前会经过修饰子组件的 Form 组件，组件内部提供 `mapPropsToFields` 方法，这个方法的作用是把父组件的属性映射到表单项上，但是需要对返回值中的表单域数据用 `Form.createFormField` 标记

![real-time-synchronization](http://img.mrsingsing.com/ant-form-real-time-synchronization.png)

切换页面时进行数据验证并同步到上层组件的数据同步方案：

- 当用户对表单进行填充时，表单值的变化会实时反映到 Form 组件内部构建的 FieldsStore 实例中，驱动 Child 组件 Re-Render
- 当用户填充完毕并提交当前步骤的表单时，触发上层组件 handleFormChange 进行数据同步

整个流程相比实时存储的方案会更加简洁，减少因数据同步导致上层组件 Re-Render。

![verifying-synchronization](http://img.mrsingsing.com/ant-form-verifying-synchronization.png)

### 异步请求处理方案

表单编辑页在加载页面时，通过 Model 进行异步向服务器请求数据，而当服务器响应返回浏览器这段时间，页面的组件已经完成初始化阶段并挂载到浏览器 DOM 树中。

如果按照新建页面根据顶层组件的状态向底层组件传递表单域值，并于各个表单项初始化时使用 `initialValue` 设置表单的初始值，该值会由于组件初始化与异步请求响应之间存在时间差而失效，因此需要提供一种方案等待异步请求响应后再对底层组件进行初始化渲染。

既然底层组件需要对表单域值进行初始化，那么我们可以手动设置阻塞等待数据响应后才对底层组件渲染。

**简易示例：**

```jsx
static getDerviedStateFromProps(nextProps, prevState){
  if (
    !isEmptyObject(dataDetail) &&
    !isEmptyArray(dataList) &&
    !prevState.isInitial
  ){
    // ...Logic Disposal

    return {
      basic, receipt, usage, isInitial: true
    }
  }
  return null
}
```

通过生命周期函数 `getDerivedStateFromProps` 根据 Model 传入的 Store 再转存到顶层组件的状态中，这里设置了状态 `isInitial` 用于判断是否为异步请求响应后的初次触发，目的是避免 Props 变化或者顶层组件的父组件重渲染导致该生命周期函数触发。

除了在 `getDerivedStateFromProps` 对 State 赋值的操作进行拦截外，还需要在组件渲染控制器设定加载动效，以度过等待异步请求的时间，能有效缓解用户的焦虑。

```jsx
getCurrentStepComponent(current) {
  const canRendering = [basic, receipt, usage].every(item => !isEmptyObject(item));
  if (!canRendering) {
    return (
      <div className={styles.spin}>
        <Spin style={{ margin: 32 }}/>
      </div>
    );
  }
  // Return SubComponent to render
}
```

## 复合表单项设计分析

### 动态增减复合组件

在领取条件的分步表单中需要设计一个复合组件用于设定促销优惠券使用的时间段。

主要包含以下功能以及相关规则：

- 基础组件组合
  - 单项选择组件：用于控制其余基础组件隐藏与显示
  - 多项选择组件：选择周一至周日的多选输入框
  - 时间选择组件：每项为时分为元素的时间段选择输入框
- 时间选择组件支持动态增减，至少存在一个，至多存在五个
- 支持表单校验，时间范围选择必须合法，且多个时间范围间不能存在重叠情况

根据 AntDesign 的文档提供的相关实现方法，这里有两种实现方案：

- 一种是自定义表单控件，将多种类型的基础组件糅合在一起，多个字段综合为一个对象，存储在一个上层字段中（上层字段与其他表单项平级）

```jsx
const data = {
  name: 'Foo',
  interval: {
    type: 'ALL',
    week: ['1', '2', '3']
    interval: [
      { startTime: '08:00', endTime: '10:00'},
      { startTime: '12:00', endTime: '14: 00'}
    ]
  }
}
```

- 一种是根据动态增减表单项，将多个类型的基础组件生成多个字段，与其他表单项平级。[官方示例实现](https://ant.design/components/form-cn/#components-form-demo-dynamic-form-item)

从需求出发，无论出原型设计上还是前端组件设计上，都应该保持功能一致，也就是说这个组件应该封装成单独的组件，组件内部有控制开关，根据单项选择展示不同的次级表单项，而且动态增减的只是时间段输入框，而与单项选择和日期选择无关，因此将多个基础组件封装起来并通过 Ant Design 提供的自定义表单控件的组合模式能够更合理地实现此功能。

![time-interval-exhibition](http://img.mrsingsing.com/ant-form-time-interval-exhibition.gif)

## Form 组件使用总结

- 使用 Radio / Checked 这些选择组件是不推荐使用 feedback #issue
- input 在按 Tab 切换文本输入框时不获取焦点的方法：将 input 的 tabindex 设置为 -1
- input 不被选中的方法：设置 readonly 只读属性
- input 取消浏览器提供的自动填充 `autoComplete=off`
- 由 getFieldDecorator 包裹的表单组件默认值为 `undefined` 而非 `null` 或者 `''`

比如设置默认值可以这样设置

```jsx
getFieldDecorator('name', {
  initialValue: fields.name ? fields.name : undefined,
  rules: [],
})(<Input />);
```

- 多个校验规则在校验时反馈只单独显示一条规则，当该规则通过时再校验下条规则，可以设置 `validateFirst: true`
- 如果触发事件需要在上层处理，而数据在当前组件存储，那么可以在当前组件做一层拦截，在当前组件事件触发 `props` 传入的事件。
- 数组操作少用 `push` 直接在原数组中操作的方法，多使用 `concat` 、 `filter` 等返回新数组的方法（Immutable 的概念）

## 总结思考

- 应该减少需求功能实现的耗时，更应该关注用户的体验、组件设计的合理性和可扩展性、功能的可用性、功能的优化以及测试的覆盖性
- 因为该项目的主要需求都是基于 antd 基础组件库进行业务组件的封装，因此适当地研究 antd 底层源代码可以更好地理解组件运行原理，而且能学习到很多 React 组件优秀的设计模式和代码书写方式
- 类似的业务模块功能可能会经历多次迭代，功能可增可减，因此开发需求前对功能业务需要有适当地理解，这有助于前端开发对组件模块的设计，而设计的合理性不仅在出现问题时快速定位错误，而且能有效地减少后期维护的成本

## 参考资料

### 相关开源项目

- [antd: ^3.12.0](https://github.com/ant-design/ant-design)
  - [FormComponent](https://github.com/ant-design/ant-design/blob/master/components/form/index.en-US.md)
  - [rc-form](https://github.com/react-component/form)
  - [async-validator](https://github.com/yiminghe/async-validator)
- [moment: ^2.22.1](https://github.com/moment/moment)

### 分析

- [表单实现原理](https://github.com/ant-design/ant-design/blob/master/components/form/docs/tutorial.md)
- [10 分钟精通 Ant Design Form 表单](https://juejin.im/post/5c47ffff51882533e05ef4f9)
- [antd 表单性能的改进实践](https://zhuanlan.zhihu.com/p/27740483?utm_medium=hao.caibaojian.com&utm_source=hao.caibaojian.com)
- [Redux-sage API](https://redux-saga-in-chinese.js.org/docs/api/)
