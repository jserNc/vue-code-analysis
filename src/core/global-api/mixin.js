/* @flow */

// mergeOptions (parent, child, vm) �ϲ����� options ����
import { mergeOptions } from '../util/index'

// ��װ Vue.mixin ����
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
	// �ϲ� Vue.options �� mixin ����
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
