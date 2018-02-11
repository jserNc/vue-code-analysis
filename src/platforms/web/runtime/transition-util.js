/* @flow */

import { inBrowser, isIE9 } from 'core/util/index'
import { addClass, removeClass } from './class-util'
import { remove, extend, cached } from 'shared/util'

// 返回 6 个 class 组成的 json 对象
export function resolveTransition (def?: string | Object): ?Object {
  // ① 不存在 def，返回 undefined
  if (!def) {
    return
  }
  /*
      ② def 是对象类型，也就是动态属性用一个对象来描述，如：
      <div v-bind="{ id: someProp, 'other-attr': otherProp }"></div>

      所以：
      def.css 指的是 v-bind:css
      def.name 指的是 v-bind:name
   */
  if (typeof def === 'object') {
    const res = {}
    /*
        推荐对于仅使用 JavaScript 过渡的元素添加 v-bind:css="false"，Vue 会跳过 CSS 的检测。
        这也可以避免过渡过程中 CSS 的影响。
     */
    if (def.css !== false) {
      extend(res, autoCssTransition(def.name || 'v'))
    }
    extend(res, def)
    return res
  // ③ def 是字符串，实参是元素的 name
  } else if (typeof def === 'string') {
    return autoCssTransition(def)
  }
}

/*
    在进入/离开的过渡中，会有 6 个 class 切换。

    1. v-enter：定义进入过渡的开始状态。在元素被插入时生效，在下一个帧移除。
    2. v-enter-active：定义过渡的状态。在元素整个过渡过程中作用，在元素被插入时生效，在 transition/animation 完成之后移除。这个类可以被用来定义过渡的过程时间，延迟和曲线函数。
    3. v-enter-to:（2.1.8版及以上）定义进入过渡的结束状态。在元素被插入一帧后生效 (与此同时 v-enter 被删除)，在 transition/animation 完成之后移除。
    4. v-leave: 定义离开过渡的开始状态。在离开过渡被触发时生效，在下一个帧移除。
    5. v-leave-active：定义过渡的状态。在元素整个过渡过程中作用，在离开过渡被触发后立即生效，在 transition/animation 完成之后移除。这个类可以被用来定义过渡的过程时间，延迟和曲线函数。
    6. v-leave-to:（2.1.8版及以上）定义离开过渡的结束状态。在离开过渡被触发一帧后生效 (与此同时 v-leave 被删除)，在 transition/animation 完成之后移除。
 */
const autoCssTransition: (name: string) => Object = cached(name => {
  return {
    enterClass: `${name}-enter`,
    enterToClass: `${name}-enter-to`,
    enterActiveClass: `${name}-enter-active`,
    leaveClass: `${name}-leave`,
    leaveToClass: `${name}-leave-to`,
    leaveActiveClass: `${name}-leave-active`
  }
})

export const hasTransition = inBrowser && !isIE9
const TRANSITION = 'transition'
const ANIMATION = 'animation'

// 过渡 property/event 嗅探
export let transitionProp = 'transition'
export let transitionEndEvent = 'transitionend'
export let animationProp = 'animation'
export let animationEndEvent = 'animationend'

// 浏览器环境，并且非 ie9
if (hasTransition) {
  // ① 修正过渡 property/event
  if (window.ontransitionend === undefined &&
    window.onwebkittransitionend !== undefined
  ) {
    transitionProp = 'WebkitTransition'
    transitionEndEvent = 'webkitTransitionEnd'
  }
  // ② 修正过渡 property/event
  if (window.onanimationend === undefined &&
    window.onwebkitanimationend !== undefined
  ) {
    animationProp = 'WebkitAnimation'
    animationEndEvent = 'webkitAnimationEnd'
  }
}

