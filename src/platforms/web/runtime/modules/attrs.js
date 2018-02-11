/* @flow */

import { isIE9 } from 'core/util/env'

import {
  extend,
  isDef,
  isUndef
} from 'shared/util'

import {
  isXlink,
  xlinkNS,
  getXlinkProp,
  isBooleanAttr,
  isEnumeratedAttr,
  isFalsyAttrValue
} from 'web/util/index'

// 更新属性
function updateAttrs (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const opts = vnode.componentOptions
  /*
      默认情况下父作用域的不被认作 props 的特性绑定 (attribute bindings) 将会“回退”且作为普通的 HTML 特性应用在子组件的根元素上。
      通过设置 inheritAttrs 到 false，这些默认行为将会被去掉。
   */
  if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {
    return
  }

  // 新旧节点都没有属性，也返回
  if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
    return
  }

  let key, cur, old
  const elm = vnode.elm
  const oldAttrs = oldVnode.data.attrs || {}
  let attrs: any = vnode.data.attrs || {}


  // clone observed objects, as the user probably wants to mutate it
  if (isDef(attrs.__ob__)) {
    // 深复制一份 attrs（因为 attrs 被”观察“了，它的变动会触发订阅者改变，这是不必要的）
    attrs = vnode.data.attrs = extend({}, attrs)
  }

  // 遍历新的属性列表（只要对应的属性值和新的属性值不同，那就更新为新的属性值）
  for (key in attrs) {
    cur = attrs[key]
    old = oldAttrs[key]
    if (old !== cur) {
      setAttr(elm, key, cur)
    }
  }

  // #4391: in IE9, setting type can reset value for input[type=radio]
  /*
      IE9 下，动态地设置 type 会导致 value 值被重置。

      上面的 for-in 循环可能会设置 type 属性，从而导致 value 值被重置了，这是不对的
      所以，在这里针对 value 属性单独重新设置
   */
  if (isIE9 && attrs.value !== oldAttrs.value) {
    setAttr(elm, 'value', attrs.value)
  }

  // 旧的属性列表中存在，而新的属性列表中不存在的属性则删除
  for (key in oldAttrs) {
    if (isUndef(attrs[key])) {
      if (isXlink(key)) {
        elm.removeAttributeNS(xlinkNS, getXlinkProp(key))
      } else if (!isEnumeratedAttr(key)) {
        elm.removeAttribute(key)
      }
    }
  }
}

// 设置属性（调用原生 api）
function setAttr (el: Element, key: string, value: any) {
  // 1. 布尔值属性。如 checked、enabled 等
  if (isBooleanAttr(key)) {
    // set attribute for blank value
    // e.g. <option disabled>Select one</option>

    // ① 若 value 为 undefined/null/false，那就移除该属性
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key)
    // ② 设置该属性，如 checked="checked"
    } else {
      el.setAttribute(key, key)
    }
  // 2. 枚举属性。如 contenteditable,draggable,spellcheck
  } else if (isEnumeratedAttr(key)) {
    el.setAttribute(key, isFalsyAttrValue(value) || value === 'false' ? 'false' : 'true')
  // 3. xlink 属性。如 xlink:href="http://www.w3school.com.cn"
  } else if (isXlink(key)) {
    if (isFalsyAttrValue(value)) {
      /*
          ① xlinkNS = 'http://www.w3.org/1999/xlink'
          ② 获取 xlink 中属性名，例如 getXlinkProp('xlink:href') -> 'href'
          ③ 删除属性
       */
      el.removeAttributeNS(xlinkNS, getXlinkProp(key))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  // 4. 其他属性
  } else {
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, value)
    }
  }
}

export default {
  create: updateAttrs,
  update: updateAttrs
}
