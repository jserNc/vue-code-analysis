/* @flow */

import { createFnInvoker } from './update-listeners'
import { remove, isDef, isUndef, isTrue } from 'shared/util'

// 合并钩子方法
export function mergeVNodeHook (def: Object, hookKey: string, hook: Function) {
  let invoker
  const oldHook = def[hookKey]

  // 包装一下 hook 方法，使得 hook 方法只能执行一次
  function wrappedHook () {
    // 在浏览器环境下，这里的 this 指 window
    hook.apply(this, arguments)
    // important: remove merged hook to ensure it's called only once and prevent memory leak
    // 从数组 invoker.fns 中移除 wrappedHook，所以 wrappedHook 只能执行一次
    remove(invoker.fns, wrappedHook)
  }

  // ① def[hookKey] 不存在
  if (isUndef(oldHook)) {
    invoker = createFnInvoker([wrappedHook])
  // ② def[hookKey] 存在
  } else {
    // a. 如果已经存在一个 invoker，那就直接合并
    if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
      // already a merged invoker
      invoker = oldHook
      invoker.fns.push(wrappedHook)
    // b. 否则，重新创建一个 invoker
    } else {
      // existing plain hook
      invoker = createFnInvoker([oldHook, wrappedHook])
    }
  }

  invoker.merged = true
  // 更新
  def[hookKey] = invoker
}
