/* @flow */

import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * Query an element selector if it's not an element already.
 */
// 根据选择器 el，返回对应元素
export function query (el: string | Element): Element {
  // ① el 为字符串，通过 document.querySelector 方法查找
  if (typeof el === 'string') {
    const selected = document.querySelector(el)
    if (!selected) {
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      // 如果找不到，那就创建一个新的 div
      return document.createElement('div')
    }
    return selected
  // ② el 本身就是元素，直接返回 el
  } else {
    return el
  }
}
