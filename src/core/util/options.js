/* @flow */

import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'


/*
  config.optionMergeStrategies = Object.create(null)
  后续会给 strats 对象添加多个属性，每个属性都是函数，函数的作用就是定义该属性的合并策略
 */
const strats = config.optionMergeStrategies


// 添加 el、propsData 属性的合并策略
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

// 递归地合并两个对象
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]w
    fromVal = from[key]
    // 把 from 的属性（该属性在 to 中不存在）合并到 to 中，所以这个函数只会给 to 对象添加新的属性，而不会覆盖原有属性
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    // 递归合并子对象
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

// 调用 mergeData 方法合并数据
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // ① vm 参数不存在，返回 mergeData() 的值
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this) : childVal,
        parentVal.call(this)
      )
    }
  // ② vm 参数存在，返回 mergeData() 的值或 parentVal.call(vm) 的值
  } else if (parentVal || childVal) {
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function' ? childVal.call(vm) : childVal
      const defaultData = typeof parentVal === 'function' ? parentVal.call(vm): undefined

      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// 添加 data 属性的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // ① vm 参数不存在
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      // 警告：data 选项应该是一个函数，这样才能为每一组件实例生成独立的 data 对象
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    // mergeDataOrFn 函数执行时没第三个 vm 参数
    return mergeDataOrFn.call(this, parentVal, childVal)
  }
  // ① vm 参数存在，mergeDataOrFn 函数执行时有第三个 vm 参数
  return mergeDataOrFn(parentVal, childVal, vm)
}

// 将 Hooks 和 props 合并为数组
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  /*
    字面意思是：
    (1) childVal 为真值
        ① parentVal 为真值，返回 parentVal.concat(childVal)
        ② parentVal 为假值
           a) childVal 是数组，直接返回 childVal
           b) childVal 不是数组，返回 [childVal]

    (2) childVal 为假值，返回 parentVal

    实际意思是：
    (1) childVal 为函数或函数组成的数组
        ① parentVal 为函数或函数组成的数组，返回 parentVal.concat(childVal)
        ② parentVal 参数不存在
           a) childVal 是数组，直接返回 childVal
           b) childVal 不是数组，返回 [childVal]
    (2) childVal 为假，直接返回 parentVal 数组
   */
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

/*
  var LIFECYCLE_HOOKS = [
    'beforeCreate',
    'created',
    'beforeMount',
    'mounted',
    'beforeUpdate',
    'updated',
    'beforeDestroy',
    'destroyed',
    'activated',
    'deactivated'
  ];
 */
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (parentVal: ?Object, childVal: ?Object): Object {
  const res = Object.create(parentVal || null)
  /*
    ① 以 parentVal 为原型创建对象 res
    ② 如果 childVal 为真值，那就将 childVal 的属性都赋给 res，否则直接返回 res
   */
  return childVal
    ? extend(res, childVal)
    : res
}

/*
     // 配置类型
     var ASSET_TYPES = [
       'component',
       'directive',
       'filter'
     ];

     于是：
     strats.components = mergeAssets;
     strats.directives = mergeAssets;
     strats.filters = mergeAssets;
*/
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})


