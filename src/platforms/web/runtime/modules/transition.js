/* @flow */

import { inBrowser, isIE9, warn } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { activeInstance } from 'core/instance/lifecycle'

import {
  once,
  isDef,
  isUndef,
  isObject,
  toNumber
} from 'shared/util'

import {
  nextFrame,
  resolveTransition,
  whenTransitionEnds,
  addTransitionClass,
  removeTransitionClass
} from '../transition-util'

// 过渡/动画进入
export function enter (vnode: VNodeWithData, toggleDisplay: ?() => void) {
  const el: any = vnode.elm

  // 调用 leave 的回调函数
  if (isDef(el._leaveCb)) {
    el._leaveCb.cancelled = true
    el._leaveCb()
  }

  // 返回过渡/动画相关的钩子函数/class 等信息
  const data = resolveTransition(vnode.data.transition)

  if (isUndef(data)) {
    return
  }

  // el._enterCb 存在或者 el 不为元素，则返回
  if (isDef(el._enterCb) || el.nodeType !== 1) {
    return
  }

  const {
    css,
    type,
    enterClass,
    enterToClass,
    enterActiveClass,
    appearClass,
    appearToClass,
    appearActiveClass,
    beforeEnter,
    enter,
    afterEnter,
    enterCancelled,
    beforeAppear,
    appear,
    afterAppear,
    appearCancelled,
    duration
  } = data

  // activeInstance will always be the <transition> component managing this
  // transition. One edge case to check is when the <transition> is placed
  // as the root node of a child component. In that case we need to check
  // <transition>'s parent for appear check.
  let context = activeInstance
  let transitionNode = activeInstance.$vnode

  // 修正 context 和 transitionNode
  while (transitionNode && transitionNode.parent) {
    transitionNode = transitionNode.parent
    context = transitionNode.context
  }

  // 是否为初次渲染
  const isAppear = !context._isMounted || !vnode.isRootInsert

  /*
      可以通过 appear 特性设置节点在初始渲染的过渡
      <transition appear>
        <!-- ... -->
      </transition>

      这里默认和进入/离开过渡一样，同样也可以自定义 CSS 类名
      <transition
        appear
        appear-class="custom-appear-class"
        appear-to-class="custom-appear-to-class" (2.1.8+)
        appear-active-class="custom-appear-active-class"
      >
        <!-- ... -->
      </transition>

      自定义 JavaScript 钩子：
      <transition
        appear
        v-on:before-appear="customBeforeAppearHook"
        v-on:appear="customAppearHook"
        v-on:after-appear="customAfterAppearHook"
        v-on:appear-cancelled="customAppearCancelledHook"
      >
        <!-- ... -->
      </transition>
   */
  if (isAppear && !appear && appear !== '') {
    return
  }

  // 元素被插入时生效，下一帧移除
  const startClass = isAppear && appearClass
    ? appearClass
    : enterClass
  // 在过渡过程中生效，比如定义过渡时间，延迟和曲线函数等
  const activeClass = isAppear && appearActiveClass
    ? appearActiveClass
    : enterActiveClass
  // 在元素被插入一帧后生效，在 transition/animation 完成之后移除
  const toClass = isAppear && appearToClass
    ? appearToClass
    : enterToClass

  // 进入之前钩子
  const beforeEnterHook = isAppear
    ? (beforeAppear || beforeEnter)
    : beforeEnter
  // 进入钩子
  const enterHook = isAppear
    ? (typeof appear === 'function' ? appear : enter)
    : enter
  // 进入之后钩子
  const afterEnterHook = isAppear
    ? (afterAppear || afterEnter)
    : afterEnter
  // 进入取消钩子
  const enterCancelledHook = isAppear
    ? (appearCancelled || enterCancelled)
    : enterCancelled

  /*
      显性的过渡持续时间

      在很多情况下，Vue 可以自动得出过渡效果的完成时机。默认情况下，Vue 会等待其在过渡效果的根元素的第一个 transitionend 或 animationend 事件。然而也可以不这样设定——比如，我们可以拥有一个精心编排的一序列过渡效果，其中一些嵌套的内部元素相比于过渡效果的根元素有延迟的或更长的过渡效果。

      在这种情况下你可以用 <transition> 组件上的 duration 属性定制一个显性的过渡持续时间 (以毫秒计)：
      <transition :duration="1000">...</transition>

      你也可以定制进入和移出的持续时间：
      <transition :duration="{ enter: 500, leave: 800 }">...</transition>
   */
  const explicitEnterDuration: any = toNumber(
    isObject(duration)
      ? duration.enter
      : duration
  )

  // 非生产环境下，检验 explicitEnterDuration 是否为有效的数值
  if (process.env.NODE_ENV !== 'production' && explicitEnterDuration != null) {
    checkDuration(explicitEnterDuration, 'enter', vnode)
  }

  /*
      对于仅使用 JavaScript 过渡的元素添加 v-bind:css="false"，Vue 会跳过 CSS 的检测。
      这也可以避免过渡过程中 CSS 的影响。

      注意是仅使用 JavaScript，例如：
      <div id="example-4">
        <button @click="show = !show">
          Toggle
        </button>
        <transition
          v-on:before-enter="beforeEnter"
          v-on:enter="enter"
          v-on:leave="leave"
          v-bind:css="false"
        >
          <p v-if="show">
            Demo
          </p>
        </transition>
      </div>
   */
  const expectsCSS = css !== false && !isIE9
  // 函数 enterHook 的形参是否大于 1
  const userWantsControl = getHookArgumentsLength(enterHook)

  // 这个函数在过渡/动画进入完成之后执行
  const cb = el._enterCb = once(() => {
    if (expectsCSS) {
      removeTransitionClass(el, toClass)
      removeTransitionClass(el, activeClass)
    }

    // ① 取消
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, startClass)
      }
      enterCancelledHook && enterCancelledHook(el)
    // ② 正常结束
    } else {
      afterEnterHook && afterEnterHook(el)
    }
    el._enterCb = null
  })

  // 合并 enterHook 合并到 'insert' 钩子函数中
  if (!vnode.data.show) {
    // remove pending leave element on enter by injecting an insert hook
    /*
        mergeVNodeHook (def, hookKey, hook) 的作用是将钩子方法 hook 加入到 def[hookKey] 中，也就是添加一个钩子方法，以后执行 def[hookKey] 也就会执行 hook 方法了
        这里将  elm._leaveCb() 和 enterHook(el, cb) 都作为 'insert' 钩子回调
     */
    mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'insert', () => {
      const parent = el.parentNode
      // 正在离开的元素
      const pendingNode = parent && parent._pending && parent._pending[vnode.key]
      if (pendingNode &&
        pendingNode.tag === vnode.tag &&
        pendingNode.elm._leaveCb
      ) {
        pendingNode.elm._leaveCb()
      }
      enterHook && enterHook(el, cb)
    })
  }

  // 执行进入前钩子
  beforeEnterHook && beforeEnterHook(el)


  if (expectsCSS) {
    // 1. 添加 startClass、activeClass
    addTransitionClass(el, startClass)
    addTransitionClass(el, activeClass)

    // 2. 下一帧，添加 toClass，移除 startClass
    nextFrame(() => {
      addTransitionClass(el, toClass)
      removeTransitionClass(el, startClass)
      if (!cb.cancelled && !userWantsControl) {
        // ① 若指定了过渡持续时间，该时间之后执行 cb
        if (isValidDuration(explicitEnterDuration)) {
          setTimeout(cb, explicitEnterDuration)
        // ② 否则就等到过渡结束后执行 cb（监听了 transitionend 事件）
        } else {
          whenTransitionEnds(el, type, cb)
        }
      }
    })
  }


  if (vnode.data.show) {
    // toggleDisplay 为 enter 方法的第二个参数
    toggleDisplay && toggleDisplay()
    enterHook && enterHook(el, cb)
  }

  // 如果过渡的元素有属性 v-bind:css="false"，那么 expectsCSS 就是 false
  if (!expectsCSS && !userWantsControl) {
    cb()
  }
}

