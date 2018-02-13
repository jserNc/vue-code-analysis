import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// 构造函数 Vue
function Vue (options) {
  // 在开发环境下，process.env.NODE_ENV 会替换为 "development"
  if (process.env.NODE_ENV !== 'production' && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// 定义 Vue.prototype._init 方法
initMixin(Vue)


/*
  定义以下 5 个属性/方法
  Vue.prototype.$data
  Vue.prototype.$props
  Vue.prototype.$set
  Vue.prototype.$delete
  Vue.prototype.$watch 
 */
stateMixin(Vue)


/*
  定义以下 4 个方法
  Vue.prototype.$on
  Vue.prototype.$once
  Vue.prototype.$off
  Vue.prototype.$emit
 */
eventsMixin(Vue)


/*
  定义以下 3 个方法
  Vue.prototype._update
  Vue.prototype.$forceUpdate
  Vue.prototype.$destroy
 */
lifecycleMixin(Vue)


/*
  定义以下多个方法
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
