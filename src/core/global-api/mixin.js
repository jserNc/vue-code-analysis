/* @flow */

// mergeOptions (parent, child, vm) 合并两个 options 对象
import { mergeOptions } from '../util/index'

// 安装 Vue.mixin 方法
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
	// 合并 Vue.options 和 mixin 对象
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
