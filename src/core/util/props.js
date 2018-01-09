/* @flow */

import { warn } from './debug'
import { observe, observerState } from '../observer/index'
import {
  hasOwn,
  isObject,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

// 验证 props 中的属性值，并返回一个经过校验的有效的值
export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]

  // ① 布尔类型 prop，修正 value 为 true/false
  if (isType(Boolean, prop.type)) {
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (!isType(String, prop.type) && (value === '' || value === hyphenate(key))) {
      value = true
    }
  }

  // ② 如果 value 是 undefined，那就取默认值
  if (value === undefined) {
    // 获取默认值
    value = getPropDefaultValue(vm, prop, key)

    const prevShouldConvert = observerState.shouldConvert
    observerState.shouldConvert = true
    /*
      由于 getPropDefaultValue 方法返回的 value 默认值是个新的副本，所以得观察这个对象
      observe 方法中 observerState.shouldConvert 必须为 true，才能真正起到观察 value 对象的作用
      从这里也可以看到，不光是 data 的值数据要被观察，props 数据一样要被观察
     */ 
    observe(value)
    observerState.shouldConvert = prevShouldConvert
  }

  // ③ 对代码流程没影响，只是验证属性的有效性，对不符合要求的值发出 3 种警告
  if (process.env.NODE_ENV !== 'production') {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/*
  例如：
  age: {
    type: Number,
    default: 0,
    required: true,
    validator: function (value) {
      return value >= 0
    }
  }
 */
// 获取属性 prop 的默认 value 值
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // 当前 prop 没有指定 default 属性，返回 undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // Object/Array 必须由一个工厂方法返回
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  
  // 返回先前的默认值
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  
  /*
    ① 如果 prop.default 是个函数，并且 prop.type 不是函数，就将这个函数的执行结果作为 prop 的默认值
    ② 如果 prop.type 也是函数，那就直接返回这个函数作为 prop 的默认值
   */
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

// 对代码流程没影响，只是验证属性的有效性，对不符合要求的发出 3 种警告
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  // ① prop 必需，并且 key 不是 propsData 自身属性。发出第 1 种警告，然后返回
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }

  // 若为非必需项，直接返回就好
  if (value == null && !prop.required) {
    return
  }

  let type = prop.type
  // 没有指定 type 或 type 为 true 时，valid 暂定为 true
  let valid = !type || type === true

  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    // 只要 valid 变为 true，就终止该循环。也就是说，只要 value 匹配到 type 数组中任一类型即可
    for (let i = 0; i < type.length && !valid; i++) {
      /*
      assertedType 的格式为：
      {
        valid: valid,
        expectedType: expectedType
      }
      */
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  // ② 若遍历完了 type 数组仍然没有找到一个匹配类型，说明类型不符合要求。发出第 2 种警告，然后返回
  if (!valid) {
    warn(
      'Invalid prop: type check failed for prop "' + name + '".' +
      /*
        例如：expectedTypes = ['myFunc','Object','Array']
        expectedTypes.map(capitalize).join(', ') -> "MyFunc, Object, Array"
      */
      ' Expected ' + expectedTypes.map(capitalize).join(', ') +
      /*
        例如：Object.prototype.toString.call(1) -> "[object Number]"
        "[object Number]".slice(8, -1) -> "Number"
      */
      ', got ' + Object.prototype.toString.call(value).slice(8, -1) + '.',
      vm
    )
    return
  }

  const validator = prop.validator
  // ③ 如果该属性有自定义验证器，就用验证器检验之，没通过验证器检验，则发出第 3 种警告
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

// 判断 value 是否是 type 类型的实例。返回一个 json 对象
function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  // 获取函数 type 的名称
  const expectedType = getType(type)

  // ① type 是 String|Number|Boolean|Function|Symbol 其中之一，value 是其实例
  if (simpleCheckRE.test(expectedType)) {
    valid = typeof value === expectedType.toLowerCase()
  // ② value 是对象
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  // ③ value 是数组
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  // ④ value 是构造函数 type 的实例
  } else {
    valid = value instanceof type
  }
  return {
    valid,        // 有效性，布尔值
    expectedType  // 构造函数名称
  }
}

/*
  该函数的作用是取出构造函数的名称

  ① fn = Boolean
   match = Boolean.toString().match(/^\s*function (\w+)/)
   -> ["function Boolean", "Boolean", index: 0, input: "function Boolean() { [native code] }"]

   match[1] -> "Boolean"

  ② fn = function myFunc(){}
  fn.toString().match(/^\s*function (\w+)/)
  -> ["function myFunc", "myFunc", index: 0, input: "function myFunc(){}"]
  -> match[1] = "myFunc"
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

// 判断函数是否同名
function isType (type, fn) {
  // ① fn 不是数组，只有 fn 和 type 这俩函数同名才返回 true
  if (!Array.isArray(fn)) {
    return getType(fn) === getType(type)
  }
  // ② fn 是数组，只要 fn 中有一个函数和函数 type 同名就返回 true
  for (let i = 0, len = fn.length; i < len; i++) {
    if (getType(fn[i]) === getType(type)) {
      return true
    }
  }
  // ③ 以上都不满足，返回 false
  return false
}
