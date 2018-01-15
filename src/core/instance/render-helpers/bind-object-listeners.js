/* @flow */

import { warn, extend, isPlainObject } from 'core/util/index'

// v-bind="object"
export function bindObjectListeners (data: any, value: any): VNodeData {
  if (value) {
    // ① 若 value 不是对象，发出警告（v-on 没有参数时需传入一个对象值）
    if (!isPlainObject(value)) {
      process.env.NODE_ENV !== 'production' && warn(
        'v-on without argument expects an Object value',
        this
      )
    // ② value 是对象，新旧对象（每一项的数组进行拼接）
    } else {
      const on = data.on = data.on ? extend({}, data.on) : {}
      for (const key in value) {
        const existing = on[key]
        const ours = value[key]
        on[key] = existing ? [].concat(ours, existing) : ours
      }
    }
  }
  return data
}
