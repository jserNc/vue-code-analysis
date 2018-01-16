/* @flow */

import {
  warn,
  nextTick,
  toNumber,
  toString,
  looseEqual,
  emptyObject,
  handleError,
  looseIndexOf,
  defineReactive
} from '../util/index'

import VNode, {
  cloneVNodes,
  createTextVNode,
  createEmptyVNode
} from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

import { createElement } from '../vdom/create-element'
import { renderList } from './render-helpers/render-list'
import { renderSlot } from './render-helpers/render-slot'
import { resolveFilter } from './render-helpers/resolve-filter'
import { checkKeyCodes } from './render-helpers/check-keycodes'
import { bindObjectProps } from './render-helpers/bind-object-props'
import { renderStatic, markOnce } from './render-helpers/render-static'
import { bindObjectListeners } from './render-helpers/bind-object-listeners'
import { resolveSlots, resolveScopedSlots } from './render-helpers/resolve-slots'

// 初始化渲染
export function initRender (vm: Component) {
  // 子树的根（the root of the child tree）
  vm._vnode = null
  vm._staticTrees = null
  // 父树中的占位节点（the placeholder node in parent tree）
  const parentVnode = vm.$vnode = vm.$options._parentVnode
  const renderContext = parentVnode && parentVnode.context
  /*
    静态插槽 vm.$slots 结构如下：
    {
      default : [...],
      name1 : [...],
      name2 : [...],
      ...
    }
   */
  vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext)
  // 作用域插槽
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  /*   
    createElement (context, tag, data, children, normalizationType, alwaysNormalize)
    将 createElement 方法和实例绑定起来，这样就可以获取到合适的渲染上下文了

    vm._c 和 vm.$createElement 的区别是最后的 alwaysNormalize 参数。前者是内部方法，后者是公共方法。
   
    ① vm._c 内部版本：alwaysNormalize 为 false 时，是以“简单标准化处理”还是“正常标准化处理”由参数 normalizationType 决定
    ② vm.$createElement 公共版本：alwaysNormalize 为 true 时，强制执行“正常标准化处理”。
   */
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in user-written render functions.
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data

  // 观察 vm.$attrs 和 vm.$listeners 属性
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', vm.$options._parentListeners, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    // 最后参数为 true 表示不递归观察 parentData.attrs/vm.$options._parentListeners 对象的子属性
    defineReactive(vm, '$attrs', parentData && parentData.attrs, null, true)
    defineReactive(vm, '$listeners', vm.$options._parentListeners, null, true)
  }
}

export function renderMixin (Vue: Class<Component>) {
  // 异步执行
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    /*
      es6 解构语法，以下相当于：
      var render = vm.$options.render;
      var staticRenderFns = vm.$options.staticRenderFns;
      var _parentVnode = vm.$options._parentVnode;
     */
    const {
      render,
      staticRenderFns,
      _parentVnode
    } = vm.$options

    if (vm._isMounted) {
      // clone slot nodes on re-renders
      for (const key in vm.$slots) {
        // 虽然克隆节点的所有属性都取自原节点，但是克隆节点是一个独立的新的对象
        vm.$slots[key] = cloneVNodes(vm.$slots[key])
      }
    }

    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject

    // 初始化 vm._staticTrees 为空数组
    if (staticRenderFns && !vm._staticTrees) {
      vm._staticTrees = []
    }
    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode

    /*
      以下代码块，简单的理解就是一句：
      vnode = render.call(vm._renderProxy, vm.$createElement)
      
      也就是：
      vnode = vm.$options.render(vm.$createElement)
      执行这句的时候 render 函数内部 this 指向 vm._renderProxy
     */ 
    let vnode
    try {
      /*
        vm._renderProxy 简单理解就是 vm，只不过获取不存在的属性时会发出警告
        vm.$createElement 函数的作用是创建 vnode
       */
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render function`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        vnode = vm.$options.renderError
          ? vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          : vm._vnode
      } else {
        vnode = vm._vnode
      }
    }

    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    
    /*
      看几个函数：

      ① Vue.prototype._update = function (vnode, hydrating) 函数中：
         vm._vnode = vnode;

      ② updateComponent = function () {
           vm._update(vm._render(), hydrating);
         }

      ③ Vue.prototype._render = function (){
          var _parentVnode = vm.$options._parentVnode;
          vm.$vnode = _parentVnode
          vnode.parent = _parentVnode

          return vnode
        }

      注意区别：
      vm.$vnode  保存的是 vm 对应的 _parentVnode，父树中的占位节点
      vm._vnode  保存的是 vm 对应的 vnode，子树（子组件/实例）的根
     */
    vnode.parent = _parentVnode
    return vnode
  }

  // internal render helpers.
  // these are exposed on the instance prototype to reduce generated render code size.
  
  // 这些方法暴露在原型上以减少生成的渲染函数代码量
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
}
