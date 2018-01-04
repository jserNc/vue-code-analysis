/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'

// 对象是否支持 '__proto__' 属性（注意带引号）
export const hasProto = '__proto__' in {}

// Browser environment sniffing
export const inBrowser = typeof window !== 'undefined'
export const UA = inBrowser && window.navigator.userAgent.toLowerCase()
export const isIE = UA && /msie|trident/.test(UA)
export const isIE9 = UA && UA.indexOf('msie 9.0') > 0
export const isEdge = UA && UA.indexOf('edge/') > 0
export const isAndroid = UA && UA.indexOf('android') > 0
export const isIOS = UA && /iphone|ipad|ipod|ios/.test(UA)
export const isChrome = UA && /chrome\/\d+/.test(UA) && !isEdge

// Firefix has a "watch" function on Object.prototype...
export const nativeWatch = ({}).watch

export let supportsPassive = false
if (inBrowser) {
  try {
    const opts = {}
    Object.defineProperty(opts, 'passive', ({
      get () {
        supportsPassive = true
      }
    }: Object)) // https://github.com/facebook/flow/issues/285
    window.addEventListener('test-passive', null, opts)
    /*
      target.addEventListener(type, listener, options);
      ① type：表示事件类型
      ② listener：回调函数/null
      ③ options：指定有关 listener 属性的可选参数对象
        {
          capture:  Boolean，表示 listener 会在该类型的事件捕获阶段传播到该 EventTarget 时触发。
          once:  Boolean，表示 listener 在添加之后最多只调用一次。如果是 true， listener 会在其被调用之后自动移除。
          passive: Boolean，表示 listener 永远不会调用 preventDefault()。如果 listener 仍然调用了这个函数，客户端将会忽略它并抛出一个控制台警告。
        } 

      以上的 options 对象的 passive 选项不是所有的环境都支持，所以这里做一个试探：
      添加一个 'test-passive' 类型事件，若系统试图去读取 opts 对象的 passive 属性，那就说明支持 passive 配置选项，于是标志 supportsPassive = true
     */
  } catch (e) {}
}

// this needs to be lazy-evaled because vue may be required before
// vue-server-renderer can set VUE_ENV
let _isServer
export const isServerRendering = () => {
  // ① 如果 _isServer 为 undefined，就对全局的 _isServer 进行初始化
  if (_isServer === undefined) {
    // 服务器环境
    if (!inBrowser && typeof global !== 'undefined') {
      _isServer = global['process'].env.VUE_ENV === 'server'
    } else {
      _isServer = false
    }
  }
  // ② 如果全局的 _isServer 有值，直接返回这个值
  return _isServer
}

// 检测 devtools
export const devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__

