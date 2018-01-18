/* @flow */

import Dep from './dep'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'


/*
  ./array.js 中：
  const arrayProto = Array.prototype
  export const arrayMethods = Object.create(arrayProto)

  ① 到这里 arrayMethods 是个空对象 {}，只不过原型指向 Array.prototype
  ② 然后，指向 foreach 循环，通过 def() 方法为 arrayMethods 添加 ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] 等不可枚举属性
  ③ 虽然这些属性不可枚举，但是 Object.getOwnPropertyNames 方法可以返回属性的不可枚举属性
  ④ 所以，arrayKeys = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]
 */ 
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However when passing down props,
 * we don't want to force conversion because the value may be a nested value
 * under a frozen data structure. Converting it would defeat the optimization.
 */
/*
  默认情况下，当”活性“属性被重置后，新的属性值 value 也会被转变为”活性“的。
  然而，当传递 props 时，我们不希望强制将 value 也转变为”活性“的，因为 value 可能是被冰冻的数据下面嵌套的值。
  若是强制转化，就会破坏了之前的优化设计。

  于是，就用一个全局的 observerState.shouldConvert 来标志是否应该转变
 */
export const observerState = {
  shouldConvert: true
} 

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */

//  对 value 对象/数组的每个属性的 getter/setters 进行劫持，收集依赖（主题）和分发更新通知
export class Observer {
  value: any;
  /*
  注意对象和数组的处理方式不一样。
  ① value 是对象，对应一个 dep，对 value 的每一个属性的 getter/setters 进行劫持
  ② value 是数组，对应一个 dep，值得注意的是我们期待的数组每一项都是对象，所以 value 应该是这样子：
     value: [
          { message: 'Foo' },
          { message: 'Bar' }
     ]
     于是，遍历 value 数组，对每一个 obj 子项执行 observe(obj)，实质就是 new Observer(obj)

     也就是说:
     若 value 是对象，它对应一个 dep
     若 value 是数组，它自己对应一个 dep，每个子元素对象也各自对应一个 dep
 */
  dep: Dep;
  /*
      vmCount 默认值为 0
      
      ① Observer 构造函数只会在 observe(value, asRootData) 方法中调用：
         ob = value.__ob__（或：ob = new Observer(value)）
      ② 如果 asRootData 为 true，表示 value 是根 $data，那就
         ob.vmCount++;

      也就是说，同一个 value 对象可以作为多个组件的根 $data，vmCount 用来标记共有多少个组件将对象 value 作为根 $data
   */
  vmCount: number;

  // observe 方法中有过过滤，所以 value 只可能是数组/对象
  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0

    // 将 value.__ob__ 指向当前 Observer 实例 this
    def(value, '__ob__', this)

