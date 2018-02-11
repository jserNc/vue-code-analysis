/* @flow */

import { isDef, isUndef, extend, toNumber } from 'shared/util'

// 更新 props
function updateDOMProps (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // 如果新旧节点都没 props，那就谈不上更新了，返回吧
  if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
    return
  }

  let key, cur
  const elm: any = vnode.elm
  const oldProps = oldVnode.data.domProps || {}
  let props = vnode.data.domProps || {}

  // clone observed objects, as the user probably wants to mutate it
  if (isDef(props.__ob__)) {
    // 深复制一份 props（因为 props 被”观察“了，它的变动会触发订阅者改变，这是不必要的）
    props = vnode.data.domProps = extend({}, props)
  }

  // 旧的属性名不存在新的属性列表里，则将其置为 ''
  for (key in oldProps) {
    if (isUndef(props[key])) {
      elm[key] = ''
    }
  }

  // 遍历新的属性列表
  for (key in props) {
    cur = props[key]
    // ignore children if the node has textContent or innerHTML,
    // as these will throw away existing DOM nodes and cause removal errors
    // on subsequent patches (#3360)
    // ① 如果有 'textContent'/'innerHTML' 属性，就强制清除子元素
    if (key === 'textContent' || key === 'innerHTML') {
      if (vnode.children) vnode.children.length = 0
      if (cur === oldProps[key]) continue
    }

    // ② 'value' 属性
    if (key === 'value') {
      // store value as _value as well since
      // non-string values will be stringified
      
      // 保留原始值（后面会将其强制改为字符串）
      elm._value = cur
      // avoid resetting cursor position when value is the same
      
      // 字符串化后的属性值
      const strCur = isUndef(cur) ? '' : String(cur)

      // 满足特定条件 value 值才会更新
      if (shouldUpdateValue(elm, vnode, strCur)) {
        elm.value = strCur
      }
    // ③ 其他属性
    } else {
      elm[key] = cur
    }
  }
}

// check platforms/web/util/attrs.js acceptValue
type acceptValueElm = HTMLInputElement | HTMLSelectElement | HTMLOptionElement;

// 是否应该更新 value 值
function shouldUpdateValue (
  elm: acceptValueElm,    // elm 为 input/select/option 元素之一
  vnode: VNodeWithData,
  checkVal: string
): boolean {
  return (!elm.composing && (       // 输入完毕
    vnode.tag === 'option' ||       // <option> 元素
    isDirty(elm, checkVal) ||       // 失去了焦点，并且新值不等于 value
    isInputChanged(elm, checkVal)   // 新旧 value 值不一样
  ))
}

// elm 元素失去焦点，并且 checkVal 不等于 elm.value 值，就返回 true
function isDirty (elm: acceptValueElm, checkVal: string): boolean {
  // return true when textbox (.number and .trim) loses focus and its value is
  // not equal to the updated value
  return document.activeElement !== elm && elm.value !== checkVal
}

// input 输入框的值是否变化
function isInputChanged (elm: any, newVal: string): boolean {
  const value = elm.value

  // v-model 修饰符
  const modifiers = elm._vModifiers // injected by v-model runtime

  // ① value 转为数值后相等，直接返回
  if (isDef(modifiers) && modifiers.number) {
    return toNumber(value) !== toNumber(newVal)
  }

  // ② value 去掉前后空格后相等，直接返回
  if (isDef(modifiers) && modifiers.trim) {
    return value.trim() !== newVal.trim()
  }

  return value !== newVal
}

export default {
  create: updateDOMProps,
  update: updateDOMProps
}
