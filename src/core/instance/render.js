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

// ��ʼ����Ⱦ
export function initRender (vm: Component) {
  // �����ĸ���the root of the child tree��
  vm._vnode = null
  vm._staticTrees = null
  // �����е�ռλ�ڵ㣨the placeholder node in parent tree��
  const parentVnode = vm.$vnode = vm.$options._parentVnode
  const renderContext = parentVnode && parentVnode.context
  /*
    ��̬��� vm.$slots �ṹ���£�
    {
      default : [...],
      name1 : [...],
      name2 : [...],
      ...
    }
   */
  vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext)
  // ��������
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  /*   
    createElement (context, tag, data, children, normalizationType, alwaysNormalize)
    �� createElement ������ʵ���������������Ϳ��Ի�ȡ�����ʵ���Ⱦ��������

    vm._c �� vm.$createElement ������������ alwaysNormalize ������ǰ�����ڲ������������ǹ���������
   
    �� vm._c �ڲ��汾��alwaysNormalize Ϊ false ʱ�����ԡ��򵥱�׼���������ǡ�������׼�������ɲ��� normalizationType ����
    �� vm.$createElement �����汾��alwaysNormalize Ϊ true ʱ��ǿ��ִ�С�������׼��������
   */
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in user-written render functions.
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data

  // �۲� vm.$attrs �� vm.$listeners ����
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', vm.$options._parentListeners, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    // ������Ϊ true ��ʾ���ݹ�۲� parentData.attrs/vm.$options._parentListeners �����������
    defineReactive(vm, '$attrs', parentData && parentData.attrs, null, true)
    defineReactive(vm, '$listeners', vm.$options._parentListeners, null, true)
  }
}

export function renderMixin (Vue: Class<Component>) {
  // �첽ִ��
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    /*
      es6 �⹹�﷨�������൱�ڣ�
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
        // ��Ȼ��¡�ڵ���������Զ�ȡ��ԭ�ڵ㣬���ǿ�¡�ڵ���һ���������µĶ���
        vm.$slots[key] = cloneVNodes(vm.$slots[key])
      }
    }

    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject

    // ��ʼ�� vm._staticTrees Ϊ������
    if (staticRenderFns && !vm._staticTrees) {
      vm._staticTrees = []
    }
    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode

    /*
      ���´���飬�򵥵�������һ�䣺
      vnode = render.call(vm._renderProxy, vm.$createElement)
      
      Ҳ���ǣ�
      vnode = vm.$options.render(vm.$createElement)
      ִ������ʱ�� render �����ڲ� this ָ�� vm._renderProxy
     */ 
    let vnode
    try {
      /*
        vm._renderProxy �������� vm��ֻ������ȡ�����ڵ�����ʱ�ᷢ������
        vm.$createElement �����������Ǵ��� vnode
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
      ������������

      �� Vue.prototype._update = function (vnode, hydrating) �����У�
         vm._vnode = vnode;

      �� updateComponent = function () {
           vm._update(vm._render(), hydrating);
         }

      �� Vue.prototype._render = function (){
          var _parentVnode = vm.$options._parentVnode;
          vm.$vnode = _parentVnode
          vnode.parent = _parentVnode

          return vnode
        }

      ע������
      vm.$vnode  ������� vm ��Ӧ�� _parentVnode�������е�ռλ�ڵ�
      vm._vnode  ������� vm ��Ӧ�� vnode�������������/ʵ�����ĸ�
     */
    vnode.parent = _parentVnode
    return vnode
  }

  // internal render helpers.
  // these are exposed on the instance prototype to reduce generated render code size.
  
  // ��Щ������¶��ԭ�����Լ������ɵ���Ⱦ����������
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