    // 1. value 是数组
    if (Array.isArray(value)) {
      /*
        ① hasProto = '__proto__' in {};
        ② protoAugment (target, src, keys) 作用是给 target 指定原型 target.__proto__ = src;
        ③ copyAugment (target, src, keys) 作用是遍历 keys，依次将 src[key] 赋值给 target[key]
     */
      const augment = hasProto
        ? protoAugment
        : copyAugment

      /*
        ① arrayMethods = Object.create(Array.prototype);
           之后用 foreach 循环对 arrayMethods 的 ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] 方法重写
           arrayKeys = Object.getOwnPropertyNames(arrayMethods)
           即 arrayKeys = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]
        ② 如果支持 __proto__ 写法，那么 value.__proto__ = arrayMethods;
        ③ 如果不支持 __proto__ 写法，那么依次将 arrayMethods[key] 赋给 value[key]，其中 key 为 "push", "pop", "shift", "unshift", "splice", "sort", "reverse" 等 7 个方法名之一
         
        所以，以下这句的作用就是将数组 value 的 push/unshift/splice/... 等方法进行劫持
        劫持之后，value 数组的这些方法执行时，除了对数组操作，还会发出通知，触发 dom 更新
     */
      augment(value, arrayMethods, arrayKeys)

      // 遍历数组 value 的每一个子对象 items[i]，依次执行 observe(items[i])
      this.observeArray(value)
    // 2. value 是对象
    } else {
      // 遍历对象 value 的每一个属性 keys[i]，依次拦截属性 keys[i] 的 getter/setters 操作
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  /*
    遍历对象 obj 的每一个属性，然后将该属性转换为 getter/setters
    注意：这个方法的参数 obj 一定要是对象
   */
  walk (obj: Object) {
    /*
      Object.keys() 方法会返回一个由一个给定对象的自身可枚举属性组成的数组，数组中属性名的排列顺序和使用 for...in 循环遍历该对象时返回的顺序一致 
      两者的主要区别是：for-in 循环还会枚举其原型链上的属性
     */
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 拦截属性 keys[i] 的 getter/setters 操作
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    /*
      依次遍历每一个子对象，如：
      items : [
        { message: 'Foo' },
        { message: 'Bar' }
      ]

      可见，数组 items 的每一项 items[i] 还需是对象，不然 observe(items[i]) 方法会直接返回，无意义
     */
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
// 用 __proto__ 属性强制修改原型对象
function protoAugment (target, src: Object, keys: any) {
  target.__proto__ = src
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
// 循环复制属性
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    // 依次将 src[key] 赋值给 target[key]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
/*
  返回一个与 value 对象/数组关联的 Observer 实例
  ① 若之前创建过关联的 Observer 实例，那就用之，不需重新创建。
  ② 若没有关联的 Observer 实例，那就用 new Observer(value) 新创建一个
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 若 value 不是对象（数组也算对象）就返回
  if (!isObject(value)) {
    return
  }
  let ob: Observer | 

  // 1. 若有与 value 相关联的 Observer 实例，那就用这个实例
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    /*
      需同时满足以下条件：
      ① observerState.shouldConvert 为 true
      ② 非服务器环境
      ③ value 是数组或者对象
      ④ value 对象可扩展
      ⑤ value 不是 Vue 实例
     */
    observerState.shouldConvert && 
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  // 2. 新建一个与 value 相关联的 Observer 实例
  ) {
    ob = new Observer(value)
  }

  // 若 asRootData 为 true，表示将 value 作为组件的根 $data，那么 vmCount 值加 1
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
/*
    在 obj 对象上拦截 key 属性的 getter/setters 操作，通俗地说有两点：

    ① 若在新建 watcher = new Watcher() 实例时，获取 obj[key] 属性，说明这个 watcher 对 obj[key] 属性感兴趣，那么就收集这个 watcher；
    ② 在设置 obj[key] = val 时，执行 customSetter()，并通知 watcher，然后 watcher 会执行相应的动作
*/
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 每一个”活性“属性 key 对应一个主题 dep
  const dep = new Dep()

  /*
      获取 key 属性的属性描述对象，例如：

      var o = { a:1 }
      var props = Object.getOwnPropertyDescriptor(o,'a')
      -> {value: 1, writable: true, enumerable: true, configurable: true}
  */
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 如果描述属性规定当前属性不可配置，那就返回
  if (property && property.configurable === false) {
    return
  }

  // 之前定义的 getter/setters
  const getter = property && property.get
  const setter = property && property.set

  /*
    ① shallow 的意思是"浅的"，也就是说没有指定"浅观察"，就是深度观察（子属性也要劫持）

    举例来说：
    obj = {
     a : {
        aa : 1
     }
    }

    这里的 val 是 {aa : 1} 这样的对象，那么就递归遍历 {aa : 1} 对象的属性，劫持其属性的 getter/setter

    ② 反过来说，若 shallow 为 true，就不用管 val 的子属性了

    总结一下：
    递归：observe(val) -> new Observer(val) -> defineReactive$$1()
   【重要】以下这句作用就是：递归遍历劫持 val 的所有子属性（这里的 val 必须为对象或者数组 childOb 才有值）
  */
  let childOb = !shallow && observe(val)

  Object.defineProperty(obj, key, {
    enumerable: true,   // 可枚举
    configurable: true, // 可配置
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        /*
          看看这句代码的执行流程：
          dep.depend()
          -> Dep.target.addDep(dep)
          -> Dep.target.newDepIds.add(dep.id)
             Dep.target.newDeps.push(dep)
             dep.addSub(Dep.target)

          也就是说：
          ① Dep.target 这个 watcher 收录 dep/dep.id（主题/主题id）
          ② dep 主题的订阅列表也收录 Dep.target 这个 watcher

          所以，这个操作可以理解为 Dep.target 和 dep ”互相关注“

          再深挖一下：
          ① Dep.targe 表示正在计算属性值的 watcher，这是全局唯一的。任意时刻只允许有一个 watcher 正在计算。
          ② 代码流程能走到这个 reactiveGetter 方法里，说明此时要获取 obj[key] 这个值
          ③ 这就说明正在计算属性值的 watcher 对 obj[key] 这个值感兴趣，obj[key] 会影响计算结果
          ④ 所以 obj[key] 改变时需要通知 watcher。也就是说 watcher 需关注主题 dep，由 dep 来给 watcher 发通知。
         */
        dep.depend()
        // 如果 val 有”活性“子属性，那当然也是 Dep.targe 感兴趣的，那就”互相关注“
        if (childOb) {
          childOb.dep.depend()
        }
        /*
          对数组 value 的每一个子对象 e，执行：e.__ob__.dep.depend()
          也就是说：每一个子对象的 dep 和 Dep.target ”互相关注“
       */
        if (Array.isArray(value)) {
          dependArray(value)
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      // 获取旧值
      const value = getter ? getter.call(obj) : val

      // 如果旧值和新值相等或者旧值和新值都是 NaN，则不进行设置操作。（NaN 应该是唯一不等于自身的值）
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }

      // 执行自定义 setter 函数
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }

      // 设置新值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      /*
          注意：set/set 函数在这里是闭包，所以能共用 val 的值，简化一下 defineReactive$$1 函数看得更清楚：

          function defineReactive$$1 (obj, key, val) {
            Object.defineProperty(obj, key, {
              get: function () {
                return val
              },
              set: function (newVal) {
                val = newVal;
              }
            });
          }

          ① 当我们给 key 赋值时，如 obj[key] = 100 -> val = 100
          ② 当我们获取 key 的值时，即 obj[key] -> val (100)
          
          也就是说 100 是存在 val 这个中间变量里，这个 val 变量不属于 get 函数，也不属于 set 函数，但它们可以共用
      */

      // 因为 newVal 已经赋值给 val 了，observe(newVal) 相当于 observe(val)
      childOb = !shallow && observe(newVal)
      // 发出通知告诉各个 watcher，val 的值变了
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// 给 target 添加 key 属性（值为 val）。若该属性之前不存在，发出变化通知。
export function set (target: Array<any> | Object, key: any, val: any): any {
  // ① target 是数组，并且 key 是合法的数组索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 数组长度变为 target.length, key 中的较大者
    target.length = Math.max(target.length, key)
    // 在 key 位置删除 1 个元素，并新增 1 个元素 val，其实就是替换（设置）
    target.splice(key, 1, val)
    return val
  }

  // ② target 是对象，并且 key 属性已经存在，那就简单赋值（替换）
  if (hasOwn(target, key)) {
    target[key] = val
    return val
  }

  // ③ target 是对象，并且 key 是新增属性才会执行以下部分
  const ob = (target: any).__ob__
  // 警告：不能给 Vue 实例或其根 $data 添加”活性“属性
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }

  // 若 target 对象不是”活性“的，那就简单的赋值（替换）
  if (!ob) {
    target[key] = val
    return val
  }
  /*
    走到这，得同时满足几个条件：
    1. target 是对象
    2. target 不是 Vue 实例或其根 $data
    3. target 之前不存在 key 属性
    4. target 是”活性“的，也就是说执行过 observe(target)，target 有对应的 Observer 实例
   
    于是，将这个新增的属性也定义为”活性“属性
   */
  defineReactive(ob.value, key, val)
  // 通知对 target 对象感兴趣的 watcher
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
// 删除 target 的 key 属性，必要的时候发出变化通知
export function del (target: Array<any> | Object, key: any) {
  // ① target 是数组，并且 key 是合法的数组索引，直接删除索引 key 处的元素
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }

  // ② target 是对象
  const ob = (target: any).__ob__
  // 警告：不能删除 Vue 实例或其根 $data 的属性
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // target 中不存在 key 属性，直接返回
  if (!hasOwn(target, key)) {
    return
  }
  // target 中存在 key 属性，删除之
  delete target[key]
  if (!ob) {
    return
  }
  /*
    走到这，得同时满足几个条件：
    1. target 是对象
    2. target 不是 Vue 实例或其根 $data
    3. target 之前存在 key 属性
    4. target 是”活性“的，也就是说执行过 observe(target)，target 有对应的 Observer 实例
   
    于是，通知对 target 对象感兴趣的 watcher
   */
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    /*
      对数组 value 的每一个子对象 e，执行：e.__ob__.dep.depend()
      也就是说：每一个子对象的 dep 和 Dep.target ”互相关注“
     */
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
