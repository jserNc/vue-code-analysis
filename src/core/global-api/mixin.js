/* @flow */

import { mergeOptions } from '../util/index'

// 定义静态方法 Vue.mixin
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
		// 合并 Vue.options 和 mixin 对象
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}