// 离开过渡
export function leave (vnode: VNodeWithData, rm: Function) {
  const el: any = vnode.elm


  // 过渡/动画完成之后执行 el._enterCb()
  if (isDef(el._enterCb)) {
    el._enterCb.cancelled = true
    el._enterCb()
  }

  // 返回过渡/动画相关的钩子函数/class 等信息
  const data = resolveTransition(vnode.data.transition)
  

  // 若 data 不存在，直接直接 rm()
  if (isUndef(data)) {
    return rm()
  }

  // 若 el._leaveCb 存在或 el 不为元素，则返回
  if (isDef(el._leaveCb) || el.nodeType !== 1) {
    return
  }

  const {
    css,
    type,
    leaveClass,
    leaveToClass,
    leaveActiveClass,
    beforeLeave,
    leave,
    afterLeave,
    leaveCancelled,
    delayLeave,
    duration
  } = data

  // 对于仅使用 JavaScript 过渡的元素添加 v-bind:css="false"，Vue 会跳过 CSS 的检测。这也可以避免过渡过程中 CSS 的影响。
  const expectsCSS = css !== false && !isIE9
  // 函数 leave 的形参是否大于 1
  const userWantsControl = getHookArgumentsLength(leave)

  /*
      显性的过渡持续时间

      在很多情况下，Vue 可以自动得出过渡效果的完成时机。默认情况下，Vue 会等待其在过渡效果的根元素的第一个 transitionend 或 animationend 事件。然而也可以不这样设定——比如，我们可以拥有一个精心编排的一序列过渡效果，其中一些嵌套的内部元素相比于过渡效果的根元素有延迟的或更长的过渡效果。

      在这种情况下你可以用 <transition> 组件上的 duration 属性定制一个显性的过渡持续时间 (以毫秒计)：
      <transition :duration="1000">...</transition>

      你也可以定制进入和移出的持续时间：
      <transition :duration="{ enter: 500, leave: 800 }">...</transition>
   */
  const explicitLeaveDuration: any = toNumber(
    isObject(duration)
      ? duration.leave
      : duration
  )

  // 非生产环境下，检验 explicitLeaveDuration 是否为有效的数值
  if (process.env.NODE_ENV !== 'production' && isDef(explicitLeaveDuration)) {
    checkDuration(explicitLeaveDuration, 'leave', vnode)
  }

  // 这个函数在过渡/动画离开完成之后执行
  const cb = el._leaveCb = once(() => {
    // 标记已经离开
    if (el.parentNode && el.parentNode._pending) {
      el.parentNode._pending[vnode.key] = null
    }

    if (expectsCSS) {
      removeTransitionClass(el, leaveToClass)
      removeTransitionClass(el, leaveActiveClass)
    }

    // ① 取消
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, leaveClass)
      }
      leaveCancelled && leaveCancelled(el)
    // ② 正常结束
    } else {
      rm()
      afterLeave && afterLeave(el)
    }
    el._leaveCb = null
  })

  // 执行钩子函数
  if (delayLeave) {
    delayLeave(performLeave)
  } else {
    performLeave()
  }

  function performLeave () {
    // the delayed leave may have already been cancelled
    if (cb.cancelled) {
      return
    }

    // record leaving element
    // 记录正在离开的元素
    if (!vnode.data.show) {
      (el.parentNode._pending || (el.parentNode._pending = {}))[(vnode.key: any)] = vnode
    }

    // 离开之前钩子
    beforeLeave && beforeLeave(el)

    if (expectsCSS) {
      // 1. 添加 leaveClass、leaveActiveClass
      addTransitionClass(el, leaveClass)
      addTransitionClass(el, leaveActiveClass)

      // 2. 下一帧，添加 leaveToClass，移除 leaveClass
      nextFrame(() => {
        addTransitionClass(el, leaveToClass)
        removeTransitionClass(el, leaveClass)
        if (!cb.cancelled && !userWantsControl) {
          // ① 若指定了过渡持续时间，该时间之后执行 cb
          if (isValidDuration(explicitLeaveDuration)) {
            setTimeout(cb, explicitLeaveDuration)
          // ② 否则就等到过渡结束后执行 cb（监听了 transitionend 事件）
          } else {
            whenTransitionEnds(el, type, cb)
          }
        }
      })
    }
    leave && leave(el, cb)

    // 直接执行 cb()
    if (!expectsCSS && !userWantsControl) {
      cb()
    }
  }
}