/*
看一下 window.requestAnimationFrame 方法的基本用法：

例1，小红块自下向上运动 5 秒：
<div id="app"></div>
<style>
    #app{
        position: absolute;
        width:20px;
        height:20px;
        background: red;
    }

    .animate-on-transforms{
        transition: all 5s;
    }
</style>
<script>
    // 写法一：
    var app = document.getElementById('app');
    app.style.transform = `translateY(30px)`;

    var timer = requestAnimationFrame(function() {
        app.classList.add('animate-on-transforms');
        app.style.transform = '';
        console.log('执行动画');
    });

    // 写法二：
    var app = document.querySelector('#app');
    app.style.top = '30px';

    var timer = requestAnimationFrame(function(){
        app.classList.add('cls');
        app.style.top = '0';
        console.log('执行动画');
    });
</script>

以上几句简单的代码就可以实现一个小红块从下到上移动 30px 的动画。

注意，这里的 requestAnimationFrame 函数执行 1 次，callback 函数也是执行 1 次，就可以让动画动起来。

1. 问题来了，这里动画产生的原因是什么？其实就是 css3 过渡动画。
transition 必须规定两项内容： 
① 您希望把效果添加到哪个 css 属性上（all 代表所有属性）
② 动画效果的时长（如果时长未规定，则不会有过渡效果，默认值是 0）

【重要】：动画效果开始于指定的 css 属性改变时。
上面的例子中就是 transform 和 top 属性改变，导致动画效果开始。

2. window.requestAnimationFrame(callback); 
① requestAnimationFrame 的用法与 setTimeout 很相似，只是不需要设置时间间隔而已。
② window.requestAnimationFrame() 方法告诉浏览器您希望执行动画并请求浏览器在下一次重绘之前调用指定的函数来更新动画。
该方法使用一个回调函数作为参数，这个回调函数会在浏览器重绘之前调用。
③ 若您想要在下次重绘时产生另一个动画画面，您的回调函数必须调用 requestAnimationFrame()。
④ 当你准备好更新屏幕画面时你就应用此方法。这会要求你的动画函数在浏览器下次重绘前执行。
回调的次数常是每秒60次，但大多数浏览器通常匹配 W3C 所建议的刷新率。
⑤ callback 即每次需要重新绘制动画时调用的函数。
这个回调函数有一个传参，DOMHighResTimeStamp，指示从触发 requestAnimationFrame 回调到现在（重新渲染页面内容之前）的时间（从 performance.now() 取得）。


上面动画产生的流程为：
① 首先给 app 添加了一个 transform 属性： translateY(30px)，那么 app 会突变到相对原位置向下 30px 的位置；
② 然后，执行 requestAnimationFrame 方法，会调用 callback 方法；
③ 在 callback 方法中，将 app 的 transform 属性置空，那么意味着 app 会移动回到它最开始的位置，即 top 属性由 30px 变为 0;
④ 除此之外，callback 方法中还给 app 添加了一个新的 class: animate-on-transforms，这个属性 class 限定所有的属性变化时长为 5s;
⑤ 于是，我们就可以看到一个时长 5s 的动画了


对于 window.requestAnimationFrame(callback) 我是这么理解的：
【重要】callback 函数只执行 1 次（可以用 console.log 打印信息来验证）
① 若 callback 函数触发了动画，例如上面的 transition 动画，那就只需执行一次 requestAnimationFrame 方法
② 若 callback 只是普通的函数，那就需要递归调用来模拟动画效果。

再看一个例子，以便更好地理解：

例2，小红块自左向右运动 2 秒 ：
<div id="app"></div>
<style>
    #app{
        position: absolute;
        width:20px;
        height:20px;
        background: red;
    }

    .animate-on-transforms{
        transition: all 5s;
    }
</style>
<script>
var start = null;
var element = document.getElementById('app');
element.style.position = 'absolute';

function step(timestamp) {
  if (!start) start = timestamp;
  var progress = timestamp - start;
  element.style.left = Math.min(progress / 10, 200) + 'px';
  if (progress < 2000) {
    window.requestAnimationFrame(step);
  }
}

window.requestAnimationFrame(step);
</script>

这个例子中涉及到多次递归调用 requestAnimationFrame 方法，好像比例子 1 更复杂一些。为什么需要多次调用呢？

这就很像 setTimeout 函数的用法了。 
① 首先执行 window.requestAnimationFrame(step) 方法，会执行 1 次 step 方法；
② step 方法使得 element 位置突变到 Math.min(progress / 10, 200) + 'px'，如果不再调用 requestAnimationFrame 方法，就会停止在这个位置；
③ 于是，在 step 方法里又调用 requestAnimationFrame 方法，requestAnimationFrame 方法又调用 step 方法来突变位置；
④ 由于位置突变频率很高，所以看起来就是一个连贯的动画了；
⑤ 2 秒后，step 方法不再调用 requestAnimationFrame 方法，动画终止。

回调函数 step 有一个传参 timestamp，它表示 step 回调函数第一次执行到现在的时间（单位毫秒）。
 */
// binding to window is necessary to make hot reload work in IE in strict mode
const raf = inBrowser && window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : setTimeout

