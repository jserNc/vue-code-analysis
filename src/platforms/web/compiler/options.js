/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,          // [klass,style]
  directives,       // { model,text,html }
  isPreTag,         // 是否为 pre 标签
  isUnaryTag,       // 是否为单标签（不需要闭合标签）
  mustUseProp,      // 是否要使用 prop（某些特殊情形需要用 prop 而不是 attr）
  canBeLeftOpenTag, // 是否是可以不闭合的标签（它们会自己闭合)
  isReservedTag,    // 是否为 html/svg 保留标签名
  getTagNamespace,  // 获取标签的命名空间(返回值为 'svg'、'math' 等)
  staticKeys: genStaticKeys(modules) // 'staticStyle,staticClass'
}
