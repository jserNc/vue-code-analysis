/* @flow */

import { isObject, isDef } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 */
// Vue.prototype._l = renderList 渲染 v-for 列表，返回数组 ret，该数组的每个元素是 render 函数的执行结果
export function renderList (
  val: any,
  render: (
    val: any,
    keyOrIndex: string | number,
    index?: number
  ) => VNode
): ?Array<VNode> {
  let ret: ?Array<VNode>, i, l, keys, key
  // ① val 是数组或字符串，例如 v-for="(value, key) in items" 中的 items
  if (Array.isArray(val) || typeof val === 'string') {
    ret = new Array(val.length)
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i)
    }
  // ② val 是数值，例如 v-for="item in 5" 中的 5
  } else if (typeof val === 'number') {
    ret = new Array(val)
    for (i = 0; i < val; i++) {
      ret[i] = render(i + 1, i)
    }
  // ③ val 是对象
  } else if (isObject(val)) {
    keys = Object.keys(val)
    ret = new Array(keys.length)
    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i]
      ret[i] = render(val[key], key, i)
    }
  }
  // 若 val 是以上 3 种情况之一，ret 就会被赋值为数组，在此给 ret 添加一个 _isVList 属性
  if (isDef(ret)) {
    (ret: any)._isVList = true
  }
  return ret
}
