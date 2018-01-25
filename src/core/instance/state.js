/* @flow */

import config from '../config'
import Dep from '../observer/dep'
import Watcher from '../observer/watcher'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  observerState,
  defineReactive
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 用 arget[key] 代理 this[sourceKey][key] 的 get/set 操作
export function proxy (target: Object, sourceKey: string, key: string) {
  // ① 获取 target[key] -> target[sourceKey][key]
  sharedPropertyDefinition.get = function proxyGetter () {
    // 这里的 this 指 target，可以通过打印 console.log('this === target:',this === target) 来验证
    return this[sourceKey][key]
  }
  // ② 设置 target[key] -> target[sourceKey][key] = val
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options

  // 初始化 vm._props 对象
  if (opts.props) initProps(vm, opts.props)

  /*
      ① 将 vm.$options["methods"] 对象里的每个方法挂载到 vm 对象上
      ② 将每个方法 methods[key] 内部的 this 绑定为 vm
  */
  if (opts.methods) initMethods(vm, opts.methods)

  if (opts.data) {
    /*
        做两件事：
        1. 代理。proxy(vm, "_data", key)，也就是对 vm[key] 的获取和设置操作的都是 vm["_data"][key]
        2. 劫持。observe(data, true)，劫持 data 属性的 get/set 操作
    */
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }

  // 计算属性初始化 vm._computedWatchers
  if (opts.computed) initComputed(vm, opts.computed)

  // 观察属性初始化
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// 检查类型，若 vm.$options[name] 不是对象，则发出警告
function checkOptionType (vm: Component, name: string) {
  const option = vm.$options[name]
  if (!isPlainObject(option)) {
    warn(
      `component option "${name}" should be an object.`,
      vm
    )
  }
}

/*
  function initProps (vm, propsOptions) 的作用是初始化 vm._props 对象
  
  initState(vm) 方法是这样调用 initProps 方法的：
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)

  也就是说，propsOptions 指的是 vm.$options.props
 */
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  /*
    ① vm.$options.propsData 提供每个 prop 的属性值
    var vm = new Comp({
      propsData: {
        msg: 'hello'
      }
    })
    创建实例时传递 props。主要作用是方便测试

    ② vm.$options.props 提供每个 prop 的约束条件
    Vue.component('example', {
      props: {
        msg : {
          type: String,
          required: true
        },
        num: {
          type: Number,
          default: 100
        }
      }
    })
   */
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.

  // 缓存属性 key 值，方便以后属性更新的时候可以用数组来迭代，而不是动态的枚举对象的 key 值
  const keys = vm.$options._propKeys = []

  const isRoot = !vm.$parent
  // root instance props should be converted
  observerState.shouldConvert = isRoot
  for (const key in propsOptions) {
    keys.push(key)
    /*
      validateProp 方法返回有效的属性值，其中：
      propsOptions 规定属性的约束条件
      propsData 提供属性值（一般是为了方便测试）
     */
    const value = validateProp(key, propsOptions, propsData, vm)

    
    /*
      简单地看，以下代码块就是一句代码：
      defineReactive(props, key, value)

      ① 若在新建 watcher = new Watcher() 实例时，获取 props[key] 属性，说明这个 watcher 对 props[key] 属性感兴趣，那么就收集这个 watcher；
      ② 在设置 props[key] = value 时，通知 watcher，然后 watcher 会执行相应的动作
     */
    if (process.env.NODE_ENV !== 'production') {
      // 警告：保留属性名不能用做 prop
      if (isReservedAttribute(key) || config.isReservedAttr(key)) {
        warn(
          `"${key}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        // 不要去改变 prop 值。因为在父组件重新渲染过程中会随时覆盖这个值。如果非要改变，推荐用 data 或 computed 属性。
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    
    // 用 vm[key] 代理 vm['_props'][key]
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  observerState.shouldConvert = true
}

/*
  做两件事：
  1. 代理。proxy(vm, "_data", key)，也就是对 vm[key] 的获取和设置操作的都是 vm["_data"][key]
  2. 劫持。observe(data, true)，劫持 data 属性的 get/set 操作
 */
function initData (vm: Component) {
  let data = vm.$options.data

  /*
   ① 如果 data 是函数，那就取这个函数的执行结果；
   ② 否则就取 data（若 data 不存在，取空对象 {}）
  */
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}

  // 确保 data 是对象
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // 1. data 代理（vm[key] 代理 vm._data[key]）
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    // a. 警告：data 里的属性名不应该和 methods 里的属性名重复
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // b. 警告：data 里的属性名也不应该和 props 里的属性名重复
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
  	  /*
    		代理 vm[key] 属性
    		① 获取 vm[key] -> vm._data[key]
    		② 设置 vm[key] -> vm._data[key] = val
  	  */
      proxy(vm, `_data`, key)
    }
  }

  // 2. data 劫持（data 的每个属性都是”活性的”）
  observe(data, true /* asRootData */)
}

// 返回 data 函数的执行结果（若执行过程中出错，那就返回空对象 {}）
function getData (data: Function, vm: Component): any {
  try {
    return data.call(vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化 vm._computedWatchers
function initComputed (vm: Component, computed: Object) {
  // 检查 vm.$options["computed"] 是否为对象，若不是对象，发出警告
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'computed')
  
  const watchers = vm._computedWatchers = Object.create(null)

  for (const key in computed) {
    const userDef = computed[key]
    // 属性 key 对应的函数，用于计算属性值
    let getter = typeof userDef === 'function' ? userDef : userDef.get
    
    // 确保 getter 是一个函数
    if (process.env.NODE_ENV !== 'production') {
      if (getter === undefined) {
        warn(
          `No getter function has been defined for computed property "${key}".`,
          vm
        )
        getter = noop
      }
    }
    
    // create internal watcher for the computed property.
    /*
      watchers[key] = new Watcher(vm, getter, noop, computedWatcherOptions)
      -> 这个实例新建过程会定义：watchers[key].getter = getter 和 watchers[key].value = watchers[key].get()
      -> 执行 watchers[key].get() 就是执行 watchers[key].getter.call(vm, vm)
      -> 也就是 watchers[key].value = getter.call(vm, vm)

      这样确实是获取到了计算属性值 watchers[key].value，那之后再怎么获取最新的计算属性值呢？
      这就靠下面的 defineComputed(vm, key, userDef) 了
     */
    watchers[key] = new Watcher(vm, getter, noop, computedWatcherOptions)

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // 定义计算属性 vm[key]
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        // 警告 1：该计算属性已经在 data 中定义了
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        // 警告 2：该计算属性已经在 props 中定义了 
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}


/*
  定义计算属性 key。简单地看：
  ① 获取 target[key] 会触发 createComputedGetter(key) 函数
  ② 设置 target[key] = val 会触发 userDef.set 函数
 */
// 定义计算属性 key。将计算属性 key 直接挂在到 vm 对象上，vm[key] 会触发计算属性重算
export function defineComputed (target: any, key: string, userDef: Object | Function) {
  // a. userDef 是函数，那就无视之
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = createComputedGetter(key)
    sharedPropertyDefinition.set = noop
  // b. userDef 是对象
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/*
  首先看一下这个函数执行的场景：
  经过 defineComputed(vm, key, userDef) 定义 key 为计算属性后：
  获取 vm[key] 
  -> computedGetter()
  -> 如果脏了，就执行 this._computedWatchers[key].evaluate() 重新计算属性值
  -> 返回属性值 this._computedWatchers[key].value
 */
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      /*
         某个 watcher 实例执行 get() 方法是，Dep.target 是有值的。
         a. watcher.get() 执行开始时，会执行 pushTarget(watcher) 也就是 Dep.target = watcher;
         a. watcher.get() 执行结束之前，会执行 popTarget() 也就是恢复原来的 Dep.target = targetStack.pop();
       
         这也印证了作者对 Watcher.prototype.get 函数的注释：
         "Evaluate the getter, and re-collect dependencies."
         计算 getter 并重新收集 dep 依赖

         走到这里，有两点可以确定：
         ① 某个 watcherA 在执行 get()
         ② 正在执行获取 vm[key]
         
         也就是说，若某个 watcherA 在执行 get() 的过程中（Dep.target 有值），获取了 vm[key]
         -> 说明这个新的动作也对 vm[key] 感兴趣，那就需要重新收集 key 的依赖了
         -> 重新收集 key 对应依赖就是，重新遍历 watcher 的 deps，将 watcher 分别加到各个 dep 的列表里
         -> 于是这个新的动作就可以触发 watcher 重新计算 vm[key] 的属性值
       */
      if (Dep.target) {
        // 收集依赖，也就是将 watcher 分别加到各个 dep 的列表里，dep 可以发通知给 watcher
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function initMethods (vm: Component, methods: Object) {
  // 检查 vm.$options["methods"] 是否为对象，若不是对象，发出警告
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'methods')
  
  const props = vm.$options.props
  for (const key in methods) {
    /*
      ① 将 vm.$options["methods"] 对象里的每个方法挂载到 vm 对象上
      ② 将每个方法 methods[key] 内部的 this 绑定为 vm
     */
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
    
    if (process.env.NODE_ENV !== 'production') {
      // 警告 1：methods[key] 不能是 null/undefined
      if (methods[key] == null) {
        warn(
          `method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 警告 2：key 已经被定义为一个 prop
      if (props && hasOwn(props, key)) {
        warn(
          `method "${key}" has already been defined as a prop.`,
          vm
        )
      }
    }
  }
}

function initWatch (vm: Component, watch: Object) {
  // 检查 vm.$options["watch"] 是否为对象，若不是对象，发出警告
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'watch')
  
  for (const key in watch) {
    const handler = watch[key]
    // ① handler 是函数组成的数组
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    // ② handler 是函数
    } else {
      // key 值变化时触发 handler 函数
      createWatcher(vm, key, handler)
    }
  }
}