// 判断函数 Ctor 是否是原生方法
export function isNative (Ctor: any): boolean {
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

// 是否支持 Symbol 和 Reflect
export const hasSymbol =
  typeof Symbol !== 'undefined' && isNative(Symbol) &&
  typeof Reflect !== 'undefined' && isNative(Reflect.ownKeys)

// 异步执行任务 fn
export const nextTick = (function () {
  const callbacks = []
  let pending = false
  let timerFunc

  // 执行异步任务，并清空队列
  function nextTickHandler () {
    pending = false
    // 对 callbacks 数组深复制，以免循环执行过程中数组改变了
    const copies = callbacks.slice(0)
    // 清空数组
    callbacks.length = 0
    // 循环执行异步任务 fn
    for (let i = 0; i < copies.length; i++) {
      copies[i]()
    }
  }

  // ① 原生支持 Promise 时，用 Promise 触发 nextTickHandler
  if (typeof Promise !== 'undefined' && isNative(Promise)) {
    var p = Promise.resolve()
    var logError = err => { console.error(err) }
    timerFunc = () => {
      p.then(nextTickHandler).catch(logError)
      if (isIOS) setTimeout(noop)
    }
  // ② 否则，用 MutationObserver 来触发 nextTickHandler
  } else if (typeof MutationObserver !== 'undefined' && (
    isNative(MutationObserver) ||
    MutationObserver.toString() === '[object MutationObserverConstructor]'
  )) {
    var counter = 1
    // 指定 observer 的回调方法是 nextTickHandler
    var observer = new MutationObserver(nextTickHandler)
    // observer 的作用是监视 dom 变化，所以这里创建一个 dom
    var textNode = document.createTextNode(String(counter))
    // 注册监听
    observer.observe(textNode, {
      characterData: true
    })
    // counter 变化 -> dom 变化 -> 触发 nextTickHandler()
    timerFunc = () => {
      counter = (counter + 1) % 2
      textNode.data = String(counter)
    }
  // ③ 前两者都不支持，用 setTimeout 来模拟异步任务
  } else {
    timerFunc = () => {
      setTimeout(nextTickHandler, 0)
    }
  }

  // ①、②、③ 的作用就是根据不同的环境定义 timerFunc 函数，timerFunc 函数的作用就是异步触发 nextTickHandler 函数

  // 这就是 nextTick 函数
  return function queueNextTick (cb?: Function, ctx?: Object) {
    let _resolve
    // 用匿名函数对 cb 函数进行封装，并将匿名函数 push 进 callbacks 队列
    callbacks.push(() => {
      if (cb) {
        try {
          cb.call(ctx)
        } catch (e) {
          handleError(e, ctx, 'nextTick')
        }
      } else if (_resolve) {
        _resolve(ctx)
      }
    })

    // 启动异步任务
    if (!pending) {
      pending = true
      timerFunc()
    }

    if (!cb && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        _resolve = resolve
      })
    }
    /*
      理解一下 Promise 中的 resolve 方法：

      var _resolve;
      var p = new Promise(function (resolve, reject) {
          _resolve = resolve;
      })
      p.then(function(data){
          console.log(data);
      })
      _resolve('这是数据')
      // 控制台打印'这是数据'

      resolve 函数的作用是，将 Promise 对象的状态从“未完成”变为“成功”（即从 pending 变为 resolved）。
      而 then 方法可以接受两个回调函数作为参数。第一个回调函数是 Promise 对象的状态变为 resolved 时调用。
      所以，执行 _resolve 函数后，就会执行 then 方法指定的第一个回调，并且 _resolve 的实参会传给 then 的第一个回调函数。
     */
  }
})()

/*
  简化一下 nextTick 函数：

  var callbacks = [];
  var pending = false;
  var timerFunc;

  function nextTickHandler () {
      // 依次执行 callbacks 队列中的函数，并清空该队列，解锁 
  }
  timerFunc = function () {
      // 异步执行 nextTickHandler() 
  };
  var nextTick = function queueNextTick (cb, ctx) {
      var _resolve;
      // 将匿名函数封装 cb/_resolve，并推入 callbacks 队列
      callbacks.push(function () {
        if (cb) {
          cb.call(ctx);
        } else if (_resolve) {
          _resolve(ctx);
        }
      });
      // 执行 timerFunc() 并上锁
      if (!pending) {
        pending = true;
        timerFunc();
      }
      // 参数为空并且不支持 Promise
      if (!cb && typeof Promise !== 'undefined') {
        return new Promise(function (resolve, reject) {
          // 于是可以用 _resolve 方法来触发 Promise 实例的 then 回调
          _resolve = resolve;
        })
      }
  }

  总结一下 nextTick 函数的用法：

  var nextTick = function queueNextTick (cb, ctx) {...}
  a) 若 cb 参数不存在或当前环境不支持 Promise，则没有指定返回值，也就是 undefined；
  b) 否则，返回一个 promise 实例

  简单点说就是：
  ① nextTick 方法有实参时，将实参加入回调函数队列 callbacks，然后在本轮“事件循环”结束后，依次执行回调队列 callbacks 中的函数；
  ② nextTick 方法没有实参时，返回一个 Promise 实例。可以为该实例添加 then 回调，待队列 callbacks 中函数执行 _resolve(ctx) 时触发 then 的回调方法
 */


let _Set
// ① 原生支持 Set
if (typeof Set !== 'undefined' && isNative(Set)) {
  _Set = Set
// ② 否则，自定义 Set
} else {
  // a non-standard Set polyfill that only works with primitive keys.
  _Set = class Set implements ISet {
    set: Object;
    constructor () {
      this.set = Object.create(null)
    }
    has (key: string | number) {
      return this.set[key] === true
    }
    add (key: string | number) {
      this.set[key] = true
    }
    clear () {
      this.set = Object.create(null)
    }
  }
}

interface ISet {
  has(key: string | number): boolean;
  add(key: string | number): mixed;
  clear(): void;
}

export { _Set }
export type { ISet }
