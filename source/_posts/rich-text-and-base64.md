---
title: 富文本题目字符串转 Base64 图片实现
date: '2021-03-13'
---

## 需求背景

最近在负责利用 Egret 白鹭游戏引擎开发一款课中互动游戏，其中一个功能需要将 HTML 字符串形式存库的题目内容应用在互动游戏中。但是白鹭引擎是通过 WebGL 进行渲染的，DOM 树中通过一个 `<canvas>` 标签承载，无法通过 `innerHTML` 的方式直接使用 HTML 字符串，当时花费了不少时间研究如何优雅地实现类似的需求。

<!-- more -->

## 方案调研

遇事先从文档查起，在白鹭文档和论坛中找到了 `egret.HtmlTextParser` 这个方法，这个方法能将 HTML 格式文本转换为可赋值 `egret.TextField#textFlow` 属性的对象。

原本以为事情就是这么简单，但是经过尝试后遇到以下的问题：

1. 题目内容中有引用外链的图片、SVG 等，该方法无法支持
2. 题目 HTML 标签上含有 CSS 类名，这些需要应用固定样式的题目无法正常显示

由于无法通过 Egret 提供的 API 实现我们想要的效果，只能另寻出路。思考了一会后，我想到了三种可供解决方案的方案：

1. 在 `<canvas>` 标签外的上层增大 `z-index` 覆盖一层题目的 HTML 代码
2. 使用正则表达式匹配转换 HTML 字符串成对象数据结构，Egret 内部将对象数据转换为对应的 UI
3. 渲染 HTML 富文本字符串，通过 `html2canvas` 等第三方库转换成图片，以图片的形式在 Egret 中使用

第一种方案的缺陷比较明显：一是整个游戏由 Egret 引擎搭建，游戏的流程由项目内部代码实现控制，在外层挂载另外的 HTML 节点不好控制；二是题目显示学生答题后，有覆盖题目上层的正确答案（如下图所示），由于不同层级的缘故，无法实现题目内容再上层的覆盖，除非再单独建立一个图层覆盖，但这显示让整件事情变得更复杂、更难操作；三是这种方案在整个画布中不好定位。

