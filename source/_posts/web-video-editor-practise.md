---
title: 云视频剪辑配齐工具实践复盘（实现篇）
date: '2021-06-12'
---

上篇介绍了云视频剪辑配齐工具的技术架构，对整个项目的构成有了大致的了解，本文将介绍在实现该系统的前端技术难点及解决方案。

> 该项目基于集团内部的平台实践，前端框架使用 Angular 实现，所以代码示例为 Angular 框架语法。

## 上传视频

常见的上传视频方式有两种：用户通过表单打开文件选择器选择需要上传的文件和直接拖拽文件到 Web 页面的指定区域，Web 应用检测可得对应视频文件的内容。

### 选择文件上传

伪代码实现：

```html
<input multiple type="file" accept="video/mp4" (change)="handleVideoMaterialUpload" />
```

```js
import axios from 'axios';

function handleUpload(e) {
  const uploadUrl = 'https://upload-url.com/';
  const fileList = e.target.files;

  // 上传前校验
  // do something

  // do something 上传到指定服务
  const formData = new FormData();

  formData.append('file', filesList[0]);

  axios
    .post(uploadUrl, formData)
    .then(res => {
      console.log('上传成功', res);
    })
    .catch(err => {
      console.log('上传失败', err);
    });
}
```

在上传视频文件前不仅要检测视频文件的类型、大小等基础信息，还要对视频文件进行可播放性检测，并且在检测过程中获取视频文件时长、封面等再后续流程中使用到的信息（该部分实现请看下文章节），检测同过后添加到解析队列。

<!-- more -->

### 拖拽文件上传

通过监听指定区域的 `dragOver` 和 `drop` 事件，能通过入参属性 `e.dataTransfer` 获取用户所拖拽的文件对象，后续的操作与选择文件上传部分一致。

```html
<div class="drag-area" (dragOver)="onDragOver" (drop)="onDrop"></div>
```

```js
function onDragOver(e) {
  const fileList = e.dataTransfer.files;

  // do something 后面的流程参考「选择文件上传」
}
```

两种方式的处理逻辑基本一致，只是用户交互方式不一样，难度比较小。

### 上传视频最佳实践

