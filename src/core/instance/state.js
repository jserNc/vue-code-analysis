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

// �� arget[key] ���� this[sourceKey][key] �� get/set ����
export function proxy (target: Object, sourceKey: string, key: string) {
  // �� ��ȡ target[key] -> target[sourceKey][key]
  sharedPropertyDefinition.get = function proxyGetter () {
    // ����� this ָ target������ͨ����ӡ console.log('this === target:',this === target) ����֤
    return this[sourceKey][key]
  }
  // �� ���� target[key] -> target[sourceKey][key] = val
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options

  // ��ʼ�� vm._props ����
  if (opts.props) initProps(vm, opts.props)

  /*
      �� �� vm.$options["methods"] �������ÿ���������ص� vm ������
      �� ��ÿ������ methods[key] �ڲ��� this ��Ϊ vm
  */
  if (opts.methods) initMethods(vm, opts.methods)

  if (opts.data) {
    /*
        �������£�
        1. ����proxy(vm, "_data", key)��Ҳ���Ƕ� vm[key] �Ļ�ȡ�����ò����Ķ��� vm["_data"][key]
        2. �ٳ֡�observe(data, true)���ٳ� data ���Ե� get/set ����
    */
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }

  // �������Գ�ʼ�� vm._computedWatchers
  if (opts.computed) initComputed(vm, opts.computed)

  // �۲����Գ�ʼ��
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// ������ͣ��� vm.$options[name] ���Ƕ����򷢳�����
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
  function initProps (vm, propsOptions) �������ǳ�ʼ�� vm._props ����
  
  initState(vm) �������������� initProps �����ģ�
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)

  Ҳ����˵��propsOptions ָ���� vm.$options.props
 */
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  /*
    �� vm.$options.propsData �ṩÿ�� prop ������ֵ
    var vm = new Comp({
      propsData: {
        msg: 'hello'
      }
    })
    ����ʵ��ʱ���� props����Ҫ�����Ƿ������

    �� vm.$options.props �ṩÿ�� prop ��Լ������
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

  // �������� key ֵ�������Ժ����Ը��µ�ʱ������������������������Ƕ�̬��ö�ٶ���� key ֵ
  const keys = vm.$options._propKeys = []

  const isRoot = !vm.$parent
  // root instance props should be converted
  observerState.shouldConvert = isRoot
  for (const key in propsOptions) {
    keys.push(key)
    /*
      validateProp ����������Ч������ֵ�����У�
      propsOptions �涨���Ե�Լ������
      propsData �ṩ����ֵ��һ����Ϊ�˷�����ԣ�
     */
    const value = validateProp(key, propsOptions, propsData, vm)

    
    /*
      �򵥵ؿ������´�������һ����룺
      defineReactive(props, key, value)

      �� �����½� watcher = new Watcher() ʵ��ʱ����ȡ props[key] ���ԣ�˵����� watcher �� props[key] ���Ը���Ȥ����ô���ռ���� watcher��
      �� ������ props[key] = value ʱ��֪ͨ watcher��Ȼ�� watcher ��ִ����Ӧ�Ķ���
     */
    if (process.env.NODE_ENV !== 'production') {
      // ���棺������������������ prop
      if (isReservedAttribute(key) || config.isReservedAttr(key)) {
        warn(
          `"${key}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        // ��Ҫȥ�ı� prop ֵ����Ϊ�ڸ����������Ⱦ�����л���ʱ�������ֵ�������Ҫ�ı䣬�Ƽ��� data �� computed ���ԡ�
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
    
    // �� vm[key] ���� vm['_props'][key]
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  observerState.shouldConvert = true
}

/*
  �������£�
  1. ����proxy(vm, "_data", key)��Ҳ���Ƕ� vm[key] �Ļ�ȡ�����ò����Ķ��� vm["_data"][key]
  2. �ٳ֡�observe(data, true)���ٳ� data ���Ե� get/set ����
 */
function initData (vm: Component) {
  let data = vm.$options.data

  /*
   �� ��� data �Ǻ������Ǿ�ȡ���������ִ�н����
   �� �����ȡ data���� data �����ڣ�ȡ�ն��� {}��
  */
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}

  // ȷ�� data �Ƕ���
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // 1. data ����vm[key] ���� vm._data[key]��
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    // a. ���棺data �����������Ӧ�ú� methods ����������ظ�
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // b. ���棺data ���������Ҳ��Ӧ�ú� props ����������ظ�
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
  	  /*
    		���� vm[key] ����
    		�� ��ȡ vm[key] -> vm._data[key]
    		�� ���� vm[key] -> vm._data[key] = val
  	  */
      proxy(vm, `_data`, key)
    }
  }

  // 2. data �ٳ֣�data ��ÿ�����Զ��ǡ����Եġ���
  observe(data, true /* asRootData */)
}

// ���� data ������ִ�н������ִ�й����г����Ǿͷ��ؿն��� {}��
function getData (data: Function, vm: Component): any {
  try {
    return data.call(vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  }
}

const computedWatcherOptions = { lazy: true }

// ��ʼ�� vm._computedWatchers
function initComputed (vm: Component, computed: Object) {
  // ��� vm.$options["computed"] �Ƿ�Ϊ���������Ƕ��󣬷�������
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'computed')
  
  const watchers = vm._computedWatchers = Object.create(null)

  for (const key in computed) {
    const userDef = computed[key]
    // ���� key ��Ӧ�ĺ��������ڼ�������ֵ
    let getter = typeof userDef === 'function' ? userDef : userDef.get
    
    // ȷ�� getter ��һ������
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
      -> ���ʵ���½����̻ᶨ�壺watchers[key].getter = getter �� watchers[key].value = watchers[key].get()
      -> ִ�� watchers[key].get() ����ִ�� watchers[key].getter.call(vm, vm)
      -> Ҳ���� watchers[key].value = getter.call(vm, vm)

      ����ȷʵ�ǻ�ȡ���˼�������ֵ watchers[key].value����֮������ô��ȡ���µļ�������ֵ�أ�
      ��Ϳ������ defineComputed(vm, key, userDef) ��
     */
    watchers[key] = new Watcher(vm, getter, noop, computedWatcherOptions)

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // ����������� vm[key]
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        // ���� 1���ü��������Ѿ��� data �ж�����
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        // ���� 2���ü��������Ѿ��� props �ж����� 
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}


/*
  ����������� key���򵥵ؿ���
  �� ��ȡ target[key] �ᴥ�� createComputedGetter(key) ����
  �� ���� target[key] = val �ᴥ�� userDef.set ����
 */
// ����������� key������������ key ֱ�ӹ��ڵ� vm �����ϣ�vm[key] �ᴥ��������������
export function defineComputed (target: any, key: string, userDef: Object | Function) {
  // a. userDef �Ǻ������Ǿ�����֮
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = createComputedGetter(key)
    sharedPropertyDefinition.set = noop
  // b. userDef �Ƕ���
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
  ���ȿ�һ���������ִ�еĳ�����
  ���� defineComputed(vm, key, userDef) ���� key Ϊ�������Ժ�
  ��ȡ vm[key] 
  -> computedGetter()
  -> ������ˣ���ִ�� this._computedWatchers[key].evaluate() ���¼�������ֵ
  -> ��������ֵ this._computedWatchers[key].value
 */
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      /*
         ĳ�� watcher ʵ��ִ�� get() �����ǣ�Dep.target ����ֵ�ġ�
         a. watcher.get() ִ�п�ʼʱ����ִ�� pushTarget(watcher) Ҳ���� Dep.target = watcher;
         a. watcher.get() ִ�н���֮ǰ����ִ�� popTarget() Ҳ���ǻָ�ԭ���� Dep.target = targetStack.pop();
       
         ��Ҳӡ֤�����߶� Watcher.prototype.get ������ע�ͣ�
         "Evaluate the getter, and re-collect dependencies."
         ���� getter �������ռ� dep ����

         �ߵ�������������ȷ����
         �� ĳ�� watcherA ��ִ�� get()
         �� ����ִ�л�ȡ vm[key]
         
         Ҳ����˵����ĳ�� watcherA ��ִ�� get() �Ĺ����У�Dep.target ��ֵ������ȡ�� vm[key]
         -> ˵������µĶ���Ҳ�� vm[key] ����Ȥ���Ǿ���Ҫ�����ռ� key ��������
         -> �����ռ� key ��Ӧ�������ǣ����±��� watcher �� deps���� watcher �ֱ�ӵ����� dep ���б���
         -> ��������µĶ����Ϳ��Դ��� watcher ���¼��� vm[key] ������ֵ
       */
      if (Dep.target) {
        // �ռ�������Ҳ���ǽ� watcher �ֱ�ӵ����� dep ���б��dep ���Է�֪ͨ�� watcher
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function initMethods (vm: Component, methods: Object) {
  // ��� vm.$options["methods"] �Ƿ�Ϊ���������Ƕ��󣬷�������
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'methods')
  
  const props = vm.$options.props
  for (const key in methods) {
    /*
      �� �� vm.$options["methods"] �������ÿ���������ص� vm ������
      �� ��ÿ������ methods[key] �ڲ��� this ��Ϊ vm
     */
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
    
    if (process.env.NODE_ENV !== 'production') {
      // ���� 1��methods[key] ������ null/undefined
      if (methods[key] == null) {
        warn(
          `method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // ���� 2��key �Ѿ�������Ϊһ�� prop
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
  // ��� vm.$options["watch"] �Ƿ�Ϊ���������Ƕ��󣬷�������
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'watch')
  
  for (const key in watch) {
    const handler = watch[key]
    // �� handler �Ǻ�����ɵ�����
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    // �� handler �Ǻ���
    } else {
      // key ֵ�仯ʱ���� handler ����
      createWatcher(vm, key, handler)
    }
  }
}