// Watchers 合并的时候不能覆盖，所以将每一项都拼接成数组
strats.watch = function (parentVal: ?Object, childVal: ?Object): ?Object {
  /*
    火狐浏览器有原生的 watch 方法： nativeWatch = ({}).watch;
    如果 parentVal/childVal 是原生的 watch 方法，那就是误取，将其重置为 undefined
   */
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined

  
  if (!childVal) return Object.create(parentVal || null)
  if (!parentVal) return childVal

  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    /*
      ① 如果 parent 是数组，ret[key] = parent.concat(child)
      ② 否则返回数组形式的 child
     */
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  /*
    最终返回的 ret 形式为：
    {
      key1 : [...],
      key2 : [...],
      ...
    }
  */
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (parentVal: ?Object, childVal: ?Object): ?Object {
  // ① parentVal 参数为假，返回 childVal
  if (!parentVal) return childVal

  const ret = Object.create(null)
  extend(ret, parentVal)
  // ② 用 childVal 的每一项覆盖 parentVal 每一项，也就是说 childVal 中的属性优先级更高
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn

// 默认的合并策略
const defaultStrat = function (parentVal: any, childVal: any): any {
  // 除非 childVal 是 undefined，否则一直返回 childVal
  return childVal === undefined
    ? parentVal
    : childVal
}

// 打印出不合要求的组件名
function checkComponents (options: Object) {
  for (const key in options.components) {
    const lower = key.toLowerCase()
    /*
      判断是否为内置标签名 isBuiltInTag = makeMap('slot,component', true);
      判断是否为保留标签名 isReservedTag = function (tag) {return isHTMLTag(tag) || isSVG(tag)}
     */
    if (isBuiltInTag(lower) || config.isReservedTag(lower)) {
      warn(
        'Do not use built-in or reserved HTML elements as component ' +
        'id: ' + key
      )
    }
  }
}

/*
  将 options.props 格式化为对象的键值对形式：
  {
    propA: { type: Number },
    propB: { type : [String, Number] },
    propC: {
      type: String,
      required: true
    },
    propD: {
      type: Number,
      default: 100
    },
    propE: {
      type: Object,
      default: function () {
        return { message: 'hello' }
      }
    },
    propF: {
      validator: function (value) {
        return value > 10
      }
    }
  }
*/
function normalizeProps (options: Object) {
  const props = options.props
  if (!props) return

  const res = {}
  let i, val, name
  /*
    ① options.props 是数组，如：
       options.props : ['propA','propB','propC','propD']
       -> options.props = {
          propA : { type: null },
          propB : { type: null },
          propC : { type: null },
          propD : { type: null }
       }
   */
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  /*
    ① options.props 是对象，如：
      options.props : {
        propA: Number,
        propB: {
          type: String,
          required: true
        },
        propC: [String, Number]
      }
      -> options.props = {
        propA : { type: Number },
        propB : {
          type: String,
          required: true
        },
        propC: { type : [String, Number] }
     }
   */
  } else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  }
  options.props = res
}


/*
  将 options.inject 格式化为对象的键值对形式：
  options.inject ： ['bar','foo']
  -> {
    bar : 'bar',
    foo : 'foo'
  }
 */
function normalizeInject (options: Object) {
  const inject = options.inject
  if (Array.isArray(inject)) {
    const normalized = options.inject = {}
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = inject[i]
    }
  }
}

/**
 * Normalize raw function directives into object format.
 */
/*
  将函数形式的指令格式为对象的键值对形式：
  options.directives : {
    dirA : fn
  }
  -> options.directives : {
    dirA : { bind: fn, update: fn }
  }
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
// 将两个选项对象合并成一个新的选项对象
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== 'production') {
    // 打印出不合要求的组件名
    checkComponents(child)
  }

  // 修正 child 对象
  if (typeof child === 'function') {
    child = child.options
  }

  // 将 child.props 的每一项都格式化成对象格式
  normalizeProps(child);
  // 将数组 options.inject 转化为对象格式
  normalizeInject(child);
  // 将 child.directives 的每一项都格式化成对象格式
  normalizeDirectives(child);

  // 递归修正 parent 对象
  const extendsFrom = child.extends
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }


  const options = {}
  let key
  // ① 遍历 parent 对象的属性，合并
  for (key in parent) {
    mergeField(key)
  }
  // ② 遍历 (child - parent) 差集的属性，合并
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  // 合并 key 属性
  function mergeField (key) {
    /*
    a) strats = config.optionMergeStrategies 是一个对象，可以为该对象添加方法属性，自定义合并策略的选项
    strats[key] 是一个 function，不同的 key 对应不同的 function，也就是不同的合并策略
    
    b) defaultStrat 是一个函数，defaultStrat(parentVal, childVal)，只要 childVal 不是 undefined，那就返回 childVal，childVal 全等于 undefined，才返回 parentVal

    也就是说，如果没有对某个 key 属性指定合并策略，就用默认的策略 defaultStrat
    */
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}


// 根据 id 返回对应的资源（这个函数应用的场景多为子实例去原型链中找对应的资源）
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]

  // ① id/camelizedId/PascalCaseId 若为 options[type] 对象自有的属性
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]

  // ② 不是 options[type] 对象自有的属性，那就取原型链找
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]

  // ③ 以上两种途径都没找到，报警
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
