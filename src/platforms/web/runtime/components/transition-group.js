/* @flow */

// Provides transition support for list items.
// supports move transitions using the FLIP technique.
 
/*
   FLIP 代表 First、Last、Invert、Play

   F: first，参加过渡元素的初始状态。
   L: last，元素的终止状态。
   I: invert，这是 flip 的核心。你通过这个元素的初始状态和终止状态计算出元素改变了什么，比如它的宽、高及透明度，然后你翻转这个改变；举个例子，如果一个元素的初始状态和终止状态之间偏移 90px，你应该设置这个元素 transform: translateY(-90px)。这个元素好像是在它的初始位置，其实正好相反。
   P: play，为你要改变的任何 css 属性启用 tansition，移除你 invert 的改变。这时你的元素会做动画从起始点到终止点。

   FLIP 来实现动画，是对 JavaScript 和 CSS 的很好结合。用 JavaScript 计算，但让 CSS 为你处理动画。
   你不必使用 CSS 去完成动画，不过，你可以用 animations API 或 JavaScript 自身来完成，觉得哪种容易就用哪种。
   关键要减少每帧动画的复杂性（推荐使用 transform 和 opacity），尽力让用户得到最好的体验。 
   
   其中：
   ① transform 指的是变换，一个东西的拉伸，压缩，旋转，偏移等就是使用这个属性。
      
      transform 可以设置这些函数：

      rotate：将元素进行 2D 旋转，单位为 deg。如 transform:rotate(7deg);
      rotateX(angle)：定义沿着 X 轴的 3D 旋转。如 transform:rotateX(10deg);
      rotateY(angle)：定义沿着 Y 轴的 3D 旋转。如 transform:rotateY(10deg);

      translate：将元素进行平移（X，Y 轴同时平移）。如 transform:translate(10px,20px);
      translateX(x)：X 轴平移。如 transform:translateX(10px); 
      translateY(y)：Y 轴平移。如 transform:translateY(10px);

      scale：将元素进行放大或缩小（X，Y 轴同时缩放）。记住，这里的放大和缩小不一定是维持比例的。如 transform:scale(1.1,1.1);
      scaleX(x)：通过设置 X 轴的值来定义缩放转换。如 transform:scaleX(1.1);
      scaleY(y)：通过设置 Y 轴的值来定义缩放转换。如 transform:scaleY(1.1);

      skew(x-angle,y-angle) 定义沿着 X 和 Y 轴的 2D 倾斜转换。如 transform:skew(10deg,10deg);
      skewX(angle)：定义沿着 X 轴的 2D 倾斜转换。如 transform:skewX(10deg);
      skewY(angle)：定义沿着 Y 轴的 2D 倾斜转换。如 transform:skewY(10deg);
        
   ② opacity 指透明度，可以利用这个属性来实现元素的隐藏与显现。

    另外，不要把 transform 和 transition 属性弄混淆了。
    
    应用于宽度属性的过渡效果，时长为 2 秒
    div {
        transition: width 2s; 
    }

    如需向多个样式添加过渡效果，请添加多个属性，由逗号隔开：
    div {
        transition: width 2s, height 2s, transform 2s;
    }

    举个利用 FLIP 的实例：
    参考：
    https://segmentfault.com/a/1190000008907850
    http://web.jobbole.com/83598/

    <div id="app"></div>
    <style>
      #app{
        position: absolute;
        width:20px;
        height:20px;
        background: red;
      }
      .app-to-end{
        top: 100px;
      }
      .animate-on-transforms{
        transition: all 5s;
      }
    </style>
    <script>
        var app = document.getElementById('app');

        var first = app.getBoundingClientRect();
        
        // 从 0px 处突变到 100px 处
        app.classList.add('app-to-end');
        var last = app.getBoundingClientRect();

        var invert = first.top - last.top;

        // 从终点（100px）突变到起点（0px 处），使元素看起来好像在起点
        app.style.transform = `translateY(${invert}px)`;

        requestAnimationFrame(function() {
          // 启用 tansition 属性（设置属性的变化时长，曲线等）
          app.classList.add('animate-on-transforms');
          // 从 0px 处突变到 100px 处，但由于有了 tansition 限制属性变化时长，所以会连续缓慢变化
          app.style.transform = '';
        });

        // 动画结束，移除 tansition 属性。其实，不移除也不会影响动画执行。
        app.addEventListener('transitionend', () => {
          app.classList.remove('animate-on-transforms');
        })
    </script>

    可以看到，FLIP 的思路是：
    将动画翻转过来，而不是直接过渡（因为这需要对每帧进行昂贵的计算）。通过动态预计算动画，可以让它更轻松地完成。

    使用flip的好处：
    参考图：https://sfault-image.b0.upaiyun.com/222/397/2223977382-58de14ea163ac_articlex

    在用户与网站交互后有 100ms 的空闲时间，如果我们利用这 100ms 做预计算操作，
    然后使用 css3 的 transform 和 opacity 执行动画，用户会觉得你的网站响应非常快。
*/


