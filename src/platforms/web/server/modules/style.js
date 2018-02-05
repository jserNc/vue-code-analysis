/* @flow */

import { cachedEscape } from '../util'
import { hyphenate } from 'shared/util'
import { getStyle } from 'web/util/style'

// 返回值形如 'color:red;font-size:14px;position:relative'
export function genStyle (style: Object): string {
  let styleText = ''

  // 遍历 style 对象
  for (const key in style) {
    const value = style[key]
    // 将驼峰写法转为连字符写法，如 hyphenate('aaBbCc') -> "aa-bb-cc"
    const hyphenatedKey = hyphenate(key)

    // ① value 为数组
    if (Array.isArray(value)) {
      for (let i = 0, len = value.length; i < len; i++) {
        styleText += `${hyphenatedKey}:${value[i]};`
      }
    // ② value 为一般值
    } else {
      styleText += `${hyphenatedKey}:${value};`
    }
  }

  // 返回值形如 'color:red;font-size:14px;position:relative'
  return styleText
}

// 返回值形如 'style="color:red;font-size:14px;position:relative"'
export default function renderStyle (vnode: VNodeWithData): ?string {
  const styleText = genStyle(getStyle(vnode, false))
  if (styleText !== '') {
    return ` style=${JSON.stringify(cachedEscape(styleText))}`
  }
}
