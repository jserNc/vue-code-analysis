/* @flow */

// 全局配置对象
import config from '../config'
// 初始化 vm._renderProxy 属性
import { initProxy } from './proxy'
// 初始化 props、methods、data、computed、watch
import { initState } from './state'
// 初始化 vm._vnode、vm._staticTrees、vm.$vnode、vm.$slots、vm.$scopedSlots、vm._c、vm.$createElement、vm.$attrs、vm.$listeners 等属性
import { initRender } from './render'
// 初始化 vm._events、vm._hasHookEvent，并更新事件监听
import { initEvents } from './events'
// mark 打标签，measure 测耗时
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
/*
  extend (to,_from) 用 _from 对象的属性覆盖 to 对象的属性
  mergeOptions (parent,child,vm) 合并 options 对象

  formatComponentName 函数的作用是格式化组件名：
  a. 组件名'aaa-bbb' -> "<AaaBbb>"
  b. 如果没有组件名，就用匿名，"<Anonymous>"
  c. 如果需要，还可以跟上文件名 "<AaaBbb> at aaa-bbb.vue"
*/
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

// 初始化混入，定义 Vue.prototype._init 函数
export function initMixin (Vue: Class<Component>) {
  // 这是 Vue 构造函数中唯一调用的方法，完成一系列初始化操作
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid，每个实例 vm 的 _uid 是唯一的
    vm._uid = uid++

    let startTag, endTag
    // 标记初始化开始
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-init:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 标志当前对象是 Vue 实例，有了这个标志就不会被 observe 了
    vm._isVue = true

    // 给 vm.$options 赋值
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 直接给 vm.$options 添加属性。优化内部组件实例化。由于动态选项合并相当慢，并且没有一个内部组件的选项需要特殊处理
      initInternalComponent(vm, options)
    } else {
      // 合并构造函数的 options 和参数 options
      vm.$options = mergeOptions(
        // 合并父构造函数和当前构造函数的 options
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }


    // 初始化 vm._renderProxy
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }

    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`${vm._name} init`, startTag, endTag)
    }

    // 将 vm 挂载到真实 dom 上
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// 给 vm.$options 添加属性
function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // vm.$options 继承构造函数的 options，即 vm.constructor.options 的所有属性
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  // vm.$options 依次继承 options 的内部组件相关属性
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/*
    看一看 Vue.options，最基本的有以下 4 个选项：
    {
        components: {KeepAlive: {…}, Transition: {…}, TransitionGroup: {…}},
        directives: {model: {…}, show: {…}},
        filters: {},
        _base: Vue
    }

    Vue.options = Object.create(null);

    ① Vue.options._base = Vue;

    ② ASSET_TYPES.forEach(function (type) {
        Vue.options[type + 's'] = Object.create(null);
    });
    -> 相当于：
    Vue.options.components = {};
    Vue.options.directives = {};
    Vue.options.filters = {};

    其中，Vue.options.components 会被以下语句修改：

    // 平台相关组件
    var platformComponents = {
        Transition: Transition,
        TransitionGroup: TransitionGroup
    };
    // 通用内置组件
    var builtInComponents = {
        KeepAlive: KeepAlive
    };

    extend(Vue$3.options.components, platformComponents);
    extend(Vue.options.components, builtInComponents);

    于是：
    Vue.options.components = {KeepAlive: {…}, Transition: {…}, TransitionGroup: {…}};

    其中，Vue.options.directives 会被以下语句修改：
    var platformDirectives = {
        model: model$1,
        show: show
    };

    extend(Vue$3.options.directives, platformDirectives);

    于是：
    Vue.options.directives = {model: {…}, show: {…}}
*/

/*
	① 父类构造函数存在，返回父构造函数选项 + 当前构造函数选项合并后的 Ctor.options
	② 否则，直接返回当前构造函数的 options
*/
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 如果当前构造函数 Ctor 有父类，那么对 Ctor.options 进行修正
  if (Ctor.super) {
    // 父类的 options，即 Ctor.super.options
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 缓存的父类 options
    const cachedSuperOptions = Ctor.superOptions
    
    // 如果缓存的父类 options 和最新的不一样，更新之
  	if (superOptions !== cachedSuperOptions) {
        // 更新缓存
        Ctor.superOptions = superOptions
        
        // 返回最近更新的 Ctor.options
        const modifiedOptions = resolveModifiedOptions(Ctor)
        
        // 更新子类扩展选项
        if (modifiedOptions) {
          // 更新修改的属性
          extend(Ctor.extendOptions, modifiedOptions)
        }
        // 子类选项 = 父类选项 + 子类扩展的选项
        options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
        if (options.name) {
          // 构造函数加入到数组 options.components 中
          options.components[options.name] = Ctor
        }
    }
  }
  return options
}

// 返回最近更新的 Ctor.options
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  
  // 对 Ctor.options 的每一项（数组）进行过滤，返回新的 Ctor.options
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      // 过滤数组 latest[key]，选出属于数组 extended[key] 或不属于数组 sealed[key] 的元素
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }

  return modified
}

/*
  ① latest 是数组，过滤数组 latest，选出属于 extended 或不属于 sealed 的元素
  ② 否则，直接返回 latest

  dedupe 的意思就是删除重复数据
*/
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated between merges
  // 比较 latest 和 sealed，以确保生命周期钩子在合并的时候不会重复
  if (Array.isArray(latest)) {
    const res = []
    // sealed 转为数组
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    // extended 转为数组
    extended = Array.isArray(extended) ? extended : [extended]
	
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      // 保留原始选项和没有被冰冻的选项，以排除重复选项
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
