/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef } from 'shared/util'

// 格式化事件名（解析其中的 & ~ !）
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean
} => {
  // ① 如果 name 的第一个字符是 &，那么 passive 为 true
  const passive = name.charAt(0) === '&'
  // 如果 name 的第一个字符是 &，那么丢掉这个字符
  name = passive ? name.slice(1) : name

  // ② 如果 name 的第一个字符是 ~，那么 once 为 true
  const once = name.charAt(0) === '~'
  // 如果 name 的第一个字符是 ~，那么丢掉这个字符
  name = once ? name.slice(1) : name

  // ③ 如果 name 的第一个字符是 !，那么 capture 为 true
  const capture = name.charAt(0) === '!'
  // 如果 name 的第一个字符是 !，那么丢掉这个字符
  name = capture ? name.slice(1) : name

  // 返回 json 对象
  return {
    name,
    once,
    capture,
    passive
  }
})

/*
  创建函数调度器，执行 invoker() 函数时：
  ① 若 fns 是一组函数，依次执行 fns 里的每一个函数
  ② 若 fns 只是一个函数，执行该函数，并将该函数的返回值作为 invoker 函数的返回值
 
  简单的理解就是，将一组函数 fns 合并成一个函数 invoker
 */
export function createFnInvoker (fns: Function | Array<Function>): Function {
  function invoker () {
    const fns = invoker.fns
    // ① fns 是函数组成的数组
    if (Array.isArray(fns)) {
      // 深拷贝 fns 数组，然后依次执行数组里的每一个方法
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    // ② fns 就是一个函数，那就直接执行这个函数
    } else {
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns
  return invoker
}

// 更新监听函数
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  vm: Component
) {
  let name, cur, old, event

  // 1. 遍历新的事件回调函数集合 on
  for (name in on) {
    cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    // a. cur 为 undefined/null，这是不允许的，发出警告
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    // b. cur 合法，但是 old 为 undefined/null，说明这是个新的事件，这就需要添加事件了
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        // 将一组函数 cur 合并为一个函数 createFnInvoker(cur)
        cur = on[name] = createFnInvoker(cur)
      }
      // 监听新的事件
      add(event.name, cur, event.once, event.capture, event.passive)
    // c. cur 和 old 都合法，用旧的调度函数 old 就好了，更新 old.fns 即可
    } else if (cur !== old) {
      old.fns = cur
      on[name] = old
    }
  }

  // 2. 遍历旧的事件回调函数集合 oldOn，解除不必要的事件绑定
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