// 检验 value 是否为有效的数值（只在开发模式用这个方法）
function checkDuration (val, name, vnode) {
  // ① val 必须是 number 类型
  if (typeof val !== 'number') {
    warn(
      `<transition> explicit ${name} duration is not a valid number - ` +
      `got ${JSON.stringify(val)}.`,
      vnode.context
    )
  // ② val 还不能是 NaN
  } else if (isNaN(val)) {
    warn(
      `<transition> explicit ${name} duration is NaN - ` +
      'the duration expression might be incorrect.',
      vnode.context
    )
  }
}

// 有效的数值（持续时间）
function isValidDuration (val) {
  return typeof val === 'number' && !isNaN(val)
}

/**
 * Normalize a transition hook's argument length. The hook may be:
 * - a merged hook (invoker) with the original in .fns
 * - a wrapped component method (check ._length)
 * - a plain function (.length)
 */
/*
    规范化过渡的钩子函数的参数长度，钩子函数可能有以下几种：
    1. 函数是 invoker（简单的理解就是，将一组函数 fns 合并成一个函数 invoker（invoker.fns = fns））
    2. 函数是 boundFn（绑定函数 fn 内部的 this 到 ctx，boundFn._length = fn.length）
    3. 普通函数
 */
function getHookArgumentsLength (fn: Function): boolean {
  if (isUndef(fn)) {
    return false
  }
  const invokerFns = fn.fns
  // ① invoker
  if (isDef(invokerFns)) {
    // 递归调用 getHookArgumentsLength(invokerFns[0] | invokerFns)
    return getHookArgumentsLength(
      Array.isArray(invokerFns)
        ? invokerFns[0]
        : invokerFns
    )
  // ② boundFn 或普通函数
  } else {
    // 实质就这一句，判断函数的形参是否大于 1
    return (fn._length || fn.length) > 1
  }
}

// 原先是隐藏状态，执行过渡/动画进入
function _enter (_: any, vnode: VNodeWithData) {
  if (vnode.data.show !== true) {
    enter(vnode)
  }
}

// transition 仅仅在浏览器环境下存在
export default inBrowser ? {
  create: _enter,
  activate: _enter,
  remove (vnode: VNode, rm: Function) {
    
    if (vnode.data.show !== true) {
      leave(vnode, rm)
    } else {
      rm()
    }
  }
} : {}
