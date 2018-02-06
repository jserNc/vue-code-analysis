/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import { parseStyleText } from 'web/util/style'
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
  const staticStyle = getAndRemoveAttr(el, 'style')
  if (staticStyle) {

    if (process.env.NODE_ENV !== 'production') {
      /*
          parseText 函数的作用是将模板字符串转为浏览器可以识别的常规字符串，例如：
          parseText('abc{{msg | fn}}efg')
          -> 'abc' + '_s(_f("fn")(msg))' + 'efg'

          注意：若参数不是插值写法，返回值就是 undefined
       */
      const expression = parseText(staticStyle, options.delimiters)
      if (expression) {
        // 警告：<div style="{{ val }}"> 属性内的插值这种写法已经不支持了。推荐使用 <div :style="val">
        warn(
          `style="${staticStyle}": ` +
          'Interpolation inside attributes has been removed. ' +
          'Use v-bind or the colon shorthand instead. For example, ' +
          'instead of <div style="{{ val }}">, use <div :style="val">.'
        )
      }
    }
    // style="..." 方法静态 style
    el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
  }

  // getBindingAttr 的第三个参数设为 false 表示取不到动态属性就也不取静态的（默认情况下会取静态的）
  const styleBinding = getBindingAttr(el, 'style', false /* getStatic */)
  // v-bind:style 方式绑定的动态 style
  if (styleBinding) {
    el.styleBinding = styleBinding
  }
}

/*
    返回一个字符串，形如：
    `staticStyle:${el.staticStyle},style:(${el.styleBinding}),`
 */
function genData (el: ASTElement): string {
  let data = ''
  if (el.staticStyle) {
    data += `staticStyle:${el.staticStyle},`
  }
  if (el.styleBinding) {
    data += `style:(${el.styleBinding}),`
  }
  return data
}

// 导出的 style 模块
export default {
  staticKeys: ['staticStyle'],
  transformNode,
  genData
}
