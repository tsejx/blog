---
title: 可视化配置系统页面批量更新工具的开发实践
date: '2019-11-15'
---

> 首发于：[可视化配置系统页面批量更新工具的开发实践](https://juejin.im/post/5dc8fd92f265da4d287f4551)

TotoroX 作为 PPmoney 集团内部集 UI 和业务逻辑于一体的前端页面可视化配置系统，为运营部门提供快速构建前端页面的解决方案。该系统为页面开发及运营人员提供了强大的组件市场，通过拖拽、表单配置等方式实现专题页面的业务需求。目前已支撑集团 850+营销活动页面。

## 业务痛点

在产品设计阶段，产品经理会根据对用户的调研，借助用户画像理解用户的需求，想想用户使用的场景，以及他们可能会遇到的困难。随着产品上线后，运营团队通过转化漏斗分析用户交互行为以及最终的转化的实际效果。所以这个阶段，随着真实用户群体的积累，在设计阶段虚构的用户画像需要重新调研、设想。

而在技术的角度，我们也希望通过用户行为数据，为产品运营提供更好的支撑，例如为不同的用户提供不同 UI 的前端页面，通过对比的方法观察数据变化，以此作为对用户行为的准确判断。

以下面的营销活动页为例，我们会在既有的页面配置中生成新的页面，并根据设计要求进行局部的调整，除了 UI 部分，内部逻辑包括埋点数据、事件链条关系等也会进行相关的修正。在此需求背景之下，如果需要人工手动对每个配置页面进行修改，这将会耗费大量的人力资源。而且，上文提到会涉及逻辑的修改，配置人员不易发现变更的地方，无法对修改后的页面进行校验。综上所述，我们需要一款对比前后变化的工具，能够可视化地对不同的配置数据进行对比，并通过图形绘制的形式清晰知道配置数据树中哪些节点没有修改，哪些节点修改了，修改前后的值又是什么，就好像我们进行代码协助时通过 `git diff` 能够知道文件中哪行代码发生了冲突，通过人工判断对冲突进行修改合并，并最终达到我们需要的效果。

![AB Test](https://img.mrsingsing.com/diff-tool-abtest.jpg)

TotoroX 基于用户配置的数据组装生成页面，配置数据均由组件市场的物料支撑，单个组件的配置数据结构基本相同，包括但不限于：唯一标识、组件名称、组件属性、组件样式、组件事件链以及动画相关配置等。组件间在配置数据的集合中是扁平化的，通过各组件配置数据中的标识集合相互关联起来，这样的数据结构设计避免了因为嵌套层级过深而产生的问题。基于这些条件，为多路差异化对比以及合并提供了可能。

<!-- more -->

## 差异化配置数据结构的设计

在进行配置数据的对比合并前，需要设计出能够准确描述数据变化前后的数据结构。

在 TotoroX 中，配置数据的结构模式与 JSON 的结构模式一致，因此数据结构的设计应以 JSON 的数据结构为基础。

而在 JSON 中值存在以下几种数据类型：

- null
- 字符串
- 布尔值
- 数值
- 数组
- 对象

因此，我们不用考虑诸如 Date、Function、Symbol、Set 等数据类型的值。

同时，在设定的配置数据中不能存在空值 `null`，如果要表示不对某配置项作配置，实际上会采用默认的配置属性，所以在实际配置数据中，是不会存在空值存在，可以忽略这种情况。

综合上述，从大致上能分为两大类数据类型：

- 基本数据类型：字符串、布尔值、数值
- 引用数据类型：数组、对象

那么我们是怎样去描述 JSON 对比前后变更状态呢？

JSON 是目前应用广泛的数据交换格式，那么交换双方肯定需要对数据进行约定和校验，而 JSON Schema 就是扮演定义 JSON 数据约束的标准。因此，我们尝试引入 JSON Schema 的概念，并结合实际功用进行改造。

传统的 JSON Schema 表现为这样：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/product.schema.json",
  "title": "Product",
  "description": "A product from Acme's catalog",
  "type": "object",
  "properties": {
    "productId": {
      "description": "The unique identifier for a product",
      "type": "integer"
    },
    "productName": {
      "description": "Name of the product",
      "type": "string"
    },
    "price": {
      "description": "The price of the product",
      "type": "number",
      "exclusiveMinimum": 0
    },
    "tags": {
      "description": "Tags for the product",
      "type": "array",
      "items": {
        "type": "string"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "dimensions": {
      "type": "object",
      "properties": {
        "length": {
          "type": "number"
        },
        "width": {
          "type": "number"
        },
        "height": {
          "type": "number"
        }
      },
      "required": ["length", "width", "height"]
    }
  },
  "required": ["productId", "productName", "price"]
}
```

从形式上来讲，JSON Schema 还是 JSON 的格式，但不同的是，JSON Schema 会在原来的 JSON 基础上在每个层级的数据外包装了一层用以描述对应层级值的相关信息，包括对应层级的值、描述、数据类型以及其它额外配置的信息。

在结构上，我们沿用了 JSON Schema 的一套标准，在源数据基础上通过遍历递归的方法对数据进行描述。而在描述的信息上，我们针对实际的应用场景进行了定制。

描述信息中必不可少的就是对数据变化信息的描述，我们参考了 Git 管理代码变更的策略，在两两对比下，我们梳理出可能产生的四种值比较情况：

- **相等（Equal）**：当两个基本数据类型的值严格相等时，则为相等状态；而对于引用数据类型，需要提供额外的手段进行匹配
- **新增（Add）**：当对象间对比时，目标对象存在新增的键时，描述该键值为新增状态；同理，当数组中无对应的匹配项时，则为新增状态
- **删除（Delete）**：与新增状态类似，当对象间对比时，目标对象存在删除的键时，描述该键值为删除状态，而数组中对应的匹配项不存在时，则为删除状态
- **冲突（Conflict）**：当两个基本数据类型的值不严格相等时，则为冲突状态

举个例子，如下为两个个仅有一个按钮组件的配置页数据集合：

![修改前后的配置数据](https://img.mrsingsing.com/diff-tool-data-structure-comparation-.jpg)

通过 diff 后预设能产生的数据结构：

![对比后产生的数据结构](https://img.mrsingsing.com/diff-tool-result-data-structure.jpg)

我们对描述变化的数据结构进行了约定：

- 对象类型和数组类型的值使用 `_properties` 字段描述，对应值被源数据对应的数据类型包裹
- 基本数据类型的值根据具体值的状态 `_status` 决定展示的字段
  - 相等（Equal）：使用 `_origin` 表示值
  - 新增（Add）：使用 `_target` 表示新增的值
  - 删除（Delete）：使用 `_origin` 表示删除的值
  - 冲突（Conflict）：使用 `_orign` 表示更改前的值，`_target` 表示更改后的值

你也许会发现即便是对象类型和数组类型，也会有 `_status` 字段描述更改状态。这是因为我们在交互界面上采取了**自底向上**的状态变更显示策略。例如，当一个组件配置数据大部分保持不变的情况下，样式配置字段 `style` 中的 `height` 配置项改变了值，那么除了描述该字段的 Schema 结构中状态字段 `_status` 会显示为冲突（Conflict）外，在递归返回的过程中，亦会将层级更高的对象或数组状态标记为冲突（Conflict）。

> 需要特别说明的是，如果下层结构仅有一种变化状态时，上层结构会显示该变化状态，而下层结构存在不只一种变化状态时，则上层会统一表示为冲突状态。

![状态自底向上传递显示策略](https://img.mrsingsing.com/diff-tool-status-display-tatics.jpg)

这样处理的目的，是为了树结构在可视化视图组装渲染后能够更清晰地让配置人员知道各节点的状态。树状的图形能够让开发人员快速知道哪些组件配置项发生了变更，并能沿着路径找到变化的根源。

![可视化冲突解决界面](https://img.mrsingsing.com/diff-tool-path-to-root.jpg)

## Diff 功能实现

约定好对比后的数据结构后，那么就要通过方法封装对变化前后的页面配置数据进行比较。

在实现 diff 方法前，就设想实现的方法应该能保证在不同的配置数据结构下也能使用。也就是说，实现过程需要脱离业务相关的代码，尽可能保证方法通用性。

而在实现过程中，我们遇到的其中一个问题就是当对比双方的数组类型且其数组成员为对象类型时，我们需要为此类情况提供用于匹配的方法。

我们以 TotoroX 的配置为例来解释为什么需要为数组结构的比较提供匹配方法。例如 TotoroX 的配置数据中 `eventList` 字段表示组件相关的事件列表，每个事件（对象）之间的 `name` 字段是唯一的，因此我们在对比 `eventList` 数组时，需要明确对象数组中各成员的 `name` 键值为严格相等，才能对双方进行后续的 diff。而实际上，并非所有对象数组都通过 `name` 字段进行匹配，将类似的代码参杂到通用类型方法中显然是不恰当的。因此，我们需要提高类库的可拓展性，将用于对象数组匹配的方法抽离，并通过配置的形式植入。

![Button组件配置](https://img.mrsingsing.com/diff-tool-button-data.jpeg)

### 数组辅助方法

对象数组间的匹配筛选在实现中应用的场景是较多的，因此我们封装了一系列的辅助方法减少重复的代码，包括：

**数组差集函数**

通过数组成员间逐一对比，筛选出两数组中所有成员的差集集合并返回（仅限于数组成员为基本类型值）

```js
function getDifference(a, b) {
  return [...new Set(a.filter(x => !new Set(b).has(x)))];
}
```

功能同上，当对象数组成员为对象类型时使用，需要提供用于匹配的比较器函数，返回结果只保留以参数 `a` 传入的数组的成员项

```js
function getDifferenceWith(a, b, comparator = (x, y) => x === y) {
  return a.filter(x => b.findIndex(y => comparator(x, y)) === -1);
}
```

**数组交集函数**

通过数组成员间逐一对比，筛选出两数组中所有成员的交集集合并返回（仅限于数组成员为基本类型值）

```js
function getIntersection(a, b) {
  return [...new Set(a.filter(x => new Set(b).has(x)))];
}
```

功能同上，当对象数组成员为对象类型时使用，需要提供用于匹配的比较器函数，返回结果只保留以参数 `a` 传入的数组的的成员项

```js
function getIntersectionWith(a, b, comparator = (x, y) => x === y) {
  return a.filter(x => b.findIndex(y => comparator(x, y)) !== -1);
}
```

**数组并集函数**

```js
function getUnionWith(a, b, comparator = (x, y) => x === y) {
  return Array.from(new Set([...a, ...b.filter(x => a.findIndex(y => comparator(x, y)) === -1)]));
}
```

**数组去重函数**

```js
function getDedupeBy(arr, comparator = (x, y) => x === y) {
  return arr.reduce((acc, v) => {
    if (!acc.some(x => comparator(v, x))) {
      acc.push(v);
    }
    return acc;
  }, []);
}
```

可以留意到，上述辅助函数除了用于匹配的两个数组类型的参数外，还需要提供一个 `comparator` 的参数。`comparator` 意为比较器，类型为函数类型，用于封装方法内部 `filter` 函数对应的回调函数，从而筛选出用以匹配数组的对象成员。如：

```js
const comparator = (x, y) => x.id === y.id;
```

表示为 `x` 对象的 `id` 字段与 `y` 对象的 `id` 字段完全相等时，表示 `x` 对象和 `y` 对象为匹配的双方。

通过这样的形式，我们能够将配置中数组形式存在的配置项的匹配字段以 `comparator` 的形式配置植入，而不必在实现的代码中植入业务相关的代码。当然，仅仅如此并不够的，因为还无法解决到底配置结构中到底哪个层级是数组类型的值，下面会详细解析如何解决这个问题。

### 差异化流程实现

根据 JSON 的不同类型的处理方式的不同，我们实现了三个方法：

- `diffObject`：用于对象类型值之间的对比方法，通过 `Object.keys` 获取各自对象的键名集合，配合数组差集函数和数组交集函数，可以筛选出新对象中新增的字段集合、旧对象中删除的字段集合以及新对象和旧对象共有的字段集合
- `diffArray`：用于数组类型值之间的对比方法，通过 `comparator` 比较函数入参，同样利用差集函数和交集函数，分别筛选出新数组中新增的数组成员、旧数组中删除的数组成员以及各自数组中共有的数组成员
- `diffValue`：用于基本数据类型值的对比方法，采用严格相等的对比方式，若相等则为相等（Equal）状态，否则为冲突状态（Conflict）

引用类型的值比较（也就是 `diffObject` 和 `diffArray`）在匹配到键值或数组成员时，会利用调和函数作为匹配跳板，根据传入数据源类型不同继续对下层结构的值递归执行上述三种不同数据类型的方法。

而旧对象/旧数组中删除的值或新对象/新数组中新增的值，则不会再进行深层次的递归，会直接投放到另一个处理方法 `getRecursion` 中递归修改下层结构中的变化状态。

![diff结构流程图](https://img.mrsingsing.com/diff-tool-workflow.jpg)

对象类型值之间的比较，我们会使用 `Object.keys()` 方法分别获取两个对比对象的键名，并通过数组辅助方法拆分为三组：共同拥有的键名的集合、仅有 `origin` 对象（理解为变化前的配置对象）拥有的键名的集合和 `target` 对象（理解为变化后的配置对象）拥有的键名集合。

由此可得，共同拥有的键名集合需要通过比较得出变化状态。而 `origin` 对象拥有的键名，则表示 `target` 对象没有，也就是 `origin` 对象集合中的键值被删除了，会被标记为删除状态。相似地，仅 `target` 对象拥有的键名表示 `origin` 没有该键名，则 `target` 的键值为新增配置项，会被标记为新增状态。

刚才提到对象数组类型之间需要通过比较器函数 `comparator` 用于匹配，但是需要提供一种让运行机制知道什么样的数组对比需要用怎样的 `comparator`。在运行 diff 前，我们通过以递归路径为键名，以 `comparator` 为键值组成的配置对象传入 `diff` 函数。

在向下递归进行配置项比较时，遇到对象类型的值，会将键名传入调和函数。在函数内部，会被推入一个已声明的面包屑栈（也称为递归路径，以数组形式表示），当返回值时，又会退栈。当检查到下层结构为数组类型时，会通过 `Array.prototype.join()` 方法将面包屑栈中的值合成键名路径，匹配外部传入的比较器配置后，将下层数组结构匹配所需的 `comparator` 传入 `diffArray` 中。这样就解决了对象数组匹配的问题，同时也将相关的业务代码抽离至外部，提升了方法的通用性和可配置性。

```js
const comparator = {
  // 如果原始数据为数组类型（也就是传入数据最外层为数组类型），必须有 init 字段作为 comparator 函数
  init: (a, b) => a.name === b.name && a.id === b.id,
  eventList: (a, b) => a.name === b.name,
  'eventList.value': (a, b) => a === b,
  'eventList.subEvents': (a, b) => a.id === b.id,
  'eventList.subEvents.actions': (a, b) => a.id === b.id,
  animation: (a, b) => a.antType === b.antType,
};
```

⚠️**注意**：如果原始数据为数组类型，则必须提供 `init` 作为根（顶层）结构的比较器函数。

上述就是 diff 功能实现过程中遇到的主要问题的解决方案，但是仅对两路的配置数据进行 diff 是不够的，这主要是从我们本身 TotoroX 的业务考虑。如前文所述 `origin` 可以为用于创建页面的模版，`target` 为基于模版创建的页面，但后续需求变更时会对模版数据进行修改，而在我们的系统中并不会同步到创建的页面，那么模版修改后需要将修改的内容同步到之前创建的页面，就需要提供一个用于合并新模版与旧页面的方法，下面我们就聊聊 merge 功能的实现。

## Merge 功能实现

在对 merge 功能实现过程进行讲解前，我们需要对 git 的合并策略进行一定程度的了解。

git 采用三路合并策略：

```
B - C - D master(*)
 \
  E - F dev
```

以我们日常的开发协作流程为例，当前分支也就是主分支为 `master`，当尝试把 `dev` 开发分支合并到 `master` 时，两个分支共同拥有的提交就是 commitB，我们将该提交 commit 称为 `base`，`master` 分支最新的提交 commitD 称为 `ours`，而 `dev` 分支最新的提交 commitF 称为 `theirs`。

那么 git 是怎样合并 `ours` 和 `theirs` 的呢？

在合并时，会参考他们的共同祖先 `base`，并根据下面策略进行合并。

| 祖先（base） | HEAD（ours） | 分支（theirs） | 结果     | 说明                                                             |
| ------------ | ------------ | -------------- | -------- | ---------------------------------------------------------------- |
| A            | A            | A              | A        |                                                                  |
| A            | A            | B              | B        | 如果一方修改了一行，那么这一行选择修改版的                       |
| A            | B            | A              | B        | 同上                                                             |
| A            | B            | B              | B        | 如果某一行双方拥有相同的变更，则选择修改过的行                   |
| A            | B            | C              | conflict | 如果某一行双方都修改了，且修改得不一样，则报告冲突，需要用户解决 |

根据上表规则，合并过程类似这样：

![合并过程](https://img.mrsingsing.com/diff-tool-merge-strategy.png)

可以看到，第四行，双方都修改了，且各自修改的内容不一样，所以 git 不知道怎么解决，所以就把问题抛给用户了。

### 根节点层级筛选合并

我们在实现 merge 功能时，正是采用了与此种合并策略一致的方式。在 merge 的合并流程中，原始数据即为**祖先**（base），而实际需要合并的两份数据分别为 **Head**（ours）和**分支**（theirs）。我们将 `base` 作为中间者，以此判断两份配置数据哪些部分是属于原始数据的，哪些部分又是新数据。

首先，我们分别将新数据与共同组件 `base` 进行 diff 操作，获得分别的 JSON Schema 结构的结果，后续再对结果进行 mergeBranch 的操作。

```js
function merge(base, ours, theirs, diffComparator, mergeComparator) {
  const originDiff = diff(base, ours, diffComparator);
  const targetDiff = diff(base, theris, diffComparator);

  const newDataSchema = mergeBranch(originDiff, targetDiff, mergeComparator);

  return newDataSchema;
}
```

而由于 merge 是根据两两 diff 后的 Schema 结构的 JSON，我们先从**根节点**的 `_status` 字段匹配进行区分，共有五种情况：

| 源配置数据根节点状态 | 变更配置数据根节点状态 | 说明                                                                                                                                  |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Equal                | Equal                  | 表示 `base` 和 `ours` 完全相等，`base` 和 `theirs` 完全相等，即表示三路完全相等                                                       |
| Equal                | Updated                | 表示 `base` 和 `ours` 完全相等，`base` 和 `theirs` 存在变更，即单路变更，最终给你会采用变更路数据                                     |
| Updated              | Equal                  | 表示 `base` 和 `ours` 存在变更，`base` 和 `theirs` 完全相等，即单路变更，最终给你会采用变更路数据                                     |
| Updated              | Updated                | 表示 `base` 和 `ours` 存在变更，`base` 和 `theirs` 也存在变更，但是变更对应的值不相等，即三路冲突                                     |
| Updated              | Updated                | 表示 `base` 和 `ours` 存在变更，`base` 和 `theirs` 也存在变更，但是变更对应的值相等，实际上 `ours` 和 `theirs` 变更值与 `base` 值冲突 |

![变更状态韦恩图](https://img.mrsingsing.com/diff-tool-merge-venn-diagram.jpg)

对上述五种情况进行分析归纳后，在代码实现层面上可以大致分为三个方向处理：

1. 三路相等（A-A-A）=> `mergeUnmodified`（相当于上文韦恩图天蓝色部分中状态为 `equal` 的部分）
2. 单路变更，采用变更路数据（A-A-B、A-B-A）=> `mergeUpdated`（相当于上文韦恩图紫色和橙色部分，表示的是 `base` 存在但是存在变更的状态，可以是完全或局部的删除和冲突，也可以是局部配置项的新增，但是不可能是完全的新增）
3. 两路变更，根据变更情况选择或保留冲突状态并提供手动处理方式，变更又分为新增、删除和修改（A-B-B、A-B-C）=> `mergeConflict`（相当于上文韦恩图绿色、红色和蓝灰色）

三路相等的情况是最好处理的，在对根节点进行遍历时匹配两者的 `_status` 变化状态为相等状态（`equal`）时即表明三路相等。

单路变更的情况，在对根节点进行遍历时匹配两者的 `_status` 为相等（`equal`）而另一方为不相等，即为需要采用变更路数据。

而对于两路变更的情况，我们不能单纯地以根节点的状态作为区分，这是因为我们采用了上文提及过的**自底向上的状态变更显示策略**，所以根节点呈现为变更状态，不代表整个结构内部的属性均为变更状态，也可能因为某个配置项的变更，导致结构树上层的状态改变。所以对于这种情况，我们又能细分为两种情况进行处理：

1. 通过 `comparator` 比较函数能两两匹配的节点树，实际上为 `base`、`ours` 和 `theirs` 三路均存在该根节点的，则需要对双方子孙层级的节点进行递归遍历并逐一对比（相当于上文韦恩图中蓝色 `conflict` 的部分）
2. 在对比双方的配置数据中，根节点状态 `_status` 为新增状态（`add`）且子孙层级的配置属性值也为新增状态时，则可判断该配置树为完全新增（相当于上文韦恩图中绿色 `add` 的部分），按照约定的合并策略，需要保留整个配置树

### 子孙层级筛选合并

下面我们把重点聚焦于两路变更的情况下子孙层级筛选合并的实现。

从根节点的变更状态的角度分析（已排除完全新增的配置节点树），可以大致分为五种情况：

| base_ours 根节点状态 | base_theirs 根节点状态 | 说明                                                                                                                                                |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add                  | Add                    | 表示 `base` 没有某项配置项，而 `ours` 和 `theris` 新增了某项配置项                                                                                  |
| Conflict             | Conflict               | 表示 `base` 存在某项配置项，`ours` 也存在该项配置项但是值与 `base` 不同，`theris` 也存在该项配置项但是值与 `base` 也不同（未必与 `ours` 相同/不同） |
| Conflict             | Delete                 | 表示 `base` 存在某项配置项，`ours` 也存在该项配置项但是值与 `base` 不同，而 `theris` 则不存在该项配置项                                             |
| Delete               | Conflict               | 表示 `base` 存在某项配置项，`ours` 不存在该项配置项，而 `theris` 存在该项配置项且值与 `base` 不同                                                   |
| Delete               | Delete                 | 表示 base 存在某项配置项，`ours` 和 `theris` 均不存在该配置项                                                                                       |

我们以一个简单的代码示例说明：

![三路合并配置代码示例](https://img.mrsingsing.com/diff-tool-merge-code-demo.jpg)

结合上文提及五种两两比对存在变更状态时的情况，并结合代码示例得出以下结论：

- `color` 对应第一种情况，`base` 没有该配置项，而 `ours` 和 `theirs` 则有
- `width` 对应第二种情况，`base` 有该配置项，而 `ours` 和 `theirs` 同样有该配置项，但是 `ours` 和 `theirs` 的值存在差异
- `height` 同样对应第二种情况，与 `width` 配置项不同的是，`ours` 和 `theirs` 的值严格相等
- `translateX` 对应第三种情况，`base` 与 `ours` 有该配置，且值冲突，而 `theirs` 则删除了该配置项
- `translateX` 对应第四种情况，`base` 与 `theirs` 有该配置，且值冲突，而 `ours` 则删除了该配置项
- `line-height` 对应第五种情况，仅 `base` 存在该配置项，`ours` 和 `theirs` 均删除了该配置项

> 这里提及的新增或删除字段只为覆盖更完整的功能，实际的可视化配置业务中，因为组件的配置项基本固定且均提供了默认值，所以出现新增或删除字段的情况较少。

最后基于 `base` 进行 diff 后得出如下两份 JSON Schema 结构差异化数据：

![diff-between-base-and-ours](https://img.mrsingsing.com/diff-between-base-and-ours.jpg)

![diff-between-base-and-theirs](https://img.mrsingsing.com/diff-between-base-and-theirs.jpg)

基于三路合并的策略，当三路值均不同时会保留差异让用户手动解决，当变更两路值相同或新增时则保留相同值，最后合并后得出新的 JSON Schema 配置数据：

![Merge base and ours and theirs](https://img.mrsingsing.com/diff-tool-merge-base-ours-and-theirs.jpeg)

## Revert 功能实现

最终通过自动合并和手动解决冲突，完整的配置数据应该所有节点都表示为相等状态。通过对返还的 JSON Schema 结构的数据递归还原，自动新建页面即完成整个批量更新页面的功能。

---

**参考资料**：

- [三路合并 Git 学习笔记 17](https://blog.csdn.net/longintchar/article/details/83049840)