// Because the vdom's children update algorithm is "unstable" - i.e.
// it doesn't guarantee the relative positioning of removed elements,
// we force transition-group to update its children into two passes:
// in the first pass, we remove all nodes that need to be removed,
// triggering their leaving transition; in the second pass, we insert/move
// into the final desired state. This way in the second pass removed
// nodes will remain where they should be.

/*
   虚拟 dom 的子元素更新算法是不稳定的，也就是说它不能保证被删除元素的相对顺序。
   这里将 transition-group 更新子元素的过程分成两步：
   ① 移除所有需要移除的元素，并触发它们的离开 transition；
   ② 依次节点添加/删除元素，使得它们出现在正确的位置。
   这样下来，被删除的元素就能出现在正确的位置上。
*/

import { warn, extend } from 'core/util/index'
import { addClass, removeClass } from '../class-util'
import { transitionProps, extractTransitionData } from './transition'

import {
  hasTransition,
  getTransitionInfo,
  transitionEndEvent,
  addTransitionClass,
  removeTransitionClass
} from '../transition-util'

// TransitionGroup 组件的 props 基本继承自 transitionProps
const props = extend({
  tag: String,
  moveClass: String
}, transitionProps)

// 不要过渡模式
delete props.mode

export default {
  props,

  render (h: Function) {
    // 默认为一个 <span> 标签，你也可以通过 tag 特性更换为其他元素
    const tag: string = this.tag || this.$vnode.data.tag || 'span'
    const map: Object = Object.create(null)
    const prevChildren: Array<VNode> = this.prevChildren = this.children
    const rawChildren: Array<VNode> = this.$slots.default || []
    const children: Array<VNode> = this.children = []

    // extractTransitionData() 方法用于提取 props 和 listeners，返回一个 json 对象
    const transitionData: Object = extractTransitionData(this)

    // 遍历所有子元素
    for (let i = 0; i < rawChildren.length; i++) {
      const c: VNode = rawChildren[i]
      if (c.tag) {
        // ① c.key 存在并且不是以 __vlist 开头
        if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
          children.push(c)
          map[c.key] = c;
          (c.data || (c.data = {})).transition = transitionData
        // ② 报错：<transition-group> 的子元素必须有 key 属性
        } else if (process.env.NODE_ENV !== 'production') {
          const opts: ?VNodeComponentOptions = c.componentOptions
          const name: string = opts ? (opts.Ctor.options.name || opts.tag || '') : c.tag
          warn(`<transition-group> children must be keyed: <${name}>`)
        }
      }
    }

    if (prevChildren) {
      const kept: Array<VNode> = []
      const removed: Array<VNode> = []
      for (let i = 0; i < prevChildren.length; i++) {
        const c: VNode = prevChildren[i]
        c.data.transition = transitionData
        /*
            getBoundingClientRect 方法返回元素的大小及其相对于视口的位置

            eg:
            div = $('div')[0];
            div.getBoundingClientRect()
            -> { top: 287.625, right: 308, bottom: 387.625, left: 8 ,height: 100, width: 300 }
        */
        c.data.pos = c.elm.getBoundingClientRect()
        // ① 有 key 的保留
        if (map[c.key]) {
          kept.push(c)
        // ② 没 key 的删除
        } else {
          removed.push(c)
        }
      }
      // 渲染成 dom 元素
      this.kept = h(tag, null, kept)
      this.removed = removed
    }

    return h(tag, null, children)
  },

  beforeUpdate () {
    // __patch__ 即函数 patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) 
    this.__patch__(
      this._vnode,
      this.kept,
      false, // hydrating
      true // removeOnly (!important, avoids unnecessary moves)
    )
    this._vnode = this.kept
  },

  updated () {
    const children: Array<VNode> = this.prevChildren
    const moveClass: string = this.moveClass || ((this.name || 'v') + '-move')
    if (!children.length || !this.hasMove(children[0].elm, moveClass)) {
      return
    }

    // we divide the work into three loops to avoid mixing DOM reads and writes
    // in each iteration - which helps prevent layout thrashing.
    // ① 执行 _moveCb()、_enterCb() 回调
    children.forEach(callPendingCbs)
    // ② 记录每个 child 的终点位置
    children.forEach(recordPosition)
    // ③ 对每个 child 依次水平/竖直偏移（由 transform:translate(x px,y px) 来实现）
    children.forEach(applyTranslation)

    // force reflow to put everything in position
    const body: any = document.body
    /*
      clientHeight：内容高度 + padding 高度
      offsetHeight：内容高度 + padding 高度 + 边框宽度 
    */
    const f: number = body.offsetHeight // eslint-disable-line

    children.forEach((c: VNode) => {
      // 当前 c 执行过 applyTranslation 方法，c.data.moved 就为 true，表示偏移过
      if (c.data.moved) {
        var el: any = c.elm
        var s: any = el.style

        /* 这里对应 FLIP 中的 P:play */
        // 添加 moveClass 这个过渡 class
        addTransitionClass(el, moveClass)
        // transform 重置为 ''，会触发过渡动画，以使得元素移回到默认位置
        s.transform = s.WebkitTransform = s.transitionDuration = ''

        // transitionEndEvent = 'transitionend'，监听 transitionend 事件（过渡结束事件）
        el.addEventListener(transitionEndEvent, el._moveCb = function cb (e) {
          // 删除 class，解除绑定
          if (!e || /transform$/.test(e.propertyName)) {
            el.removeEventListener(transitionEndEvent, cb)
            el._moveCb = null
            removeTransitionClass(el, moveClass)
          }
        })
      }
    })
  },

  methods: {
    // 返回一个布尔值，表示该 el 元素是否有 move 效果
    hasMove (el: any, moveClass: string): boolean {
      // hasTransition = inBrowser && !isIE9，如果当前环境不支持 transition，直接返回 false
      if (!hasTransition) {
        return false
      }

      // 已经缓存过 this._hasMove，直接取缓存
      if (this._hasMove) {
        return this._hasMove
      }
      // Detect whether an element with the move class applied has
      // CSS transitions. Since the element may be inside an entering
      // transition at this very moment, we make a clone of it and remove
      // all other transition classes applied to ensure only the move class
      // is applied.
      const clone: HTMLElement = el.cloneNode()
      /*
        检测应用 move class 的元素是否拥有 css transitions.

        由于这个元素此刻可能在某个 entering transition 内部，所以这里就把它克隆一份，
        并且移除所有其他的 transition classes，以确保只有 move class 在应用
      */
      if (el._transitionClasses) {
        el._transitionClasses.forEach((cls: string) => { removeClass(clone, cls) })
      }
      addClass(clone, moveClass)
      clone.style.display = 'none'

      this.$el.appendChild(clone)
      const info: Object = getTransitionInfo(clone)
      this.$el.removeChild(clone)

      // transform 属性是否过渡
      return (this._hasMove = info.hasTransform)
    }
  }
}

// 执行回调
function callPendingCbs (c: VNode) {
  if (c.elm._moveCb) {
    c.elm._moveCb()
  }
  if (c.elm._enterCb) {
    c.elm._enterCb()
  }
}

/*
    getBoundingClientRect 方法返回元素的大小及其相对于视口的位置

    eg:
    div = $('div')[0];
    div.getBoundingClientRect()
    -> { top: 287.625, right: 308, bottom: 387.625, left: 8 ,height: 100, width: 300 }
*/
// 记录位置
function recordPosition (c: VNode) {
  c.data.newPos = c.elm.getBoundingClientRect()
}

// 执行水平/竖直偏移运动
function applyTranslation (c: VNode) {
  const oldPos = c.data.pos
  const newPos = c.data.newPos
  // 水平偏移
  const dx = oldPos.left - newPos.left
  // 竖直偏移
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    // 标志偏移过
    c.data.moved = true
    const s = c.elm.style

    /* 这里对应 FLIP 中的 I:invert */
    // 设置 transform 属性，执行偏移
    s.transform = s.WebkitTransform = `translate(${dx}px,${dy}px)`
    s.transitionDuration = '0s'
  }
}
