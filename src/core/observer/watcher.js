/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

/*
  '../util/env.js' 中有定义：
  interface ISet {
    has(key: string | number): boolean;
    add(key: string | number): mixed;
    clear(): void;
  }
 */
import type { ISet } from '../util/index'

let uid = 0

/*
    为什么新建一个 watcher 就可以起到观察表达式/函数的作用呢？

    // 新建 Vue 实例
    vm = new Vue({
      data : {
        aaa : {
            bbb : {
                ccc : {
                    ddd : 1
                }
            }
        }
      }
    });

    // 新建 watcher
    var watcher = new Watcher(vm, 'aaa.bbb.ccc' , cb, options);

    理一理这个 watcher 工作的基本流程：

    (1) 执行 watcher = new Watcher() 会定义 watcher.getter = parsePath('aaa.bbb.ccc')（这是一个函数，稍后会解释），同时也会定义 watcher.value = watcher.get()，而这会触发执行 watcher.get()
    (2) 执行 watcher.get() 就是执行 watcher.getter.call(vm, vm)
    (3) parsePath('aaa.bbb.ccc').call(vm, vm) 会触发 vm.aaa.bbb.ccc 属性读取操作
    (5) vm.aaa.bbb.ccc 属性读取会触发 aaa.bbb.cc 属性的 get 函数（在 defineReactive$$1 函数中定义）
    (6) get 函数会触发 dep.depend()，也就是 Dep.target.addDep(dep)，即把 Dep.target 这个 Watcher 实例添加到 dep.subs 数组里（也就是说，dep 可以发布消息通知给订阅者 Dep.target）
    (7) 那么 Dep.targe 又是什么呢？其实 (2) 中执行 watcher.get() 之前已经将 Dep.target 锁定为当前 watcher（等到 watcher.get() 执行结束时释放 Dep.target）
    (8) 于是，watcher 就进入了 aaa.bbb.ccc 属性的订阅数组，也就是说 watcher 这个订阅者订阅了 aaa.bbb.ccc 属性
    (9) 当给 aaa.bbb.ccc 属性赋值时，如 vm.aaa.bbb.ccc = 100 会触发 vm 的 aaa.bbb.ccc 属性的 set 函数（在 defineReactive$$1 函数中定义）
    (10) set 函数触发 dep.notify()
    (11) 执行 dep.notify() 就会遍历 dep.subs 中的所有 watcher，并依次执行 watcher.update()
    (12) 执行 watcher.update() 又会触发 watcher.run()
    (13) watcher.run() 触发 watcher.cb.call(watcher.vm, value, oldValue);
*/
/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: ISet;
  newDepIds: ISet;
  getter: Function;
  value: any;

  /*
    一个 watcher 实例主要做以下几件事：
    ① 解析表达式 expOrFn，它可能是字符串形式的表达式或者是函数
    ② 收集主题 deps。watcher 取值过程中若获取某个”活性“属性 key，那么就说明这个 watcher 对属性 key 感兴趣，就把 watcher 和 key 的 dep 互相”关注“
    ③ 当 expOrFn 变化时，就能触发回调函数 cb 执行
 */
  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm
    // vm._watchers 数组专门用来存放跟当前 vm 相关的所有 watcher
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''

    // parse expression for getter
    // ① expOrFn 是函数，该函数即为 getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    // ② expOrFn 是 'aaa.bbb.ccc' 这种字符串路径，那么 getter 为函数 parsePath(expOrFn)
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    // 这会触发 this.get() 函数执行 -> this.getter() 执行
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 也就是 Dep.target = this
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 用集合 seenObjects 收集 val.__ob__.dep.id，若 val 数组/对象的子元素也是数组/对象，那就递归
        traverse(value)
      }
      // Dep.target 恢复原来的值
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  /*
      新增一个 dep：
      ① 订阅者 watcher 添加主题 dep（每个订阅者也可以订阅多个主题）
      ② 若发现 watcher.depIds 列表里没有 dep.id，那就调用 dep.addSub(watcher)，即 dep 主题添加订阅者 watcher
   
      这是一个互相关注的操作。订阅者有一个主题列表，主题也有一个订阅者列表。
   */ 
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      // 注意新添加的 id/dep 是加入到 this.newDepIds/this.newDeps 中，而不是 this.depIds/this.deps
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      /*
          ① this.depIds 中没有 dep.id，说明 this 还不在 dep 的订阅者列表里，那就加进去
          ② 反过来看，这次 this.newDepIds 把 dep.id 加进去了，等 this.newDepIds 替换 this.depIds 后，this.depIds 中就有这个 dep.id 了，所以不会重新订阅
       */
      // this.depIds 中没有 id 
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  /*
    两件事：
    1. 对于 watcher 已经关注了的 watcher.deps 这组主题，逐一检查
       若某个 dep.id 没有出现在 watcher.newDepIds 这个重新收集的集合里，说明 watcher 对这个主题不再关注了，那就取消关注
    2. 用重新收集的 newDeps/newDepIds 替换旧的 deps/depIds
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      // 若 newDepIds 中没有 dep.id，说明这个 watcher 不再对这个 dep 感兴趣了
      if (!this.newDepIds.has(dep.id)) {
        // 当前 watcher 从 dep 的订阅列表中移除
        dep.removeSub(this)
      }
    }

    /*
      ① 更新 dep.id 组成的集合
      这样没有创建新的集合，便完成了两个集合内容的交换。
     */ 
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()

    /*
      ② 更新 dep 组成的数组
      这样没有创建新的数组，便完成了两个数组内容的交换。
     */ 
    tmp = this.deps           // 将中间变量 tmp 指向 this.deps 数组
    this.deps = this.newDeps  // 将 this.deps 指向 this.newDeps 数组
    this.newDeps = tmp        // 将 this.newDeps 指向 tmp，也就是指向 this.deps 数组
    this.newDeps.length = 0   // 将 this.newDeps 数组清空
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 当主题发出通知时执行该 update 方法，走下面 3 个流程之一
  update () {
    // ① dirty 置为 true
    if (this.lazy) {
      // 计算属性必须 dirty 为 true 才会重新计算
      this.dirty = true
    // ② 同步执行 run() 
    } else if (this.sync) {
      this.run()
    // ③ watcher 入队，异步执行 watcher.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      // 重新计算 value
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // 旧值
        const oldValue = this.value
        // 新值
        this.value = value
        if (this.user) {
          try {
            // 将新值和旧值作为回调函数 cb 的实参
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 将新值和旧值作为回调函数 cb 的实参
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // 重新计算 value，计算完毕 dirty 置为 false
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  /*
    看看 Dep.prototype.depend : function(){
        if (Dep.target) {
          Dep.target.addDep(this)
        }
    }
    
    所以，Watcher.prototype.depend 的作用是：
    遍历 this.deps，然后对每一个 dep 执行 Dep.target.addDep(dep)
    这可能会导致 Dep.target 关注 dep

    这也算对 this.deps 的每一个主题 dep 做一个整理吧，可能使得 Dep.target 关注这里的每一个 dep
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
    
      // ① 从 watcher.vm._watchers 中移除 watcher
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }

      // ② watcher 对曾经关注过的每一个主题取消关注
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // 标志当前 watcher 失效，不可用状态
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
const seenObjects = new Set()
// 用集合 seenObjects 收集 val.__ob__.dep.id，若 val 数组/对象的子元素也是数组/对象，那就递归
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}

// 核心就一句：seen.add(val.__ob__.dep.id)
function _traverse (val: any, seen: ISet) {
  let i, keys
  const isA = Array.isArray(val)
  /*
      ① val 不是数组也不是对象，返回
      ② val 不可扩展，也返回
   */
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }
  // 将 val 对应的 Observer 实例对应的 dep 的 id 加入集合 seen
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    // 整个 _traverse 方法核心就这一句
    seen.add(depId)
  }

  // 若 val 是数组，递归
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  // 若 val 是对象，也递归
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