![cq-img1](http://img.mrsingsing.com/cq-img1.png)

第二种方案也存在难以解决的一些问题，虽然说目前集团内部已经有比较成熟的题库，但早期还是通过接入外部题库的方式扩充题库，题目录入的富文本编辑器也经过很长时间的迭代，事实上生成的 HTML 字符串也是各不相同，我们无法制定统一的正则表达式完美地匹配所有的情况。

这或许有点难以理解，在数学题目的题干中会存在公式，一些会以 SVG 的形式渲染，一些则粗暴地以图片的形式存在，以图片形式存在是无法通过已有条件判断其为公式，即便能判断其为公式，类似这种 SVG 形式的 XML 标签也无法在 Egret 中使用。

因此只剩下最后一种方案，也是我们最后我们采纳的一种方案，我们 AI 录播课在上课前有个缓冲阶段，需要给课室中的学生绑定答题器等操作，利用这段空档期，我们能在 Electron 客户端挂载一个原理视口的节点，通过 HTML 解析加载每道题目，并通过 [html2canvas](https://github.com/niklasvh/html2canvas) 转为 Base64 的图片后，再交由 Egret 处理。

## 方案实现

通过服务端接口获取到题目的数据列表后，我们将数据以 10 条为单位切割分组（由于渲染绘制截图的过程耗时，为了提高效率，采用渲染多条截图一次的方式实现），每次渲染 10 条数据在固定宽高的盒子内。

```js
export function getBase64ByHtml2Canvas(dataInfo) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // 从以题目 ID 为键，题目数据为值的对象中抽离列表
        const dataList = Object.values(dataInfo);

        // 判断是否为有效的对象数组
        if (!isValidObjectArray(dataList)) {
          resolve({});
          return;
        }

        let result = {};
        let groups = [];

        // 为了提升效率，每次最多渲染 10 条题目，以最多 10 条为限制分好组别
        for (let x = 0; x < Math.ceil(dataList.length / 10); x++) {
          let start = x * 10;
          let end = start + 10;
          groups.push(dataList.slice(start, end));
        }

        for (const taskList of groups) {
          const taskResult = await createHtml2CanvasPromise(taskList);

          result = Object.assign({}, result, taskResult);
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    })();
  });
}

function createHtml2CanvasPromise(dataList) {
  return new Promise((resolve, reject) => {
    try {
      const root = document.getElementById('html2canvas');

      // 渲染前将根节点清空
      root.innerHTML = '';

      const documentFragment = document.createDocumentFragment();

      dataList.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('container');
        // 题目内容
        div.innerHTML = item.questionContentTranslate;
        div.dataset.id = item.questionId;

        // 由于公式图片过小，所以特殊处理宽高放大两倍
        const tagNames: any = div.querySelectorAll('.spark-formula-frame');
        if (tagNames.length > 0) {
          tagNames.forEach(item => {
            item.width = item.width * 2;
            item.height = item.height * 2;
            item.style.margin = '0 10px';
          });
        }

        documentFragment.appendChild(div);
      });

      root.appendChild(documentFragment);

      let images = Array.from(root.getElementsByTagName('img'));

      const renderContent = function() {
        // 解决图片还没加载完毕，就开始截图导致截取的图片为空白的问题
        const timer = setTimeout(() => {
          images = images.filter(item => item && !item.complete);

          if (images.length === 0) {
            const clientRect = root.getBoundingClientRect();

            // 开始通过 html2canvas 绘制并生成图片
            html2canvasformula(root, {
              backgroundColor: null,
              useCORS: true,
              width: clientRect.width,
              height: clientRect.height,
            })
              .then(canvas => {
                // 经过 html2canvas 处理，异步会返回 canvas 画布，后续操作需要自行处理
                const ctx = canvas.getContext('2d');

                document.body.append(canvas);

                const result = dataList.reduce((acc, item, index) => {
                  const elementRef = Array.from(root.children)[index];
                  const clientRect = elementRef.getBoundingClientRect();

                  // 截取的图片（Base64）
                  const base64 = cutImg(ctx, index + 1, clientRect.width, clientRect.height);

                  // 这是最终返回的自定义结构
                  const payload: any = {
                    questionId: item.questionId,
                    answer:
                      item.questionExplains && isValidObjectArray(item.questionExplains)
                        ? item.questionExplains[0].answerTranslate
                        : null,
                    audioUrl:
                      item.audioList && isValidObjectArray(item.audioList)
                        ? item.audioList[0].audioUrl
                        : null,
                    content: base64,
                  };

                  acc[item.questionId] = payload;

                  return acc;
                }, {});

                resolve(result);
              })
              .catch(() => {
                resolve({});
              });

            clearTimeout(timer);
          } else {
            renderContent();
          }
        }, 250);
      };

      renderContent();
    } catch (err) {
      reject(err);
    }
  });
}

function cutImg(ctx, index, width, height) {
  // 处理 Retina 高清屏
  let devicePixelRatio = 1;
  if (window.devicePixelRatio) {
    devicePixelRatio = window.devicePixelRatio;
  }

  // 盒子宽度：1008
  // 盒子高度：730
  const imgWidth = (width || 1008) * devicePixelRatio;
  const imgHeight = (height || 730) * devicePixelRatio;

  const sw = index * imgWidth - imgWidth;
  let imageData = ctx.getImageData(sw, 0, imgWidth, imgHeight);

  const canvas = document.createElement('canvas');
  canvas.width = imgWidth;
  canvas.height = imgHeight;

  const context = canvas.getContext('2d');
  context.putImageData(imageData, 0, 0);

  return canvas.toDataURL();
}
```

## 源码改造

其实 `html2canvas` 的实现原理很简单，就是读取已经渲染好的 DOM 树的结构和样式信息，然后基于这些信息在 Canvas 画布中绘制出来，最后通过 `canvas.toDataURL` 转换为 Base64。

但实际我们在使用时却遇到了不少麻烦，下图为当时（2021 年 2 月下旬）利用 html2canvas（v1.0.0-rc.7）写的 demo。如图中顶部第一个方框，是由 innerHTML 将后端给题目 HTML 字符串插入到 DOM 数中的，配合已知的样式，能呈现出我们最终需要的效果，这里我们可以特别留意的是，1980 其实是一张图片，实际上是黑色的字体，但由于互动游戏中为深色背景，我们的设计师要求使用白色的字体，不然最终呈现的效果，其实就是第二个方框所呈现出来的。

第二个方框其实是渲染完第一个方框后，通过 html2canvas 绘制到 canvas 上的效果，但是 html2canvas 此时并不支持利用 `filter: invert(1)` 对图片进行反相处理，所以呈现的效果并不如我们的预期，这里就需要我们对源代码进行魔改。

其次，第三个方框是通过 canvas 的 toDataURL 最终生成的 Base64 代码，从第一视觉来看，比正常的差不多大了两倍有多，这里直觉告诉我，也许与设备像素比有关系。

![cq-img2](http://img.mrsingsing.com/cq-img2.png)

[https://github.com/niklasvh/html2canvas/blob/3982df1492bdc40a8e5fa16877cc0291883c8e1a/src/render/canvas/canvas-renderer.ts#L259](https://github.com/niklasvh/html2canvas/blob/3982df1492bdc40a8e5fa16877cc0291883c8e1a/src/render/canvas/canvas-renderer.ts#L259)

上述代码片段是 `html2canvas` 中，获取 HTML 然后绘制成 Canvas 的关键方法 `renderReplacedElement`，当执行 `ctx.restore()` 后表示此次绘制已经结束，但是这里我们添加一个方法，将对样式中存在 `filter` 属性的节点元素进行反相。

```ts
function filterImage(box: Bounds, filter: any) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  // Retina 高清屏适配
  const finalBox: any = {
    left: devicePixelRatio * box.left,
    top: devicePixelRatio * box.top,
    width: devicePixelRatio * box.width,
    height: devicePixelRatio * box.height,
  };

  //
  const imageData: ImageData = this.ctx.getImageData(
    finalBox.left,
    finalBox.top,
    finalBox.width,
    finalBox.height
  );

  const imgWidth = imageData.width,
    imgHeight = imageData.height;

  for (let i = 0; i < imgHeight; i++) {
    for (let j = 0; j < imgWidth; j++) {
      const index = i * 4 * imgWidth + j * 4;

      let red = imageData.data[index];
      let green = imageData.data[index + 1];
      let blue = imageData.data[index + 2];

      imageData.data[index] = 255 - 2 * red + red;
      imageData.data[index + 1] = 255 - 2 * green + green;
      imageData.data[index + 2] = 255 - 2 * blue + blue;
    }
  }

  this.ctx.putImageData(imageData, fialBox.left, fialBox.top);
}
```

那么如何对 Canvas 图像进行反相呢？我们可以通过 `ctx.getImageData` 获取指定坐标宽高的区域，返回值为一个用来描述图片属性的数据对象 ImageData 对象。

它有三个属性，分别是 `data`、`width` 和 `height`。后两个属性代表指定图片的宽高，而另外一个 `data` 属性，则是一个 Uint8ClampedArray（8 位无符号整形固定数组）类型化数组。`data` 中的像素数据是按照从上到下，从左到右排列的，每个像素需要占用 4 位数据，分别是 R、G、B、Alpha 透明通道，

反相亦即将某个颜色替换成它的补色，在 RGB 模式中，反相实则是利用 255 减去 RGB 的值，得到的即为反相的 RGB 值。

通过在源码增加支持 Canvas 反相和兼容 Retina 屏幕的代码，解决了字体图片和尺寸问题。

![cq-img3](http://img.mrsingsing.com/cq-img3.png)

但是还有一个问题需要解决，那就是如何利用最小代价在原有项目中更改第三方库的源代码呢？

通过查阅资料可知利用 [patch-package](https://www.npmjs.com/package/patch-package) 能够为其他 npm 包构建补丁包，其实际原理是在工程目录下保存一份与线上版本的 npm 包的 git diff 文件。具体使用方法可以参考 [那些修改 node_modules 的骚操作](https://zhuanlan.zhihu.com/p/310266801)。

不过需要注意的是，文中提及的最优解 `patch-package` 其实也是有缺陷的，例如，如果 node_modules 中的 npm 包是 ES6 模块打包成 ES5 模块，或者是经过混淆打包的，那么可读性方面都没有源代码高，对于开发者修改起来会比较麻烦。

而 html2canvas 模块包正是打包后的 ES5 模块包，所以尽管修改内容不是特别多，我们还是 clone 到本地后修改后发布到内部的 npm 库中，其他业务线有相关的需求也能直接引用该模块解决，也利于后期的拓展。

其实到这里，整个技术方案的实现难点就已经解决，拿到题目内容的 Base64 图片后，就能够在 Egret 中 egret.BitmapData 位图生成图片。

除此之外，这里需要对图片进行适配，要保证图片能完整显示在题目内容容器内。

```ts
export class QuestionContent extends eui.Component implements eui.UIComponent {
  private initQuestionContent(): void {
    const img: HTMLImageElement = new Image();
    // this.questionInfo.content 就是 Base64
    img.src = this.questionInfo.content;
    // 是否是音频题
    const isAudio = this.questionInfo.audioUrl;

    // 图片适配
    img.onload = () => {
      let width = 0,
        height = 0;
      // 承载题目图片容器的可用最大宽高
      const avaliableWidth = this.contentGroup.width;
      let avaliableHeight = this.contentGroup.height;

      if (isAudio) {
        avaliableHeight = avaliableHeight - 130;
      }

      if (img.width > img.height) {
        height = img.height * (avaliableWidth / img.width);
        width = avaliableWidth;
      } else {
        width = img.width * (avaliableHeight / img.height);
        height = avaliableHeight;
      }

      img.width = width;
      img.height = height;
      img['avaliable'] = true;

      const bitmapdata: egret.BitmapData = new egret.BitmapData(img);
      const texture: egret.Texture = new egret.Texture();
      texture.disposeBitmapData = true;
      texture.bitmapData = bitmapdata;

      this.contentBitmap = new egret.Bitmap(texture);

      // 由于有音频组件，所以题目要向下移动 103 个单位高度
      if (isAudio) {
        this.contentBitmap.y = 103;
      }

      // 将题目位图插入舞台
      this.contentGroup.addChild(this.contentBitmap);
    };
  }
}
```

最终呈现的效果如下图所示：

![cq-img4](http://img.mrsingsing.com/cq-img4.png)

![cq-img5](http://img.mrsingsing.com/cq-img5.png)

参考资料

- [html2canvas 实现浏览器截图的原理（包含源码分析的通用方法）](https://segmentfault.com/a/1190000038551328)
- [基于 html2canvas 实现网页保存为图片及图片清晰度优化](https://segmentfault.com/a/1190000011478657)
