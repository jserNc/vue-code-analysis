import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// ���캯�� Vue
function Vue (options) {
  // �ڿ��������£�process.env.NODE_ENV ���滻Ϊ "development"
  if (process.env.NODE_ENV !== 'production' && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// ���� Vue.prototype._init ����
initMixin(Vue)
/*
  �������� 5 ������
  Vue.prototype.$data
  Vue.prototype.$props
  Vue.prototype.$set
  Vue.prototype.$delete
  Vue.prototype.$watch 
 */
stateMixin(Vue)
/*
  �������� 4 ������
  Vue.prototype.$on
  Vue.prototype.$once
  Vue.prototype.$off
  Vue.prototype.$emit
 */
eventsMixin(Vue)
/*
  �������� 3 ������
  Vue.prototype._update
  Vue.prototype.$forceUpdate
  Vue.prototype.$destroy
 */
lifecycleMixin(Vue)
/*
  �������¶������
  Vue.prototype.$nextTick
  Vue.prototype._render
  
  Vue.prototype._o = markOnce
  Vue.prototype._n = toNumber
  Vue.prototype._s = toString
  Vue.prototype._l = renderList
  Vue.prototype._t = renderSlot
  Vue.prototype._q = looseEqual
  Vue.prototype._i = looseIndexOf
  Vue.prototype._m = renderStatic
  Vue.prototype._f = resolveFilter
  Vue.prototype._k = checkKeyCodes
  Vue.prototype._b = bindObjectProps
  Vue.prototype._v = createTextVNode
  Vue.prototype._e = createEmptyVNode
  Vue.prototype._u = resolveScopedSlots
  Vue.prototype._g = bindObjectListeners
 */
renderMixin(Vue)

export default Vue
