/* @flow */

import { cachedEscape } from '../util'
import { genClassForVnode } from 'web/util/index'

// 返回 'class="cls1 cls2 cls3 cls4 cls5 cls6"' 形式字符串
export default function renderClass (node: VNodeWithData): ?string {
	// 返回字符串形式的 class 值，如 'cls1 cls2 cls3 cls4 cls5 cls6'
  const classList = genClassForVnode(node)
  if (classList !== '') {
  	// cachedEscape(classList) 将字符串 classList 中的 < > " & 等四个字符转为实体
    return ` class="${cachedEscape(classList)}"`
  }
}