// key ֵ�仯ʱ���� handler ����
function createWatcher (
  vm: Component,
  keyOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // �� �� handler Ϊ��������Ϊ handler.handler
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // �� �� handler Ϊ�ַ���������Ϊ vm[handler]
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
    // ���棺�� $data ���ܱ��޸�
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    // ���棺$props ��ֻ����
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }

  // �� Vue ��ԭ����� $data �� $props ���ԣ����� vm ʵ���Ϳ��Ե����� vm.$data �� vm.$props ��
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
    // �� cb �Ƕ��󣬵��� createWatcher ������Ȼ�� cb ����Ϊ cb.handler�����µ��� vm.$watch(keyOrFn, cb.handler, options)
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }

    options = options || {}
    options.user = true
    /*
      �� expOrFn �� cb ���������� expOrFn ��ֵ���ˣ��ͻᴥ�� cb ����

      watcher.update()
      -> watcher.run()
      -> watcher.cb.call(this.vm, value, oldValue)
      -> cb.call(this.vm, value, oldValue)
     */
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // ָ���� options.immediate Ϊ true���������Ե�ǰֵ watcher.value �����ص����� cb����û�����¼������µ� watcher.value��
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    /*
      m.$watch ����һ��ȡ���۲캯��������ֹͣ�����ص������磺
      var unwatch = vm.$watch('a', cb)
      unwatch() // ȡ���۲�
     */
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
