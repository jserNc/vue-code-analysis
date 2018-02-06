/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from 'compiler/helpers'

/*
    ① parse (template,options) 函数中会执行：
    transforms = pluckModuleFunction(options.modules, 'transformNode');
    即返回 options.modules 中每一个 module.transformNode 组成的数组，即 [ module1.transformNode,  module2.transformNode,  module2.transformNode, ...]

    ② 在 parseHTML 函数的 start 钩子函数中，会执行：
    for (let i = 0; i < transforms.length; i++) {
      transforms[i](element, options)
    }
 */
function transformNode (el: ASTElement, options: CompilerOptions) {
  const warn = options.warn || baseWarn
  const staticClass = getAndRemoveAttr(el, 'class')
  if (process.env.NODE_ENV !== 'production' && staticClass) {
    /*
        parseText 函数的作用是将模板字符串转为浏览器可以识别的常规字符串，例如：
        parseText('abc{{msg | fn}}efg')
        -> 'abc' + '_s(_f("fn")(msg))' + 'efg'

        注意：若参数不是插值写法，返回值就是 undefined
     */
    const expression = parseText(staticClass, options.delimiters)
    if (expression) {
      // 警告：<div class="{{ val }}"> 属性内的插值这种写法已经不支持了。推荐使用 <div :class="val">
      warn(
        `class="${staticClass}": ` +
        'Interpolation inside attributes has been removed. ' +
        'Use v-bind or the colon shorthand instead. For example, ' +
        'instead of <div class="{{ val }}">, use <div :class="val">.'
      )
    }
  }
  // class="..." 方法静态 class
  if (staticClass) {
    el.staticClass = JSON.stringify(staticClass)
  }
  // getBindingAttr 的第三个参数设为 false 表示取不到动态属性就也不取静态的（默认情况下会取静态的）
  const classBinding = getBindingAttr(el, 'class', false /* getStatic */)
  // v-bind:class 方式绑定的动态 class
  if (classBinding) {
    el.classBinding = classBinding
  }
}

/*
    返回一个字符串，形如：
    `staticClass:${el.staticClass},class:(${el.classBinding}),`
 */
function genData (el: ASTElement): string {
  let data = ''
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
  return data
}

// 导出的 class 模块
export default {
  staticKeys: ['staticClass'],
  transformNode,
  genData
}
