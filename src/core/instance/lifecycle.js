/* @flow */

// 全局配置对象
import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { warn, noop, remove, handleError, emptyObject, validateProp } from '../util/index'

// 当前活动实例
export let activeInstance: any = null
// 是否正在更新子组件
export let isUpdatingChildComponent: boolean = false

// 生命周期初始化
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent

  /*
    vm 是非抽象组件才进入该代码块，修正 parent

    也就是说，若 vm 是抽象组件，没必要找到非抽象的祖先组件，那就不修正 parent
   */  
  if (parent && !options.abstract) {
    // 层层上溯遍历祖先组件，找到第一个非抽象祖先组件（比如 keep-alive 和 transition，就是抽象组件）
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // 第一个非抽象父组件的子组件数组里加入 vm
    parent.$children.push(vm)
  }

  // 设置父组件
  vm.$parent = parent
  // 根组件。若父组件有根组件取父组件根组件，否则 vm 自己就是根组件
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

    // 如果当前组件已经插入到文档中，那么更新之前调用 beforeUpdate 钩子函数
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

    // Vue.prototype.__patch__ is injected in entry points based on the rendering backend used.
    // ① 初次渲染该组件
    if (!prevVnode) {
      // initial render，没有 prevVnode 就是第一次渲染
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      // 初始化后，就不需要这俩引用了。释放之，以防止独立的 dom 树保存在内存中。
      vm.$options._parentElm = vm.$options._refElm = null
    // ② 对该组件进行打补丁更新
    } else {
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
    /*
      vm._watcher = new Watcher(vm, updateComponent, noop);
      
      ① vm._watcher.update() 触发 vm._watcher.run()
      ② vm._watcher.run() 执行 value = this.get()，触发 vm._watcher.get()
      ③ 执行 updateComponent()，这会导致视图再次更新
     */
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
    // 调用销毁前钩子函数
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent

    // 若父组件不是在销毁过程中，并且 vm 不是抽象组件，那就将 vm 从父组件的子组件数组中移除
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // 将订阅者 vm._watcher 从所有 dep 的订阅列表中移除
    if (vm._watcher) {
      vm._watcher.teardown()
    }
	
    // 注意，上面是 vm._watcher，这里是 vm._watchers。所有的订阅者都取消关注。
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

    // invoke destroy hooks on current rendered tree
    // 更新 dom 树，删除节点
    vm.__patch__(vm._vnode, null)

    // fire destroyed hook
    // 调用销毁钩子函数
    callHook(vm, 'destroyed')

    // turn off all instance listeners. 
    // 注销所有事件
    vm.$off()

    // remove __vue__ reference 删除 __vue__ 引用
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
  }
}

export function mountComponent (vm: Component, el: ?Element, hydrating?: boolean): Component {
  vm.$el = el

  // 若没有自定义的渲染方法，那就渲染方法置为 createEmptyVNode
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      // ① 有模板，没渲染方法
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') || vm.$options.el || el) {
        /*
          发出警告：你正在用只包含运行时的版本，这个版本的模板编译器是不可用的。可采取的方式有两种：
          ① 将模板预编译成渲染函数；
          ② 用包含模板编译器的版本
        */
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      // ② 既没有模板，又没有渲染方法
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }

  // 组件安装前钩子函数
  callHook(vm, 'beforeMount')

  let updateComponent
  
  /* 
    简化一下下面的 if-else 代码块：
    vnode = vm._render();
    vm._update(vnode, hydrating);

    其中，vm._render() 的作用就是生成虚拟节点 vnode
   */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      // 计算生成虚拟节点耗时
      measure(`${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      // 计算将虚拟节点更新到 dom 耗时
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
   /*
        注意区别：
        vm.$vnode  保存的是 vm 对应的 _parentVnode，父树中的占位节点
        vm._vnode  保存的是 vm 对应的 vnode，子树的根

        若没有父组件，到这里就可以认为当前 vm 组件已经更新到 dom 中了
    */
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

// 更新子组件
export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  // 标志正在更新子组件
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  const hasChildren = !!(
    renderChildren ||               // has new static slots 有新的静态 slots
    vm.$options._renderChildren ||  // has old static slots 有旧的静态 slots
    parentVnode.data.scopedSlots || // has new scoped slots 有新的作用域 slots
    vm.$scopedSlots !== emptyObject // has old scoped slots 有旧的作用域 slots
  )

  // ① 更新父节点
  vm.$options._parentVnode = parentVnode
  // vm 对应的占位节点
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    // 更新子树的 parent
    vm._vnode.parent = parentVnode
  }

  // ② 更新子节点
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listensers hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data && parentVnode.data.attrs
  vm.$listeners = listeners

  // ③ 更新 props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      // validateProp() 返回修正后的有效属性值
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // ④ 更新监听 listeners
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }

  // resolve slots + force update if has children
  // ⑤ 更新插槽
  /*
    如果有插槽 slots
    ① 解析插槽
    ② 强制更新 vm 组件
   */
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  // 更新完毕，标志组件不处在更新状态
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

// 是否在非活动树中
function isInInactiveTree (vm) {
  // 从父元素开始依次遍历祖先实例，只要有一个祖先实例拥有 _Inactive 属性（失效状态），就返回 true
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

// 激活子组件
export function activateChildComponent (vm: Component, direct?: boolean) {
  // ① vm._directInactive 置为 false，标志激活
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }

  // ② vm._inactive 置为 false，标志激活
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      // 递归使激活子组件
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

// 使子组件失效
export function deactivateChildComponent (vm: Component, direct?: boolean) {
  // ① vm._directInactive 置为 true，标志失效
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  // ② vm._inactive 置为 true，标志失效
  if (!vm._inactive) {
    vm._inactive = true
    // 递归使子组件失效
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

/*
    比如，传进来的钩子名是 'beforeUpdate'，而之前我们还监听了事件 'hook:beforeUpdate'
    那么，callHook(vm,'evtA') 会导致：
    ① 执行钩子 'beforeUpdate' 的所有回调函数
    ② 执行事件 'hook:beforeUpdate' 的所有回调函数
*/
export function callHook (vm: Component, hook: string) {
  const handlers = vm.$options[hook]
  // ① 执行钩子 hook 对应的所有回调函数
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  // ② 执行钩子对应的事件 'hook:' + hook 的所有回调函数
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
