/* @flow */

import { mergeOptions } from '../util/index'

// ���徲̬���� Vue.mixin
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
		// �ϲ� Vue.options �� mixin ����
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}