// raf 是 requestAnimationFrame 的简称
export function nextFrame (fn: Function) {
  raf(() => {
    raf(fn)
  })
}

// 添加过渡 class
export function addTransitionClass (el: any, cls: string) {
  const transitionClasses = el._transitionClasses || (el._transitionClasses = [])
  /*
      ① 将 cls 加入数组 el._transitionClasses 中
      ② 将 cls 应用加入到元素 class 属性中（样式生效）
   */
  if (transitionClasses.indexOf(cls) < 0) {
    transitionClasses.push(cls)
    addClass(el, cls)
  }
}

// 删除过渡 class
export function removeTransitionClass (el: any, cls: string) {
  // ① 从数组 el._transitionClasse 中删除 cls
  if (el._transitionClasses) {
    remove(el._transitionClasses, cls)
  }
  // ② 将 cls 从元素 class 属性中移除（样式失效）
  removeClass(el, cls)
}

// 过渡/动画结束执行回调函数 cb
export function whenTransitionEnds (
  el: Element,
  expectedType: ?string,
  cb: Function
) {
  /*
      {
        type,         // 类型，值为 'transition' | 'animation' | null
        timeout,      // 延迟+持续时间，值为数值，单位为毫秒
        propCount,    // 'transition'/'animation' 属性个数
        hasTransform  // transform 属性是否过渡
      }
   */
  const { type, timeout, propCount } = getTransitionInfo(el, expectedType)
  // 1. 不是过渡/动画（或者 timeout 不是大于 0），直接执行回调函数
  if (!type) return cb()
  
  // 2. 过渡/动画，继续往下走
  /*
      transitionEndEvent = 'transitionend'（特殊情况会修正为：transitionEndEvent = 'webkitTransitionEnd'）
      animationEndEvent = 'animationend'（特殊情况会修正为：animationEndEvent = 'webkitAnimationEnd'）
   */
  const event: string = type === TRANSITION ? transitionEndEvent : animationEndEvent
  

  let ended = 0
  // 解除事件监听，并执行回调函数
  const end = () => {
    el.removeEventListener(event, onEnd)
    cb()
  }

  /*
      transition/animation 属性可以添加多个属性，每个属性过渡/动画完毕都会触发 transitionend/animationend 事件
      每次事件发生的时候 ended++，一旦 ended 大于等于 propCount，说明整个过渡/动画结束
   */
  const onEnd = e => {
    if (e.target === el) {
      if (++ended >= propCount) {
        end()
      }
    }
  }

  // 若最大时间过后，ended 还是小于 propCount，那就强制结束
  setTimeout(() => {
    if (ended < propCount) {
      end()
    }
  }, timeout + 1)

  // 监听过渡/动画结束事件（每一个属性执行完毕都会触发，所以可能触发多次）
  el.addEventListener(event, onEnd)
}

const transformRE = /\b(transform|all)(,|$)/

/*
    获取过渡/动画相关信息：
    {
      type,         // 类型，值为 'transition' | 'animation' | null
      timeout,      // 延迟+持续时间，值为数值，单位为毫秒
      propCount,    // 'transition'/'animation' 属性个数
      hasTransform  // transform 属性是否过渡
    }
 */ 
