/* @flow */

import { cached, extend, toObject } from 'shared/util'

/*
    将一段 css 文本转为 json 对象形式的 css（就像写在样式表里一样）
    例如：
    parseStyleText('color:red;font-size:14px;position:relative')
    -> {
      color: "red", 
      font-size: "14px", 
      position: "relative"
    }
 */
export const parseStyleText = cached(function (cssText) {
  /*
    /;(?![^(]*\))/
    ; 后面跟的不是（若干个非左括号加一个右括号）

    /:(.+)/
    : 后跟一个或多个不是换行符的字符
  */
  const res = {}
  const listDelimiter = /;(?![^(]*\))/g
  const propertyDelimiter = /:(.+)/
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      /*
        res 结构为：
        {
            p1 : val1,
            p1 : val1,
            p1 : val1,
            ...
        }
      */
      var tmp = item.split(propertyDelimiter)
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return res
})

// 合并静态和动态样式数据，返回值为 json 形式
function normalizeStyleData (data: VNodeData): ?Object {
  // ① 将 data.style 转为 json 对象形式
  const style = normalizeStyleBinding(data.style)
  // static style is pre-processed into an object during compilation
  // and is always a fresh object, so it's safe to merge into it
  /*
      静态样式 data.staticStyle 在编译过程中就已经转为 json 对象形式了

      ② 合并静态样式 data.staticStyle 和动态样式 style
   */
  return data.staticStyle
    ? extend(data.staticStyle, style)
    : style
}

// normalize possible array / string values into Object
// 将数组/字符串形式的值转成 json 对象
export function normalizeStyleBinding (bindingStyle: any): ?Object {
  // ① 数组 -> json
  if (Array.isArray(bindingStyle)) {
    /*
        arr = [
            { book : 'js' },
            { edition : 3 },
            { author : 'nanc' }
        ];
        toObject(arr)
        -> { book: "js", edition: 3, author: "nanc" }  
    */
    return toObject(bindingStyle)
  }
  // ② 字符串 -> json
  if (typeof bindingStyle === 'string') {
    return parseStyleText(bindingStyle)
  }
  return bindingStyle
}

/**
 * parent component style should be after child's
 * so that parent component's style could override it
 */
// 返回一个 json 对象（包括合并静态和动态样式数据）。父组件的 style 应该在子组件的后面。这样父组件的 style 就可以覆盖前面的。
export function getStyle (vnode: VNode, checkChild: boolean): Object {
  const res = {}
  let styleData

  // 1. 遍历子节点的样式
  if (checkChild) {
    let childNode = vnode
    while (childNode.componentInstance) {
      childNode = childNode.componentInstance._vnode
      if (childNode.data && (styleData = normalizeStyleData(childNode.data))) {
        extend(res, styleData)
      }
    }
  }

  // 2. 当前节点的样式
  if ((styleData = normalizeStyleData(vnode.data))) {
    extend(res, styleData)
  }

  // 3. 遍历祖先节点的样式
  let parentNode = vnode
  while ((parentNode = parentNode.parent)) {
    if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
      extend(res, styleData)
    }
  }

  // 返回 json 形式的样式数据
  return res
}

