/* @flow */

import { getStyle, normalizeStyleBinding } from 'web/util/style'
import { cached, camelize, extend, isDef, isUndef } from 'shared/util'

const cssVarRE = /^--/
const importantRE = /\s*!important$/
const setProp = (el, name, val) => {
  /* istanbul ignore if */
  if (cssVarRE.test(name)) {
    el.style.setProperty(name, val)
  } else if (importantRE.test(val)) {
    el.style.setProperty(name, val.replace(importantRE, ''), 'important')
  } else {
    const normalizedName = normalize(name)
    if (Array.isArray(val)) {
      // Support values array created by autoprefixer, e.g.
      // {display: ["-webkit-box", "-ms-flexbox", "flex"]}
      // Set them one by one, and the browser will only set those it can recognize
      for (let i = 0, len = val.length; i < len; i++) {
        el.style[normalizedName] = val[i]
      }
    } else {
      el.style[normalizedName] = val
    }
  }
}

const vendorNames = ['Webkit', 'Moz', 'ms']

let emptyStyle

// 将普通的 css 属性名转为 style 对象中合法的属性名
const normalize = cached(function (prop) {
  emptyStyle = emptyStyle || document.createElement('div').style
  prop = camelize(prop)

  // ① 将 prop 驼峰化，例如：a-b-c -> aBC，若驼峰化后属性名合法，就返回该属性名
  if (prop !== 'filter' && (prop in emptyStyle)) {
    return prop
  }

  // ② 将 prop 首字母大写，然后加上 Webkit'/'Moz'/'ms' 等前缀，再次试探属性名是否合法，若合法则返回
  const capName = prop.charAt(0).toUpperCase() + prop.slice(1)
  // 以 prop 为 margin-top 为例，依次用 WebkitMarginTop、MozMarginTop、msMarginTop 类匹配 emptyStyle 里的属性名，匹配上了就是合法的
  for (let i = 0; i < vendorNames.length; i++) {
    const name = vendorNames[i] + capName
    if (name in emptyStyle) {
      return name
    }
  }
})

function updateStyle (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const data = vnode.data
  const oldData = oldVnode.data

  if (isUndef(data.staticStyle) && isUndef(data.style) &&
    isUndef(oldData.staticStyle) && isUndef(oldData.style)
  ) {
    return
  }

  let cur, name
  const el: any = vnode.elm
  const oldStaticStyle: any = oldData.staticStyle
  const oldStyleBinding: any = oldData.normalizedStyle || oldData.style || {}

  // if static style exists, stylebinding already merged into it when doing normalizeStyleData
  const oldStyle = oldStaticStyle || oldStyleBinding

  const style = normalizeStyleBinding(vnode.data.style) || {}

  // store normalized style under a different key for next diff
  // make sure to clone it if it's reactive, since the user likley wants
  // to mutate it.
  vnode.data.normalizedStyle = isDef(style.__ob__)
    ? extend({}, style)
    : style

  const newStyle = getStyle(vnode, true)

  for (name in oldStyle) {
    if (isUndef(newStyle[name])) {
      setProp(el, name, '')
    }
  }
  for (name in newStyle) {
    cur = newStyle[name]
    if (cur !== oldStyle[name]) {
      // ie9 setting to null has no effect, must use empty string
      setProp(el, name, cur == null ? '' : cur)
    }
  }
}

export default {
  create: updateStyle,
  update: updateStyle
}