export function getTransitionInfo (el: Element, expectedType?: ?string): {
  type: ?string;
  propCount: number;
  timeout: number;
  hasTransform: boolean;
} {
  // getComputedStyle 方法获取的是最终应用在元素上的所有 CSS 属性
  const styles: any = window.getComputedStyle(el)
  /*
      transitionProp = 'transition'（特殊情况下修正为 transitionProp = 'WebkitTransition'）
      
      CSS 的 transition-delay 属性规定了在过渡效果开始作用之前需要等待的时间，值以秒（s）或毫秒（ms）为单位
      你可以指定多个延迟时间，每个延迟将会分别作用于你所指定的相对应的 css 属性，例如：
      transition-delay: 3s;
      transition-delay: 2s, 4ms;

      transition-duration 属性以秒或毫秒为单位指定过渡动画所需的时间
      可以指定多个时长，每个时长会被应用到由 transition-property 指定的对应属性上。如果指定的时长个数小于属性个数，那么时长列表会重复。如果时长列表更长，那么该列表会被裁减。例如：
      transition-duration: 6s;
      transition-duration: 10s, 30s, 230ms;

      注意：transition-delay 指定的延迟时长个数可以小于属性个数，而 transition-duration 会自动补全至属性个数。
      所以，在 getTimeout(delays,durations) 函数中才需要手动处理：若数组 delays 的长度小于 durations，那就一直复制自身，直至超过
   
      transitionTimeout 获得 [过渡延迟时间] + [过渡持续时间] 的最大值
   */
  const transitionDelays: Array<string> = styles[transitionProp + 'Delay'].split(', ')
  const transitionDurations: Array<string> = styles[transitionProp + 'Duration'].split(', ')
  const transitionTimeout: number = getTimeout(transitionDelays, transitionDurations)
  
  /*
      animationProp = 'animation'（特殊情况下修正为 animationProp = 'WebkitAnimation'）
      
      animation-delay 属性定义动画于何时开始，即从动画应用在元素上到动画开始的这段时间的长度。例如：
      animation-delay: 3s;
      animation-delay: 2s, 4ms;

      animation-duration 属性指定一个动画周期的时长，例如：
      animation-duration: 6s;
      animation-duration: 10s, 30s, 230ms;

      animationTimeout 获得 [动画延迟时间] + [动画持续时间] 的最大值
   */
  const animationDelays: Array<string> = styles[animationProp + 'Delay'].split(', ')
  const animationDurations: Array<string> = styles[animationProp + 'Duration'].split(', ')
  const animationTimeout: number = getTimeout(animationDelays, animationDurations)

  let type: ?string
  let timeout = 0
  let propCount = 0

  // ① 过渡 TRANSITION = 'transition'
  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION
      timeout = transitionTimeout
      // transitionDurations 的长度会自动等于属性个数，正好利用这点
      propCount = transitionDurations.length
    }
  // ② 动画 ANIMATION = 'animation'
  } else if (expectedType === ANIMATION) {
    if (animationTimeout > 0) {
      type = ANIMATION
      timeout = animationTimeout
      propCount = animationDurations.length
    }
  // ③ 同时使用过渡和动画
  } else {
    // 取时间较大者
    timeout = Math.max(transitionTimeout, animationTimeout)

    // 时间长度决定 type
    type = timeout > 0
      ? transitionTimeout > animationTimeout
        ? TRANSITION
        : ANIMATION
      : null

    // 同样，propCount 也取决于时间
    propCount = type
      ? type === TRANSITION
        ? transitionDurations.length
        : animationDurations.length
      : 0
  }

  /*
      transformRE = /\b(transform|all)(,|$)/

      transition-property 属性规定应用过渡效果的 CSS 属性的名称。（当指定的 CSS 属性改变时，过渡效果将开始
      transition-property: none|all|property;
      none: 没有属性会获得过渡效果
      all: 所有属性都将获得过渡效果
      property: 定义应用过渡效果的 CSS 属性名称列表，列表以逗号分隔（例如属性名为 transform）

      当 transform 属性可以应用过渡（transition）时，hasTransform 为 true
   */
  const hasTransform: boolean =
    type === TRANSITION &&
    transformRE.test(styles[transitionProp + 'Property'])

  return {
    type,         // 类型，值为 'transition' | 'animation' | null
    timeout,      // 延迟+持续时间，值为数值，单位为毫秒
    propCount,    // 'transition'/'animation' 属性个数
    hasTransform  // transform 属性是否过渡
  }
}

/*
    取出 [延迟时间] + [持续时间] 的最大值，例如：
    var delays = ['10s','5s','6s'];
    var durations = ['3s','2s','8s','7s','11s','5s','1s'];
    getTimeout(delays,durations)
    -> 17000

    大致过程如下：
    ① delays 长度小于 durations，所以 delays 变为：
    delays = ["10s", "5s", "6s", "10s", "5s", "6s", "10s", "5s", "6s", "10s", "5s", "6s"]
    ② 然后，遍历 durations（delays 每一项和 durations 每一项相加），返回最长的时间
 */
function getTimeout (delays: Array<string>, durations: Array<string>): number {
  // 若数组 delays 的长度小于 durations，那就一直复制自身，直至超过
  while (delays.length < durations.length) {
    delays = delays.concat(delays)
  }

  // 返回最长的时间
  return Math.max.apply(null, durations.map((d, i) => {
    return toMs(d) + toMs(delays[i])
  }))
}

// 如 toMs('123s') -> 123000
function toMs (s: string): number {
  return Number(s.slice(0, -1)) * 1000
}
