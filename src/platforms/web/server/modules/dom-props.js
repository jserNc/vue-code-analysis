/* @flow */

import VNode from 'core/vdom/vnode'
import { renderAttr } from './attrs'
import { isDef, isUndef } from 'shared/util'
import { propsToAttrMap, isRenderableAttr } from '../util'

// 返回值形如 'class="fred" accept-charset="utf-8"'
export default function renderDOMProps (node: VNodeWithData): string {
  let props = node.data.domProps
  let res = ''

  let parent = node.parent
  // 遍历祖先元素的 domProps 属性，合并在一起
  while (isDef(parent)) {
    if (parent.data && parent.data.domProps) {
      // 合并 props 和 parent.data.domProps 对象，后者覆盖前者同名属性
      props = Object.assign({}, props, parent.data.domProps)
    }
    parent = parent.parent
  }

  // 若到这里 props 还是 undefined/null，那就直接返回 ''
  if (isUndef(props)) {
    return res
  }

  const attrs = node.data.attrs
  for (const key in props) {
    if (key === 'innerHTML') {
      // 将文本 props['innerHTML'] 作为节点 node 的唯一子元素
      setText(node, props[key], true)
    } else if (key === 'textContent') {
      // 将文本 props['textContent'] 作为节点 node 的唯一子元素
      setText(node, props[key], false)
    } else {
      /*
          propsToAttrMap = {
            acceptCharset: 'accept-charset',
            className: 'class',
            htmlFor: 'for',
            httpEquiv: 'http-equiv'
          }
       */
      const attr = propsToAttrMap[key] || key.toLowerCase()
      if (isRenderableAttr(attr) &&
        // avoid rendering double-bound props/attrs twice
        // 若属性 attr 已经当做 attrs 了，就不要再当成 props 渲染了
        !(isDef(attrs) && isDef(attrs[attr]))
      ) {
        // renderAttr(key, value) 返回 'key="value"' 形式的属性字符串
        res += renderAttr(attr, props[key])
      }
    }
  }
  // 返回值形如 'class="fred" accept-charset="utf-8"'
  return res
}

// 创建一个文本 Vnode，并将其作为 node 的唯一子元素
function setText (node, text, raw) {
  const child = new VNode(undefined, undefined, undefined, text)
  child.raw = raw
  node.children = [child]
}
