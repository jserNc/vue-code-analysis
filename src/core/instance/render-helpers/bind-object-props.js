/* @flow */

import config from 'core/config'

import {
  warn,
  isObject,
  toObject,
  isReservedAttribute
} from 'core/util/index'

/**
 * Runtime helper for merging v-bind="object" into a VNode's data.
 */
/*
    Vue.prototype._b = bindObjectProps;
    该函数作用是将 v-bind="object" 转换成 VNode 的 data

    简单的说：
    v-bind 指令的值 object 对象就是参数 value，根据这个 value 对象的值对 data 对象进行修正，最后返回 data 对象 
 */
export function bindObjectProps (
  data: any,
  tag: string,
  value: any,
  asProp: boolean,
  isSync?: boolean
): VNodeData {
  // 若 value 存在，那就对 data 进行修正，最后返回修改后的 data
  if (value) {
    // ① value 不是对象，发出警告（不带参数的 v-bind 的值应该是对象/数组）
    if (!isObject(value)) {
      process.env.NODE_ENV !== 'production' && warn(
        'v-bind without argument expects an Object or Array value',
        this
      )
    // ② value 是对象/数组
    } else {
      // 若 value 是数组形式，转为对象
      if (Array.isArray(value)) {
         /*
           将一组对象合并成一个对象，eg:
           arr = [
              { book : 'js' },
              { edition : 3 },
              { author : 'nanc' }
           ];
           toObject(arr) 
           -> { book: "js", edition: 3, author: "nanc" }
         */
        value = toObject(value)
      }
      let hash
      // 遍历 value 的属性
      for (const key in value) {
        // ① key 是 'class'、'style'、'key','ref','slot','is' 其中之一，hash 取 data
        if (key === 'class' || key === 'style' || isReservedAttribute(key)) {
          hash = data
        // ② key 是其他值，hash 取 data.domProps/data.attrs
        } else {
          const type = data.attrs && data.attrs.type
          hash = asProp || config.mustUseProp(tag, type, key)
            ? data.domProps || (data.domProps = {})
            : data.attrs || (data.attrs = {})
        }

        // 若 key 属性存在于 value 中，不存在于 hash 中，那就在 hash 中添加这个属性
        if (!(key in hash)) {
          hash[key] = value[key]

          if (isSync) {
            const on = data.on || (data.on = {})
            on[`update:${key}`] = function ($event) {
              value[key] = $event
            }
          }
        }
      }
    }
  }
  return data
}