企业内部二进制文件数据一般都由云服务提供的对象存储服务负责存储，比如 [阿里云 对象存储 OSS](https://help.aliyun.com/product/31815.html)、[腾讯云 对象存储 COS](https://cloud.tencent.com/document/product/436)，这需要企业购买使用。这些对象存储的上传实现方式有多种，想了解更详细的内容可以点击上述连接。

我们内部使用的是阿里云的 OSS 对象存储服务，简要流程就是前端通过后端接口获取阿里云 OSS 上传凭证，通过上传凭证直接讲文件上传到 OSS 服务。

![upload-swim](https://img.mrsingsing.com/upload-swim.jpg)

## 音视频文件信息

获取视频文件后，可以通过浏览器提供的 `window.URL.createObjectURL` 生成视频文件的 Blob 引用地址，在页面创建并挂载 `<video>` 标签， 读取内存中的视频文件，当 `video` 实例触发 `canplay` 事件后创建 Canvas 画布，根据视频文件宽高适配画布宽高，

在 `video.play` 外层包裹 `try...catch` 如果报错则说明视频损坏不可播放，否则说明视频有效。

```js
const captureImagePreview = async (videoFile: File) => {
  return new Promise((resolve, reject) => {
    	(async () => {
        const captureArea = document.getElementById('captureArea');
      	// 要截图的视频
      	const video = document.createElement('video');
      	video.muted = true;

    		// 生成 blob 地址
      	const blobUrl = window.URL.createObjectURL(videoFile);

      	video.src = blobUrl;

    		// 在预设的节点上挂载 video DOM 节点
      	captureArea.appendChild(video);

    		// 挂载后会自动加载本地的视频文件
      	video.addEventListener('canplay', e => {
        	let imgHeight = 0,
            imgWidth = 0,
            videoWidth = 0,
            videoHeight = 0;
        	const video: any = e.target;

        // 利用 Canvas 对视频文件进行截屏
        const canvas = document.createElement('canvas');
        const canvasCtx = canvas.getContext('2d');
        const blobUrl = window.URL.createObjectURL(videoFile);

        // 获取展示的 video 宽高作为画布的宽高和临时视频截图的宽高
        canvas.width = imgWidth = video.offsetWidth;
        canvas.height = imgHeight = video.offsetHeight;

        // 获取实际视频的宽高，相当于视频分辨率
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;

        try {
        	await (video as HTMLVideoElement).play();
        } catch (err) {
        	this.$notification('格式有误，请重新上传');

          resolve(null);
          return;
        }

        video.pause();

        // canvas.drawImage 方法第一个参数允许的图像源包括 HTMLVideoElement 等
        canvasCtx.drawImage(
          video,
          imgWidth - videoWidth,
          (imgHeight - videoHeight) / 2,
          videoWidth,
          videoHeight,
          imgWidth - videoWidth,
          (imgHeight - videoHeight) / 2,
          videoWidth,
          videoHeight,
        );

        canvas.toBlob(blob => {
          // 视频封面图
          const url = URL.createObjectURL(blob);

          const material: Material = {
            // 视频时长
            duration: video.duration,
            // 视频封面图 Blob 地址
            videoCoverUrl: url,
            // 视频文件名
            videoName: videoFile.name,
            // 生成 uuid 作为 videoId
            videoId: CommonUtils.generateUUID(),
            // 视频状态（解析中）
            status: MaterialStatus.Parse,
            file: videoFile,
            // 视频大小
            fileSize: videoFile.size,
            // 教材 ID
            fileId: this.aiMatchBordcastService.fileId,
            // 视频文件 Blob 地址
            blobUrl: blobUrl,
            // 生成时间
            createDttm: +new Date(),
          };

          resolve(material);

          captureArea.removeChild(video);
      	})();
      });
  })
}
```

## 游标

游标是视频剪辑软件中用于辅助用户快速定位，减少误操作的一种手段。在我们的云视频剪辑配齐工具中设计提出了三种功能的游标，分别是预览游标、定位游标和磁吸游标。

### 定位游标

![located-cursor](https://img.mrsingsing.com/located-cursor.gif)

定位游标是用于定位视频播放的位置、插入互动锚点的位置的标的，定位游标在轨道工作区的位置对应着完整视频的所在的时间点，同时播放器呈现的画面需要定格在对应时间的画面，若处于播放中还需要跳转到指定时间开始播放。

从 UI 层面或交互层面上的实现来看难度尚可，但其实真正实践下来，最大的挑战还是如何处理好各种通知事件引起游标位置的联动。

定位游标和游览游标分别采用鼠标点击事件和鼠标移动事件触发，利用鼠标事件获取的水平方向偏移量及当前游标尺比例计算出当前位置对应完整合成视频的时间。

另外为了减少轨道工作区的回流，采用绝对定位和 transform: translateX() 的方式相对于轨道滑动区域开端进行水平方向偏移。

```js
const CONSTANTS = {
  /** 游标尺整数刻度占据的像素值 */
  RULER_INTEGER_SPACING: 80,
  /** 标的元素间距宽度 */
  INDICATOR_WIDTH: 30,
  /** 定位游标的初始值 */
  CURSOR_INITIAL_VALUE: 31,
};

const handleLocatedCursoRedirect = ({
    cursorShift = CONSTANTS.CURSOR_INITIAL_VALUE,
    duration,
    frameBeginTime,
    framework,
    anchor = null,
  }) => {
		if (!cursorShift) return;

    // 轨道空置时，不设置定位游标
    if (!this.videoTrackList.length) {
      this.currentDuration = 0;
      this.setLocatedCursor = null;
      this.currentLocatedBeginTime = 0;
      this.currentLocatedFramework = null;
      this.currentLocatedAnchor = null;

      this.setLocationInfo();

      return;
    }

    let currentDuration = 0;
    // 计算当前定位游标所在的时间
    if (CommonUtils.isDefined(duration)) {
      currentDuration = duration;
    } else {
      // 鼠标点击区域对应的时间
      const mouseDuration =
        ((((cursorShift - CONSTANTS.CURSOR_INITIAL_VALUE) / CONSTANTS.RULER_INTEGER_SPACING) * this.scaleRatio).toFixed(2) as any) * 1;

      // 超出视频框架区域，自动定位到框架区域末尾
      if (mouseDuration >= this.totalDuration) {
        currentDuration = this.totalDuration;
        cursorShift =
          this.lastFrameworkClientRect.left - this.indicatorClientRect.left + this.lastFrameworkClientRect.width;
      } else {
        currentDuration = mouseDuration;
      }
    }

    // 定位游标当前时间
    this.currentDuration = currentDuration;

    // 变更定位游标位置
    this.setLocatedCursor = cursorShift;

    // 根据定位游标位置获取游标所在框架数据、相对于框架的开始时间和锚点数据
    if (!framework) {
      try {
        const { frameBeginTime, frameworkId, anchorId } = this.getFrameworkInfoByDuration(cursorShift);

        this.currentLocatedBeginTime = frameBeginTime;
        this.currentLocatedFramework = this.videoTrackList.find(item => item.id === frameworkId);
        this.currentLocatedAnchor = anchorId
          ? this.videoTrackList.find(item => item.id === frameworkId).dataList.find(item => `${item.id}` === anchorId)
          : null;
      } catch (err) {
        console.log(err);
      }
    } else {
      // 当前游标定位在框架内的开始时间
      this.currentLocatedBeginTime = frameBeginTime;
      // 当前游标定位所在的框架
      this.currentLocatedFramework = framework;
      // 当前有标定位所在的锚点
      this.currentLocatedAnchor = anchor;
    }

  	// 保存当前位置信息
    this.setLocationInfo();

  	// 返回当前游标对应的时间
    return currentDuration;
}
```

### 预览游标

![preview-cursor](https://img.mrsingsing.com/preview-cursor.gif)

当鼠标进入轨道工作区，就会自动跟随一根预览游标，预览游标所到之处，播放器需要展示该时间位置对应的画面。所以此处只需要监听 `mousenter` 鼠标进入轨道工作区，利用 `mousemove` 实时变更预览游标偏移值，并调用播放器组件变更预览画面，当然由于鼠标事件触发频率高，需要对调用预览方法进行防抖操作，当 `mouseleave` 离开工作区时隐藏预览游标。

### 磁吸游标

![magnet-cursor](https://img.mrsingsing.com/magnet-cursor.gif)

当用户拖拽视频素材到轨道工作区，或拖拽工作区框架进行排序操作，需要在完整视频开端、结尾及框架与框架之间衔接处显示绿色磁吸游标，方便用户定位拖拽的素材最终在轨道工作区中插入的位置。

这里的实现方式是，当检测到用户开始拖拽动作时，通知轨道工作区生成所有磁吸区域的坐标信息列表，并在 DOM 中生成对应数量的磁吸区域。

为了方便理解，下图红色区域为开始拖拽后生成的磁吸区域。为了减少操作导致页面频繁重排重绘的问题，所有生成的元素都是基于基点进行 `translate` 便偏移。

![magnet-area](https://img.mrsingsing.com/magnet-area.png)

你肯定会有疑问，为什么磁吸区域能检测到拖拽元素位于上方，这与拖拽指令的实现有关，可以留意后面对拖拽指令的详细说明。

```less
// 磁吸区域
.magnet-area-item {
  box-sizing: border-box;
  position: absolute;
  top: 0;
  max-width: 80px;
  height: 100%;
  z-index: 1450;
  /* 方便查看效果 */
  background-color: rgba(255, 0, 0, 0.3);

  &.first {
    transform: translate3d(0, 0, 0);

    &.active {
      .magnet-area-cursor {
        left: 0;
        transform: none;
      }
    }
  }

  &.last {
    transform: translate3d(-100%, 0, 0);

    &.active {
      .magnet-area-cursor {
        left: initial;
        right: 0;
        transform: none;
      }
    }
  }

  &.active {
    // 磁吸游标
    .magnet-area-cursor {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      width: 2px;
      height: 100%;
      background-color: #1db368;
      transform: translateX(-50%);
    }
  }
}
```

```js
  const initMagnetArea = () => {
    this.currentMagnetAreaList = [];

    // 利用定位元素（轨道列表前用于占位的空元素）获取当前轨道区域中所有的视频框架的 DOM 元素引用
    const frameworkList = this.indicatorRef.nativeElement.parentElement.querySelectorAll(
      '.framework-item',
    ) as NodeListOf<HTMLDivElement>;

    const indicatorLeft = this.indicatorClientRect.left;

    this.currentMagnetAreaList = Array.from(frameworkList).reduce(
      (acc: any, item: HTMLDivElement, index: number) => {

        // 获取单个视频框架对应 DOM 元素的大小及视口位置
        const frameworkRect = item.getBoundingClientRect();

        // 生成磁吸区域的宽度
        // 由于不同时长不同比例下框架实际的宽度不一致
        // 若使用过小的（固定）宽度作为磁吸区域，会导致在较大宽度的框架中需要更靠近两框架衔接处才能显示磁吸游标
        // 所以这里取框架宽度的 30% 作为磁吸区域在当前框架区域所占的宽度
        const currentWidth = frameworkRect.width * 0.3;
        // 磁吸区域宽度
        const areaWidth = index === 0 ? currentWidth : currentWidth + acc.prevWidth;
        // 磁吸游标在磁吸区域的偏移量
        const areaShift = index === 0 ? 0 : (acc.prevWidth / areaWidth) * 100;

        acc.list.push({
          id: item.dataset.id,
          areaWidth: areaWidth,
          areaTranform: `translateX(-${areaShift}%)`,
          areaLeft: frameworkRect.left - indicatorLeft + 'px',
          cursorLeft: areaShift + '%',
        });

        // 最后一片磁吸区域，是最后一个视频框架的最后 30% 的区域
        // 拖拽素材新增视频框架，相当于在列表末尾新增
        // 拖拽框架排序，相当于把原位置框架置于列表末尾
        if (index === frameworkList.length - 1) {
          acc.list.push({
            id: null,
            areaWidth: currentWidth,
            areaTranform: 'translateX(-100%)',
            areaLeft: frameworkRect.right - indicatorLeft + 'px',
            cursorLeft: 'initial',
          });
        }

        acc.prevWidth = currentWidth;

        return acc;
      },
      {
        list: [],
        // 上个框架碰撞区域的宽度
        //（每个框架有首尾两个碰撞区域，各占框架宽度 30%，总占框架宽度 60%）
        prevWidth: null,
      },
    ).list;
  }
```

## 游标尺

游标尺是视频剪辑软件中以时间标记刻度的标尺。我研究了类似的 Web 网页云剪辑应用，有两种实现方式：

1. 利用 Canvas 绘制刻度尺（Bilibili 云剪辑）
2. 利用 DOM 绘制刻度尺，采用类似虚拟列表的方式处理海量的 DOM 节点（腾讯云剪辑）

![ruler1](https://img.mrsingsing.com/ruler1.gif)

![ruler2](https://img.mrsingsing.com/ruler2.gif)

实现思路：

1. 创建 `<canvas>` 并根据当前设备 DPR 按比例缩放画布尺寸
2. 根据当前轨道区域所有分段视频时长，计算出总时长（不足两小时显示两小，大于两小时，按拼接长度增长），从而计算出游标尺中显示刻度的总数
3. 循环遍历依次对 Canvas 绘制指针进行移动，取模判断是整数刻度还是小数刻度，并绘制相对应的刻度线，直到所有数遍历完成
4. 最后根据比例尺计算整数刻度显示的时间文案

```ts
export class RecordVideoTimelineRulerComponent implements OnInit {
  /** 比例尺 */
  @Input()
  scaleRatio: number;
  /** 最大刻度数量 */
  @Input()
  maxScaleValue: number;
  /** 游标尺宽度 */
  public canvasWidth: number;
  /** 游标尺画布 DOM 元素引用 */
  public canvasElement: HTMLCanvasElement;
  /** 游标尺画布上下文引用 */
  public canvasContext: CanvasRenderingContext2D;

  ngOnInit(): void {
    this.initCanvas();
  }

  ngOnChanges(changes: { [propName: string]: SimpleChange }) {
    const scaleRatio = changes['scaleRatio'];

    if (
      scaleRatio &&
      (!scaleRatio.previousValue || scaleRatio.previousValue !== scaleRatio.currentValue)
    ) {
      this.drawCanvas();
    }
  }

  /**
   * 初始化刻度尺
   */
  initCanvas(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.canvasElement = canvas;

    const ctx = canvas.getContext('2d');
    this.canvasContext = ctx;

    const documentBodyWidth = document.body.clientWidth || document.documentElement.clientWidth;
    this.canvasWidth = documentBodyWidth;

    if (window.devicePixelRatio) {
      const devicePixelRatio = window.devicePixelRatio;

      canvas.width = devicePixelRatio * this.canvasWidth;
      canvas.height = devicePixelRatio * 26;

      // 按照比例缩放
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    this.drawCanvas();
  }

  /**
   * 绘制刻度尺
   */
  drawCanvas(): void {
    const scrollX = 0;
    const ctx = this.canvasContext;

    if (!ctx) return;

    const canvasWidth = this.canvasWidth;
    const canvasHeight = 26;

    // 水平方向偏移量
    const offsetX = (scrollX ? 30 - scrollX : 30) + 0.5;

    // 最大刻度值（当前显示的最大刻度值）
    const totalScaleValue = this.maxScaleValue;

    const startCount = Math.max(parseInt('' + Math.floor((scrollX - 30) / 16), 10), 0);
    const endCount = Math.min(
      parseInt('' + Math.ceil((scrollX + canvasWidth - 30) / 16), 10) - 1,
      totalScaleValue
    );

    // 每个刻度值的距离 分割线
    const division = 15;
    // 整数刻度高度
    const integerHeight = 14 || Math.floor(canvasHeight * 0.53);
    // 分度值刻度高度
    const divisionHeight = 8 || Math.floor(canvasHeight * 0.3);
    // 整数刻度下的文案高度
    const textHeight = 21 || Math.floor(canvasHeight * 0.78);
    // 每段整数刻度代表的秒数比例
    const scaleRatio = this.scaleRatio;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 当刻度值足够大的时候，只绘制可视范围内的刻度值
    // 画刻度线
    for (let i = startCount; i < endCount; i++) {
      ctx.beginPath();
      ctx.save();
      ctx.strokeStyle = '#595959';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';

      const moveTo = offsetX + i * (division + 1);
      ctx.moveTo(moveTo, 0);

      if (i % 5 === 0) {
        ctx.lineTo(offsetX + i * (division + 1), integerHeight);
      } else {
        ctx.lineTo(offsetX + i * (division + 1), divisionHeight);
      }

      ctx.stroke();
      ctx.restore();
      ctx.closePath();
    }

    // 整数刻度文案
    ctx.beginPath();
    ctx.font = '10px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const seperatedScaleValue = totalScaleValue / 5;
    for (let i = 0; i < seperatedScaleValue; i++) {
      const text = this.formatTimeScaleText(i, scaleRatio);
      ctx.fillText(text, offsetX + 80 * i, textHeight);
    }

    ctx.closePath();
  }

  /**
   * 根据正整数索引和比例尺格式化显示时间
   * @param index 刻度尺索引（从 0 开始）
   * @param ratio 每个整数刻度之间的时间长度（以秒为单位）
   * @description 将以秒为单位的数值转化为 HH:MM:SS.ss 格式的时间字符串
   */
  formatTimeScaleText(index: number, ratio: number): string {
    const totalSeconds = index * ratio;

    let hour: number | string = 0;
    let minute: number | string = 0;
    let second: number | string = 0;
    const millisecond = '00';

    hour = Math.floor(totalSeconds / 3600);
    minute = Math.floor((totalSeconds - hour * 3600) / 60);
    second = ratio >= 60 ? 0 : Math.floor(totalSeconds - hour * 3600 - minute * 60);

    hour = this.fixZero(hour);
    minute = this.fixZero(minute);
    second = this.fixZero(second);

    return `${hour}:${minute}:${second}.${millisecond}`;
  }

  /**
   * 补零函数（只支持个位数补零为十位数）
   */
  fixZero(value: any): string {
    return value * 1 < 10 ? `0${value}` : `${value}`;
  }
}
```

这里的比例尺虽然可以通过滑动进行设置，但是为了准确计算，我们只提供了几个固定的档位。

这里的比例尺代表的是游标尺中一个完整大刻度之间所代表的时间，并以秒作为统一度量衡：

1. 5 格 1 秒 1 格 0.2s=200ms
2. 5 格 1 分钟=60s 1 格 0.2min=12s=12000ms
3. 5 格 3 分钟=180s 1 格 0.6min=36s=36000ms
4. 5 格 6 分钟=360s 1 格 1.2min=62s=62000ms

## 拖拽指令

对于云剪辑 Web 应用，其与一般纯粹表单表格的应用，在于让用户把更多的操作从键盘转移到鼠标，而拖拽的实现方式，是此次需求中的重中之重。

我对产品和设计师提出的需求进行了梳理：

![drag-and-drop](https://img.mrsingsing.com/drag-and-drop.png)

最初，我考虑到使用原生的 drag & drop 方法实现拖拽，但是原生的 drag & drop 方法会影响到文档流其他元素的布局，导致浏览器回流，这显然不是一种优雅的解决方式。查阅相关资料后，发现能通过 mouse 相关方法模拟 drag & drop 的方法，那么如果利用 mouse 相关方法，通过某些判断条件判断为拖拽后，采用绝对布局创建块级格式上下文元素，独立于文档流进行位移，这样一来既能满足功能需求也能满足性能需求。

HTML 的拖拽 API 分别作用于被拖拽的元素和目标元素：

| 针对对象     | 事件名称  | 说明                                                  |
| :----------- | :-------- | :---------------------------------------------------- |
| 被拖动的元素 | dragstart | 在元素开始拖动时触发                                  |
|              | drag      | 在元素拖动时反复触发                                  |
|              | dragend   | 在拖动操作完成时触发                                  |
| 目的地对象   | dragenter | 当被拖动元素进入目的地元素所占据的屏幕空间时触发      |
|              | dragover  | 当被拖动元素在目的地元素内时触发（每 100ms 触发一次） |
|              | dragleave | 当被拖动元素没有放下就离开目的地元素时触发            |
|              | drop      | 释放被拖拽元素时触发                                  |

### 被拖拽元素

下面我们开始一步步使用 mouse 事件实现被拖拽元素的 drag 指令。

我们尝试拆解拖拽这个动作，从浏览器事件角度出发考虑，可以分为 `mousedown` 和 `mousemove` 两部分，当 `mousemove` 坐标与 `mousedown` 坐标之差的绝对值达到一定阈值后，可认为用户在进行拖拽行为，因此我们需要给这个为指令提供可供使用方自由设置的入参 `dragTolerance`（默认设为 5，可理解为拖拽位移了 5 像素单位后判定为拖拽）。

在 HTML 全局属性中，有个 draggable 的属性，当值为 true 时，表示元素可被拖动；当值为 false 时，则表示元素不可被拖动。我们的需求场景中，有同样类似的功能需要实现，举个例子，视频框架和锚点占位元素均为可拖拽的元素，而锚点占位元素是“镶嵌”再视频框架中的，如果将该指令分别设置在各自的元素上，那么当拖拽锚点占位元素时，也会触发视频框架的拖拽事件，这显然不是我们想要的结果。

仅仅由外部设置为布尔值似乎并不能解决我们的问题。所以，除了布尔值外， 我们允许 `draggable` 参数为函数类型。当 `mousedown` 时，会获取当前 `draggable` 的值，若 darggable 为可执行函数时，将携带数据和被拖拽原始 DOM 元素引用等作为参数执行该校验函数，函数内部处理判断可否拖拽逻辑，最终返回布尔值决定 `mousedown` 后续的处理。

这也是抽象公共组件和工具的技巧之一，既能实现将业务代码通过函数作为回调对组件工具逻辑进行影响，同时也减少对抽象组件工具侵入。

```ts
@Directive({
  selector: '[ssDraggable]',
})
export class SSDraggableDirective implements OnInit {
  constructor(public el: ElementRef, public zone: NgZone, public viewContainer: ViewContainerRef) {
    this.currentElement = el.nativeElement;
  }

  public ngOnInit(): void {
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
  }

  public ngAfterContentInit() {
    if (this.currentElement) {
      this.currentElement.onmousedown = this.onMouseDown.bind(this);
    }
  }

  /**
   * 能否拖拽
   */
  private get currentElementDraggable() {
    if (typeof this.draggable === 'function') {
      return this.draggable({
        // 被拖拽元素携带的数据
        data: this.data,
        // 被拖拽元素的原始 DOM 元素
        mousedownElement: this.mousedownElement,
      });
    }

    return this.draggable;
  }

  /**
   * 拖拽开始前鼠标按下事件
   */
  onMouseDown(e: MouseEvent): void {
    e.preventDefault();

    this.mousedownElement = e.target as HTMLElement;

    if (!this.currentElementDraggable) return;

    this.clicked = true;

    // 记录鼠标按下的横纵坐标
    this.startX = e.pageX;
    this.startY = e.pageY;

    document.defaultView?.addEventListener('mousemove', this.onMouseMove);
    document.defaultView?.addEventListener('mouseup', this.onMouseUp);
  }

  /**
   * 拖拽开始前鼠标按下事件
   */
  onMouseMove(e: MouseEvent): void {
    // do something
  }

  /**
   * 监听拖动结束
   */
  onMouseUp(e: MouseEvent): void {
    // do something
  }
}
```

当鼠标距离 mousedown 距离超出设定阈值后，需触发一次周期函数的 dragStart，表示开始拖拽。与此同时，基于模版创建用于拖拽的幽灵元素。

为了满足交互需求，这里有两种幽灵元素的实现方式：一种是 Angular 提供的模版语法，一种是 clone 原 DOM 元素。

基于模版生成的幽灵元素相对比较容易实现，只需要实用 ng-template 定义好 HTML 结构，将模版引用变量作为入参传入指令即可。指令内部根据模版引用变量创建 DOM 元素即可。

![drag-anchor](https://img.mrsingsing.com/drag-anchor.gif)

```xml
<!-- 拖拽移动锚点幽灵模版 -->
<ng-template #ssDraggableAnchorGhost>
  <div
    class="drag-anchor-ghost"
    [attr.data-type]="DragGhostElementType.ANCHOR"
  >
    <div class="ghost-cursor"></div>
    <div class="ghost-placeholder"></div>
  </div>
</ng-template>
```

另一种根据 DOM 元素创建副本的方式会稍微复杂，我们都知道 DOM 提供的方法中有一个 `Node.cloneNode()` 的方法，可用于克隆 DOM 节点，但是这个方法有个明显的缺陷，就是只能克隆 DOM 结构，CSS 样式无法克隆。

在研究了所有可行的方案后，并没有一个十分完美的解决方案，那么就只能走最笨拙的实现方式。原生 DOM 提供了获取元素经过布局、绘制、光栅化和合并后的样式属性方法 getComputedStyle。创建幽灵元素时，先克隆元素及其子孙节点，然后依次遍历每个节点，通过该方法获取节点的计算样式属性，然后再对样式属性逐一赋值到克隆节点上。

但是浏览器支持的 CSS 属性有几百个，如果每个都需要的话将会提升整个操作的复杂度。因为在这里的使用相关属性的元素的样式是比较固定的，所以只对部分样式属性进行了转移。如果是实现大型的公用包，则应该保证可用性。

![drag-video](https://img.mrsingsing.com/drag-video.gif)

```ts
export class SSDraggableDirective implements OnInit {
  /**
   * 根据当前元素克隆生成拖拽幽灵元素
   */
  cloneGhostElement(element: Element): Element {
    const clonedElement = element.cloneNode(true) as HTMLElement;

    const originalStyles: CSSStyleDeclaration = document.defaultView.getComputedStyle(element, '');

    for (const cssProperty of styleProperties) {
      clonedElement.style[cssProperty] = originalStyles[cssProperty];
    }

    clonedElement.style.pointerEvents = 'none';

    const originalElementChildren = element.getElementsByTagName('*') as HTMLCollectionOf<
      HTMLElement
    >;
    const clonedElementChildren = clonedElement.getElementsByTagName('*') as HTMLCollectionOf<
      HTMLElement
    >;

    for (let i = originalElementChildren.length - 1; i--; ) {
      const originalChild = originalElementChildren[i];
      const clonedChild = clonedElementChildren[i];
      const originElementStyles = document.defaultView.getComputedStyle(originalChild, '');

      for (const cssProperty of styleProperties) {
        clonedChild.style[cssProperty] = originElementStyles[cssProperty];
      }

      clonedChild.style.pointerEvents = 'none';
    }

    return clonedElement;
  }
}
```

开始拖拽并生成幽灵函数的代码实现：

```ts
interface SSDraggableBaseEventArgs {
  originalEvent: MouseEvent;
  ghostElement: Nullable<HTMLElement>;
  startX: number;
  startY: number;
  pageX: number;
  pageY: number;
  cancel: boolean;
}

export class SSDraggableDirective implements OnInit {
  /**
   * 鼠标移动事件
   */
  onMouseMove(e: MouseEvent) {
    const { pageX, pageY } = e;

    if (this.clicked) {
      const totalMovedX = pageX - this.startX;
      const totalMovedY = pageY - this.startY;

      if (
        !this.dragStarted &&
        (Math.abs(totalMovedX) > this.dragTolerance || Math.abs(totalMovedY) > this.dragTolerance)
      ) {
        const dragStartArgs: SSDraggableBaseEventArgs = {
          originalEvent: e,
          ghostElement: this.ghostElement,
          startX: this.startX,
          startY: this.startY,
          pageX,
          pageY,
          cancel: false,
        };

        this.zone.run(() => {
          this.dragStart.emit(dragStartArgs);
        });

        if (dragStartArgs.cancel) {
          this.destoryEventListener();

          return;
        }

        const clientRect = this.currentElement.getBoundingClientRect();

        this.baseX = clientRect.left;
        this.baseY = clientRect.top;

        this.dragStarted = true;

        // 当移动足够多距离时，幽灵元素才会渲染并被实际开始拖拽
        this.createGhostElement(pageX, pageY);
      } else if (!this.dragStarted) {
        return;
      }

      const dragMoveArgs: SSDraggableDragMoveArgs = {
        originalEvent: e,
        ghostElement: this.ghostElement,
        startX: this.startX,
        startY: this.startY,
        pageX: this.lastX,
        pageY: this.lastY,
        nextPageX: e.pageX,
        nextPageY: e.pageY,
        cancel: false,
      };

      this.dragMove.emit(dragMoveArgs);

      const setPageX = dragMoveArgs.nextPageX;
      const setPageY = dragMoveArgs.nextPageY;

      if (!dragMoveArgs.cancel) {
        this.ghostLeft = this.dragDirection === DragDirection.VERTICAL ? this.baseX : setPageX;
        this.ghostTop = this.dragDirection === DragDirection.HORIZONTAL ? this.baseY : setPageY;

        this.dispatchDragEvent(pageX, pageY, e);
      }

      this.lastX = setPageX;
      this.lastY = setPageY;
    }
  }

  /**
   * 根据模版生成拖拽幽灵元素
   */
  createGhostElement(pageX: number, pageY: number) {
    let dynamicGhostRef;
    //
    if (this.ghostTemplate) {
      dynamicGhostRef = this.viewContainer.createEmbeddedView(this.ghostTemplate, null);
      this.ghostElement = dynamicGhostRef.rootNodes[0];
    } else {
      const clonedElement = this.cloneGhostElement(this.currentElement);

      const ghostContainer = document.createElement('div');
      ghostContainer.appendChild(clonedElement);

      if (this.currentElement.dataset) {
        Object.entries(this.currentElement.dataset).forEach(([key, value]) => {
          ghostContainer.setAttribute(`data-${key}`, value);
        });
      }

      this.ghostElement = ghostContainer;
    }

    if (this.ghostElement) {
      const createEventArgs = {
        ghostElement: this.ghostElement,
        cancel: false,
      };

      this.ghostCreate.emit(createEventArgs);

      if (createEventArgs.cancel) {
        this.ghostElement = null;

        if (this.ghostTemplate && dynamicGhostRef) {
          dynamicGhostRef.destroy();
        }
        return;
      }

      this.ghostElement.style.position = 'absolute';
      this.ghostElement.style.pointerEvents = 'none';
      this.ghostElement.style.zIndex = this.ghostIndex;
      this.ghostElement.style.transform =
        this.dragDirection === DragDirection.BOTH ? 'translate3d(-50%, -50%, 0)' : null;
      // 垂直方向可拖拽，那么 left 固定
      this.ghostElement.style.left =
        this.dragDirection === DragDirection.VERTICAL ? this.baseX + 'px' : pageX + 'px';
      // 水平方向可拖拽，那么 right 固定
      this.ghostElement.style.top =
        this.dragDirection === DragDirection.HORIZONTAL ? this.baseY + 'px' : pageY + 'px';
      this.ghostElement.style.width = 'auto';
      this.ghostElement.style.height = 'auto';
      this.ghostElement.style.cursor = 'grabbing';

      document.body.appendChild(this.ghostElement);

      this.ghostElement.addEventListener('pointerup', args => {
        this.onMouseUp(args);
      });
    }
  }
}
```

当拖拽结束，也就是用户释放鼠标 mouseup 后，则除了需要将传达给 drop 目标区域外，还要移除时间的监听。

```ts
export class SSDrggableDirective implements OnInit {
  /**
   * 监听拖动结束
   */
  onMouseUp(e: MouseEvent) {
    if (!this.clicked) return;

    this.clicked = false;
    this.dragStarted = false;

    const dragEndArgs = {
      originalEvent: e,
      ghostElement: this.ghostElement,
      startX: this.startX,
      startY: this.startY,
      pageX: e.pageX,
      pageY: e.pageY,
      data: this.data,
      cancel: false,
    };

    this.zone.run(() => {
      this.dragEnd.emit(dragEndArgs);
    });

    this.dispatchDropEvent(e.pageX, e.pageY, e);

    if (this.ghostElement) {
      this.ghostElement.parentNode?.removeChild(this.ghostElement);
      this.ghostElement = null;
    }

    this.destoryEventListener();
  }
}
```

你也许会疑问在 mouse 实现 drag & drop 要如何实现将拖拽元素的信息通知给目的地元素，毕竟 drag & drop 能通过 dataTransfer 作为数据传输的载体，而且原生支持数据传递。

事实上，除了浏览器提供类似 click、mousedown、blur 等内置的标准事件外，浏览器还通过方法让开发者自己创建监听事件。

创建指定类型的事件示例：

```ts
// 创建事件
const event = documet.createEvent('Event');

// 定义事件名为 build
event.initEvent('build', true, true);

// 监听事件
event.addEventListener(
  'build',
  function(e) {
    // e.target
  },
  false
);

// 触发对象可以是任何元素或其他事件目标
elem.dispatchEvent(Event);
```

当元素被拖拽移动时，会实时通过 getElementsAtPoint 获取元素下方的坐标各层级的元素，当存在目的地标识的元素时，执行对应的周期函数，这样就能实现数据的通信了。

下面为实现 drag 和 drop 相关事件的代码：

- dispatchDragEvent：处理 dragEnter、dragLeave 事件
- dispatchDropEvent：处理 drop 事件
- dispatchEvent：底层封装

```ts
export class SSDraggableDirective implements OnInit {
  dispatchDragEvent(pageX: number, pageY: number, originalEvent: MouseEvent) {
    let dropArea;

    const customEventArgs: SSDraggableCustomEventDetail = {
      data: { ...this.data },
      originalEvent,
      ghostElement: this.ghostElement,
      startX: this.startX,
      startY: this.startY,
      pageX,
      pageY,
      cancel: false,
    };

    // 按照元素冒泡顺序排列的数组
    const elementsFromPoint = this.getElementsAtPoint(pageX, pageY);
    const dropAreaFlag = this.dropAreaFlag;

    for (const element of elementsFromPoint) {
      if (
        element.getAttribute(dropAreaFlag) === 'true' &&
        element !== this.ghostElement &&
        element !== this.currentElement
      ) {
        dropArea = element;
        break;
      }
    }

    if (dropArea && (!this.lastDropArea || (this.lastDropArea && this.lastDropArea !== dropArea))) {
      if (this.lastDropArea) {
        this.dispatchEvent(this.lastDropArea, 'ssDragLeave', customEventArgs);
      }

      this.lastDropArea = dropArea;
      this.dispatchEvent(dropArea, 'ssDragEnter', customEventArgs);
    } else if (!dropArea && this.lastDropArea) {
      this.dispatchEvent(this.lastDropArea, 'ssDragLeave', customEventArgs);
      this.lastDropArea = null;
      return;
    }

    if (dropArea) {
      this.dispatchEvent(dropArea, 'ssDragOver', customEventArgs);
    }
  }

  dispatchDropEvent(pageX: number, pageY: number, originalEvent: MouseEvent) {
    const customEventArgs = {
      ghostElement: this.ghostElement,
      originalEvent,
      startX: this.startX,
      startY: this.startY,
      pageX,
      pageY,
      data: this.data,
      cancel: false,
    };

    this.dispatchEvent(this.lastDropArea, 'ssDrop', customEventArgs);
  }

  dispatchEvent(
    target: Nullable<HTMLElement>,
    eventName: string,
    eventArgs: SSDraggableCustomEventDetail
  ) {
    if (target) {
      const customEvent = document.createEvent('CustomEvent');
      customEvent.initCustomEvent(eventName, false, false, eventArgs);
      target.dispatchEvent(customEvent);
    }
  }

  protected getElementsAtPoint(pageX: number, pageY: number) {
    const viewPortX = pageX - window.pageXOffset;
    const viewPortY = pageY - window.pageYOffset;

    if (document['msElementsFromPoint']) {
      const elements = document['msElementsFromPoint'](viewPortX, viewPortY);
      return elements === null ? [] : elements;
    } else {
      return document.elementsFromPoint(viewPortX, viewPortY);
    }
  }
}
```

如此这样，拖拽元素的 Angular 指令就这样实现了，诸如边界、标识属性等实现上述代码已经包含在内，下面总结封装一个 mouse 实现 drag 的指令工具需要考虑到的 API 和事件。

| API           | 说明                         | 类型                     |
| :------------ | :--------------------------- | :----------------------- |
| data          | 拖拽元素携带的数据           | any                      |
| draggable     | 能否被拖拽                   | boolean \| () => boolean |
| ghostTemplate | 被拖拽幽灵元素的模版引用变量 | `TemplateRef<any>`       |
| ghostIndex    | 幽灵元素的层级               | string                   |
| dragTolerance | 判断拖拽开始的阈值           | number                   |
| dragDirection | 边界                         | DragDirection            |
| dropAreaFlag  | 标识被拖动元素的自定义属性   | string                   |

> dropAreaFlag 是用于判断是否为能够 drop 区域的标识，使用 drop 指令的元素默认添加 data-\* 的自定义 attribute。

| 事件         | 说明               |
| :----------- | :----------------- |
| dragStart    | 拖拽开始时触发     |
| dragMove     | 拖拽元素移动时触发 |
| dragEnd      | 拖拽结束时触发     |
| ghostCreate  | 幽灵元素创建时触发 |
| ghostDestory | 幽灵元素销毁时触发 |

### 拖拽目的地元素

对于释放的 drop 指令来说，实现起来就比较简单了，只需要对 drag 指令定义的几个自定义事件进行监听并处理对应的回调事件即可。

```ts
@Directive({
  selector: '[ssDroppable]',
})
export class SSDroppableDirective implements OnInit {
  public currentElement: Nullable<HTMLElement> = null;

  @Input()
  public dropAreaFlag = 'ssdroppable';

  @Output()
  public dragEnter = new EventEmitter<CustomEvent>();

  @Output()
  public dragOver = new EventEmitter<CustomEvent>();

  @Output()
  public dragLeave = new EventEmitter<CustomEvent>();

  @Output()
  public drop = new EventEmitter<CustomEvent>();

  constructor(public el: ElementRef, public zone: NgZone) {
    this.currentElement = el.nativeElement;
  }

  public ngOnInit(): void {
    this.onDragEnter = this.onDragEnter.bind(this);
    this.onDragOver = this.onDragOver.bind(this);
    this.onDragLeave = this.onDragLeave.bind(this);
    this.onDrop = this.onDrop.bind(this);

    if (!this.currentElement) return;

    this.currentElement.setAttribute(this.dropAreaFlag, 'true');

    this.currentElement.addEventListener('ssDragEnter', this.onDragEnter as EventListener);
    this.currentElement.addEventListener('ssDragOver', this.onDragOver as EventListener);
    this.currentElement.addEventListener('ssDragLeave', this.onDragLeave as EventListener);
    this.currentElement.addEventListener('ssDrop', this.onDrop as EventListener);
  }

  /**
   * 被拖动元素进入当前元素所占据的屏幕空间时触发
   */
  public onDragEnter(e: CustomEvent): void {
    this.zone.run(() => {
      this.dragEnter.emit(e);
    });
  }

  /**
   * 被拖拽元素在当前元素上方时触发
   */
  public onDragOver(e: CustomEvent): void {
    this.zone.run(() => {
      this.dragOver.emit(e);
    });
  }

  /**
   * 被拖动元素没有放下就离开当前元素时触发
   */
  public onDragLeave(e: CustomEvent): void {
    this.zone.run(() => {
      this.dragLeave.emit(e);
    });
  }

  /**
   * 释放事件
   */
  public onDrop(e: CustomEvent): void {
    this.zone.run(() => {
      this.drop.emit(e);
    });
  }
}
```

## 缩略图指令

在视频剪辑软件中，轨道区域的视频片段都会显示对应时间的截图，方便用户定位指定画面所在的位置以进行进一步的操作，同样地我们也需要对视频片段的缩略图进行展示。

在大方向上我们有两种方式实现此类效果：

- 当用户开始上传视频但未完成时，对视频进行配齐操作，我们需要对视频文件根据比例截取图片并展示
- 当视频上传完成后，云服务生成视频截图雪碧图，用户刷新页面后，使用雪碧图进行展示

### 视频文件画布截图

与之前检测视频文件可用性时的实现逻辑类似，往文档中插入 video 标签，并进行 play 播放，利用 Canvas 画布绘制视频指定时间的画面，当时间更新后对画布内容使用 `toDataURL` 输出视频截图。

```ts
export class SSVideoPreviewDirective implements OnInit {
  @Input()
  public previewList;

  @Input()
  public blobUrl;

  /** 开始时间（单位：秒） */
  @Input()
  public beginTime: number;

  /** 当前视频素材截取片段持续时长（单位：秒） */
  @Input()
  public duration: number;

  /** 步长，每张截图相隔时间（单位：秒） */
  @Input()
  public scaleRatio: number;

  public ngOnInit(): void {
    if (this.imgList && this.imgList.length > 0) {
      this.renderVideoPreviewByImageList();
    } else if (this.blobUrl) {
      this.renderVideoPreviewByBlobUrl();
    }
  }

  // 每段视频数据都会保存可播放的 Blob Url
  public renderVideoPreviewByBlobUrl() {
    // 缩略图总数量
    const count = Math.ceil(this.duration / this.scaleRatio);
    const frag = document.createDocumentFragment();

    const durationList = [];
    for (let i = 0; i < count; i++) {
      // 第 i 张显示截图的时间
      const currentTime = this.beginTime + i * this.scaleRatio;

      durationList.push(currentTime);
    }

    const promise = this.videoPicture({ videoUrl: this.blobUrl, seconds: durationList });

    promise.then((imgList: string[]) => {
      imgList.forEach((base64: string) => {
        const div = document.createElement('div');

        div.style.display = 'inline-block';
        div.style.width = '80px';
        div.style.height = '44px';
        div.style.backgroundRepeat = 'no-repeat';
        div.style.backgroundImage = `url("${base64}")`;
        div.style.backgroundSize = 'contain';
        div.style.flexShrink = '0';

        frag.appendChild(div);
      });

      this.currentElement.innerHTML = '';
      this.currentElement.appendChild(frag);
    });
  }

  /**
   * 获取一段时间的视频截图
   *
   * @param videoData 视频数据
   * @param width 截图宽度（默认 80px）* 8 是为了让截出来的图片不模糊
   * @param height 截图高度（默认 44px）* 8 是为了让截出来的图片不模糊
   * @param seconds 截取视频的秒   [1,3,4,5,6]表示截取视频 1 3 4 5 6秒的图片
   */
  videoPicture({
    videoUrl,
    videoData,
    width = 80 * 8,
    height = 44 * 8,
    seconds,
  }: {
    videoUrl?: string;
    videoData?: File;
    width?: number;
    height?: number;
    seconds: number[];
  }) {
    // 创建一个视频元素
    const container = document.createElement('div');
    container.className = 'video-picture';
    container.style.position = 'absolute';
    // container.style.visibility = 'hidden';
    container.style.left = '-9999px';
    const video = document.createElement('video');
    video.width = width;
    video.height = height;
    video.src = videoUrl || window.URL.createObjectURL(videoData);
    container.appendChild(video);

    // 创建一个canvas
    const canvas = document.createElement('canvas');
    canvas.width = width; //视频原有尺寸
    canvas.height = height; //视频原有尺寸
    container.appendChild(canvas);

    // 截图
    return new Promise(resolve => {
      video.addEventListener('loadeddata', () => {
        video.currentTime = 1;
        video.play();
      });
      video.addEventListener('playing', async () => {
        video.pause();
        const captureVideoPromises = [];
        for (let i = 0; i < seconds.length; i++) {
          const captureVideoPromise = await this.captureVideoPromise(canvas, video, seconds[i]);
          captureVideoPromises.push(captureVideoPromise);
        }
        Promise.all(captureVideoPromises).then(allSrcs => {
          container.remove();
          allSrcs.sort((a, b) => a.beginTime - b.beginTime);
          const srcs = allSrcs.map(val => val.src);
          resolve(srcs);
        });
      });

      document.body.appendChild(container);
    });
  }

  /**
   * 视频截图
   * @param canvas
   * @param video
   * @param beginTime 截取图片的视频时间点
   */
  private captureVideoPromise(canvas, video, beginTime) {
    const videoWidth = video.width;
    const videoHeight = video.height;
    // 视频的当前画面渲染到画布上
    const ctx = canvas.getContext('2d');
    return new Promise(resolve => {
      const cutImg = () => {
        video.removeEventListener('timeupdate', cutImg);

        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ beginTime: beginTime, src: dataUrl });
      };
      video.addEventListener('timeupdate', cutImg);
      video.currentTime = beginTime;
    });
  }
}
```

### 雪碧图实现缩略图

实现思路：

1. 计算总共需要显示的截图数量
2. 循环创建 DOM 元素，并计算当前位置缩略图对应雪碧图中的位置信息，以 background 背景样式实现缩略图展示
3. 最后统一插入到文档中

这里的计算方法值得总结一下：

每个视频框架对应着一个视频素材，用户可以在视频框架上添加锚点，所以在视频框架内是以 视频-锚点-视频-锚点-视频 间隔存在的，锚点后视频的开始时间是上一段视频的结束时间。阿里云的雪碧图是每秒截取一张图片，也就是第 0 秒对应第一张截图，第 100 秒对应的是第二组

![sprite-preview](https://img.mrsingsing.com/sprite-preview.png)

> 结合代码说明：
>
> - duration 当前视频素材截取片段持续时长（单位：秒）
> - scaleRatio 游标尺的比例尺
> - beginTime 当前视频素材截取片段在当前视频素材的开始时间（单位：秒）
> - imgList 雪碧图数组集合

1. 通过当前视频素材的截取片段总持续时长和比例尺计算出总共需要显示的截图数量，不够显示一张完整缩略图则显示缩略图的部分，采用截取图片的策略
2. 当前视频素材的截取片段的第一张缩略图即为截取片段开始时间那一秒，例如一个位于锚点后的视频素材截取片段的开始时间是当前视频素材的第 120 秒，那么第一张就是 120 秒处的截图
3. 雪碧图每张为 10x10 的规则，第 0-99 秒为第一张雪碧图，第 100-199 秒为第二张雪碧图，只需当前时间（秒数）除以 100 并向下取整，就可获知当前缩略图在数组的哪张雪碧图中
4. 找到雪碧图，我们还需要确认在雪碧图中的方位，根据当前时间取模 100 的结果是否等于 0 可得知是否为雪碧图的第一张，否则向上取整取模 100 可知其所处位置
5. 将自然顺序转换为由 0 开始的索引顺序
6. 计算水平偏移值：索引个位数即代表所需缩略图左侧距离雪碧图所在行左侧共有多少张缩略图，可由 `(index % 10) * width` 计算水平偏移值
7. 计算垂直偏移值：索引十位数即代表所需缩略图顶端距离雪碧图所在列顶端共有多少张略略图，可由 `Math.floor(index / 10) * height` 计算垂直偏移值

```ts
export class SSVideoPreviewDirective implements OnInit {
  public renderVideoPreviewByImageList(): void {
    // 总共需要显示的截图张数
    const count = Math.ceil(this.duration / this.scaleRatio);
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const div = document.createElement('div');

      // 第 i 张显示截图的时间
      const currentTime = this.beginTime + i * this.scaleRatio;
      // 截图数组中第几组成员
      const groupIndex = Math.floor(currentTime / 100);
      // 100x100 里的第几张
      const remainder = parseInt(`${currentTime}`) % 100 === 0 ? 1 : Math.ceil(currentTime) % 100;
      //  对应在图片组中的索引
      const index = remainder === 0 ? 99 : remainder - 1;

      const url = this.imgList[groupIndex];
      const x = (index % 10) * 80;
      const y = Math.floor(index / 10) * 44;

      div.style.display = 'inline-block';
      div.style.width = '80px';
      div.style.height = '44px';
      div.style.backgroundRepeat = 'no-repeat';
      div.style.backgroundImage = `url("${url}")`;
      div.style.backgroundPosition = `-${x}px -${y}px`;
      div.style.backgroundSize = '800px 440px';
      div.style.flexShrink = '0';

      frag.appendChild(div);
    }

    this.currentElement.innerHTML = '';
    this.currentElement.appendChild(frag);
  }
}
```

在对这种缩略图的技术实现方案进行调研时，发现了另一种巧妙实现方式：

对当个 DOM 元素设定多个 background-image 和 background-position，指定 backgroud-size 为固定宽度，背景图的引用也是一张雪碧图，只需要对 background-image 和 background-position 进行计算操作即可。

但是这种实现方式有前提，就是雪碧图必须是 1xn 这种形式的，这是因为 background-image 设置多个值时，背景图片会依次从左向右排列，如果是 10x10 这样的规则，那么雪碧图的宽度会占满，就无法实现一个设置定义一张缩略图了。

![tencent-preview](https://img.mrsingsing.com/tencent-preview.png)

但是鉴于阿里云截图只能采用 10 x 10 的规格，所以我们最终仍旧采用已有的方案。
其他功能

以上罗列详细讲解了该系统部分核心功能的实现方案，但碍于篇幅实在太长，就不完全展示了，实现上都是大同小异。下面就简述其他部分功能实现的难点及解决思路。

## 其他功能

### 快捷菜单

也许你会疑问，不就一个右键菜单吗，有啥难的？

轨道工作区的快捷菜单实现的难度在于视频框架内嵌套了锚点这个内置的元素，该区域绑定了大量的鼠标相关事件 click、mousedown、mousemove、mouseup、contextmeu 等等，而交互上锚点的拖拽、右键菜单等都需要与外层的视频框架区分开来，所以在这个区域大绝大部分的元素都设置了 poiner-events: none 阻止事件冒泡。

这在交互层面又和点击空白区域取消选中、隐藏菜单等操作会形成冲突，这需要在 document 上绑定 click 事件，但是阻止冒泡又会无法到达 document。以及轨道工作区两个右键菜单之间的互斥关系的处理，都是较难处理的地方。

此处我也实现了一个右键点击的指令，在初始化指令时会先监听 document 的 click 事件，如果指令中缓存的菜单节点为空，或 click 事件对象的 path 属性（也就是事件冒泡的路径）包含菜单节点（也就是在菜单上方 click），则不进行隐藏菜单的操作，否则则需要隐藏。

![contextmenu](https://img.mrsingsing.com/contextmenu.gif)

### 游标进度条

当播放器开始播放时，交互上需要把轨道区看作是进度条，游标需要根据播放器播放的时间实时移动到游标尺对应的时间上。而且，当游标移动至工作区视口中线时，则需要定在中线位置，改为轨道区域向后滚动；当轨道区域尾部滚动至工作区右侧重合时，游标则需要再次移动，直至到视频播放结束。

实现上只需要将播放器的时间回调方法提供的 duration 时间参数，根据游标尺比例尺转化为轨道工作区定位游标需要移动到的偏移值，再通过 scrollTo 方法滚动到指定位置即可。需要注意的是处理好游标下个移动的位置与工作区视口中线距离之间的判断，这是区分游标移动还是工作区移动的关键。

## 总结

本文只着重描述了教育行业云剪辑项目的重点难点的解决方案，在项目开发过程对数据结构的定义、不同实体的增删改查、不同区域的事件通信及数据同步、锚点互动的配置、全局的视频上传悬浮球、实时草稿保存和合成前数据的校验等等，每个细分功能的实现都是一个个挑战。在开发评审阶段所有前端都感觉困难无比的工程，最终经过将近一个月的设计评审开发测试后，顺利上线运行，为多个科目数百个课程，数万课次的录播视频配齐提供高质高效率的服务。

通过这个迭代对 Web 端可视化配置类型系统有了更深层次的理解，特别是设计师提出的多样化的用户交互，不仅让我对效率类工具的产品设计和用户体验分析能力有了飞速的进步，同时能在需求实现的同时打破了层层技术壁垒。

本文详细讲述了核心轨道工作区的技术实现方案，下篇将讲述基于阿里云播放器的二次封装的逻辑实现。
