/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

// 初始化事件
export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  
  // 这个标志默认为 false，后面遇到钩子事件时会将其置为 true
  vm._hasHookEvent = false

  // init parent attached events
  const listeners = vm.$options._parentListeners
  // 将父组件的事件绑定到当前组件
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: Component

// 添加事件绑定
function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

// 解除事件绑定
function remove (event, fn) {
  target.$off(event, fn)
}

// 更新事件绑定
export function updateComponentListeners (vm: Component, listeners: Object, oldListeners: ?Object ) {
  // target 锁定为当前 vm
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
}

// 添加 Vue.prototype.$on、Vue.prototype.$once、Vue.prototype.$off、Vue.prototype.$emit 等方法
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  // 绑定事件
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      // 将函数 fn 添加到数组 vm._events[event] 中
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      // event 以 hook 开头
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  // 绑定事件（回调函数执行一次后，解除事件绑定）
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      // 解绑
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    // 绑定
    vm.$on(event, on)
    return vm
  }

  // 解绑事件
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // 1. 没有实参，清空所有事件
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // 2. event 是一个数组，递归调用本方法，一个个解除
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }

    // 3. 解除一个事件

    // 事件 event 对应的监听函数数组
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    // 清空事件 event 对应的所有监听函数
    if (arguments.length === 1) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      /*
        ① cb === fn 对应 $on 方法绑定的监听函数；
        ② cb.fn === fn 对应 $once 方法绑定的监听函数
       */
      if (cb === fn || cb.fn === fn) {
		    // 删除事件 event 的一个监听函数 fn
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  // 触发事件
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        /*
          tip 函数的作用是：调用 console.warn 函数发出警告，例如："[Vue tip]: some tip"

          翻译一下提示：
          组件 <AaaBbb>（格式化后的组件名）发出了事件 lowerCaseEvent（全小写字母构成），但是注册的事件类型是 event（非全小写字母构成）。
          需要注意的是 html 属性是大小写不敏感的。我们不能在模板中用 v-on 来监听驼峰写法的事件类型。
          我们应该使用连字符写法。如 hyphenate('aaBbCc') -> "aa-bb-cc"。
        */
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 将第一个实参 event 排除掉，剩下的参数真正被回调函数用的实参
      const args = toArray(arguments, 1)
      // 依次执行 vm._events[event] 数组中的回调函数，也就是说执行事件 event 对应的所有回调函数
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          // 回调函数执行时的实参 args 是除了参数 event 以外的其他参数
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
