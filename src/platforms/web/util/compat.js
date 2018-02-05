/* @flow */

// 文件名中 compat 的意思是“兼容性”

import { inBrowser } from 'core/util/index'

// check whether current browser encodes a char inside attribute values
/*
		判断当前浏览器是否会对属性值转码
		例如，属性值中有换行符是，ie 会将这个换行符转成转义字符

		在 IE 下，shouldDecode('\n', '&#10;') -> true
 */
function shouldDecode (content: string, encoded: string): boolean {
  const div = document.createElement('div')
  div.innerHTML = `<div a="${content}"/>`
  return div.innerHTML.indexOf(encoded) > 0
}

// #3663
// IE encodes newlines inside attribute values while other browsers don't
// 如果属性值中有换行符，ie 会将换行符替换为转义字符，其他浏览器不会
export const shouldDecodeNewlines = inBrowser ? shouldDecode('\n', '&#10;') : false