// key 值变化时触发 handler 函数
function createWatcher (
  vm: Component,
  keyOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // ① 若 handler 为对象，修正为 handler.handler
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // ② 若 handler 为字符串，修正为 vm[handler]
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(keyOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }


  if (process.env.NODE_ENV !== 'production') {
    // 警告：根 $data 不能被修改
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    // 警告：$props 是只读的
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }

  // 给 Vue 的原型添加 $data 和 $props 属性，这样 vm 实例就可以调用了 vm.$data 和 vm.$props 了
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // 若 cb 是对象，调用 createWatcher 方法，然后将 cb 修正为 cb.handler，重新调用 vm.$watch(keyOrFn, cb.handler, options)
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }

    options = options || {}
    options.user = true
    /*
      将 expOrFn 和 cb 绑定起来，当 expOrFn 的值变了，就会触发 cb 方法

      watcher.update()
      -> watcher.run()
      -> watcher.cb.call(this.vm, value, oldValue)
      -> cb.call(this.vm, value, oldValue)
     */
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 指定了 options.immediate 为 true，则立即以当前值 watcher.value 触发回调函数 cb（而没有重新计算最新的 watcher.value）
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    /*
      m.$watch 返回一个取消观察函数，用来停止触发回调，例如：
      var unwatch = vm.$watch('a', cb)
      unwatch() // 取消观察
     */
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
