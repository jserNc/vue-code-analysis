/* @flow */

import { cachedEscape } from '../util'

import {
  isDef,
  isUndef
} from 'shared/util'

import {
  isBooleanAttr,
  isEnumeratedAttr,
  isFalsyAttrValue
} from 'web/util/attrs'

// 最终返回 'att1="value1" att2="value2" att3="value3"' 形式的字符串
export default function renderAttrs (node: VNodeWithData): string {
  let attrs = node.data.attrs
  let res = ''

  const opts = node.parent && node.parent.componentOptions
  if (isUndef(opts) || opts.Ctor.options.inheritAttrs !== false) {
    let parent = node.parent
    // 遍历组件组件的属性，合并到一起
    while (isDef(parent)) {
      if (isDef(parent.data) && isDef(parent.data.attrs)) {
        /*
            Object.assign方法用于对象的合并，将源对象（source）的所有可枚举属性，复制到目标对象（target）
            如果目标对象与源对象有同名属性，或多个源对象有同名属性，则后面的属性会覆盖前面的属性

            例如：
            const target = { a: 1, b: 1 };
            const source1 = { b: 2, c: 2 };
            const source2 = { c: 3 };

            Object.assign(target, source1, source2);
            target -> {a:1, b:2, c:3}
         */
        attrs = Object.assign({}, attrs, parent.data.attrs)
      }
      parent = parent.parent
    }
  }

  // 若到这里 attrs 还是 undefined/null，那就直接返回 ''
  if (isUndef(attrs)) {
    return res
  }

  // 遍历 attrs 中所有的属性，以 'key="value"' 形式拼接字符串 res
  for (const key in attrs) {
    if (key === 'style') {
      // leave it to the style module
      continue
    }
    res += renderAttr(key, attrs[key])
  }
  return res
}

// 返回 'key="value"' 形式的属性字符串
export function renderAttr (key: string, value: string): string {
  // 1. 属性 key 的值是布尔值
  if (isBooleanAttr(key)) {
    if (!isFalsyAttrValue(value)) {
      return ` ${key}="${key}"`
    }
  // 2. 属性 key 的值是可枚举的
  } else if (isEnumeratedAttr(key)) {
    return ` ${key}="${isFalsyAttrValue(value) || value === 'false' ? 'false' : 'true'}"`
  // 3. 属性 key 的值不是 null、undefined、false 三者之一
  } else if (!isFalsyAttrValue(value)) {
    return ` ${key}="${typeof value === 'string' ? cachedEscape(value) : value}"`
  }
  return ''
}
