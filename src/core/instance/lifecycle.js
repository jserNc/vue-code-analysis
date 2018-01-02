/* @flow */

// 全局配置对象
import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'

// 一些工具方法
import { warn, noop, remove, handleError, emptyObject, validateProp } from '../util/index'

// 当前活动节点
export let activeInstance: any = null
// 是否正在更新子组件
export let isUpdatingChildComponent: boolean = false

// 生命周期初始化
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent
  // 修正 parent
  if (parent && !options.abstract) {
	// 找到第一个非抽象父组件（比如 keep-alive 和 transition，就是抽象组件）
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
	// 第一个非抽象父组件的子组件数组里加入 vm
    parent.$children.push(vm)
  }

  // 设置父组件
  vm.$parent = parent
  // 根组件
  vm.$root = parent ? parent.$root : vm

  // 设置子组件
  vm.$children = []
  // 设置引用
  vm.$refs = {}

  // 状态信息初始化
  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

// 定义 Vue.prototype._update、Vue.prototype.$forceUpdate、Vue.prototype.$destroy 等 3 个方法
export function lifecycleMixin (Vue: Class<Component>) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
	// 如果已经插入到文档中，那么更新之前调用 beforeUpdate 钩子回调函数
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }

	// 保存更新之前的节点信息
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance

	// 标记当前活动节点
    activeInstance = vm
    vm._vnode = vnode

    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) {
      // initial render，没有 prevVnode 就是第一次渲染
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      vm.$options._parentElm = vm.$options._refElm = null
    } else {
      // updates，不是第一次渲染，打补丁更新
      vm.$el = vm.__patch__(prevVnode, vnode)
    }

	// 更新完毕，把活动节点标记还原
    activeInstance = prevActiveInstance

    // update __vue__ reference
	// 旧的 vm.$el 释放对 __vue__ 属性引用
    if (prevEl) {
      prevEl.__vue__ = null
    }
	// 新的 vm.$el 添加 __vue__ 属性引用
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }

	
    // if parent is an HOC, update its $el as well
	// 如果 parent 是个高阶组件，顺便更新它的 $el 属性
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  // 强制重新渲染
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  // 销毁
  Vue.prototype.$destroy = function () {
    const vm: Component = this
	// 如果已经在销毁过程中，直接返回
    if (vm._isBeingDestroyed) {
      return
    }
	// 销毁前钩子函数
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
	  // 从父组件的子组件数组中移除
      remove(parent.$children, vm)
    }
    // teardown watchers，停止 watcher
    if (vm._watcher) {
      vm._watcher.teardown()
    }
	
	// 上面是 vm._watcher，这里是 vm._watchers
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
	// 引用数减 1
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook... 销毁完毕
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree，更新 dom 树，删除节点
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook，销毁钩子函数
    callHook(vm, 'destroyed')
    // turn off all instance listeners. 注销所有事件
    vm.$off()
    // remove __vue__ reference 删除 __vue__ 引用
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
  }
}

export function mountComponent (vm: Component, el: ?Element, hydrating?: boolean): Component {
  vm.$el = el
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listensers hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data && parentVnode.data.attrs
  vm.$listeners = listeners

  // update props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }
  // resolve slots + force update if has children
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

export function callHook (vm: Component, hook: string) {
  const handlers = vm.$options[hook]
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
