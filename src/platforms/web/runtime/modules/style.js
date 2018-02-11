/* @flow */

import { getStyle, normalizeStyleBinding } from 'web/util/style'
import { cached, camelize, extend, isDef, isUndef } from 'shared/util'

const cssVarRE = /^--/
const importantRE = /\s*!important$/

// 设置样式
const setProp = (el, name, val) => {

  // ① name 以 '--' 开头，用 setProperty 方法设置样式
  if (cssVarRE.test(name)) {
    /*
        style.setProperty(propertyName, value, priority) 为一个声明了CSS样式的对象设置一个新的值
        参数：
        propertyName 被更改的 css 属性名
        value 属性值。如果没有指定，则当做空字符（注意: value 不能包含 "!important" --那个应该使用 priority 参数）
        priority 允许 "important" CSS 优先被设置。如果没有指定, 则当作空字符。
     */
    el.style.setProperty(name, val)
  // ② 设置带有 'important' 的样式
  } else if (importantRE.test(val)) {
    el.style.setProperty(name, val.replace(importantRE, ''), 'important')
  // ③ 直接设置样式 style.cssPropertyName = 'value'（之所以 ① 和 ② 没采取这种方法，是因为不是所有属性在 style 对象中都是合法的）
  } else {
    // 将普通的 css 属性名转为 style 对象中合法的属性名
    const normalizedName = normalize(name)
    if (Array.isArray(val)) {
      // Support values array created by autoprefixer, e.g.
      // {display: ["-webkit-box", "-ms-flexbox", "flex"]}
      // Set them one by one, and the browser will only set those it can recognize
      /*
        例如 {display: ["-webkit-box", "-ms-flexbox", "flex"]}
        会依次设置：
        el.style["display"] = "-webkit-box";
        el.style["display"] = "-ms-flexbox";
        el.style["display"] = "flex";
        虽然是连续设置了 3 次，但是浏览器只会真正执行它“认识”的属性值
      */
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

// 更新 style
function updateStyle (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const data = vnode.data
  const oldData = oldVnode.data

  // 如果没有 style 数据，就谈不上更新了，直接返回
  if (isUndef(data.staticStyle) && isUndef(data.style) &&
    isUndef(oldData.staticStyle) && isUndef(oldData.style)
  ) {
    return
  }

  let cur, name
  const el: any = vnode.elm
  // 旧的 style
  const oldStaticStyle: any = oldData.staticStyle
  const oldStyleBinding: any = oldData.normalizedStyle || oldData.style || {}

  // if static style exists, stylebinding already merged into it when doing normalizeStyleData
  // normalizeStyleData 函数已经把动态 style 合并到静态 style 中了，所以这里取 oldStaticStyle 就够了
  const oldStyle = oldStaticStyle || oldStyleBinding

  // 将数组/字符串形式的值转成 json 对象
  const style = normalizeStyleBinding(vnode.data.style) || {}

  // store normalized style under a different key for next diff
  // make sure to clone it if it's reactive, since the user likley wants
  // to mutate it.
  vnode.data.normalizedStyle = isDef(style.__ob__)
    ? extend({}, style) // 深复制一份 style（因为 style 被”观察“了，它的变动会触发订阅者改变，这是不必要的）
    : style

  // 返回一个 json 对象（包括合并静态和动态样式数据）
  const newStyle = getStyle(vnode, true)

  // 旧的属性名不存在新的属性列表里，则将其置为 ''
  for (name in oldStyle) {
    if (isUndef(newStyle[name])) {
      setProp(el, name, '')
    }
  }

  // 新旧属性不一样，更新之
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
