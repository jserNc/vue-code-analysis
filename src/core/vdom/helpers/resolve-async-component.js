/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'

// 经过这里对 comp 的修正，确保返回一个组件构造函数
function ensureCtor (comp, base) {
  // ① 修正 comp
  if (comp.__esModule && comp.default) {
    comp = comp.default
  }
  // ② 再次修正 comp，并返回
  return isObject(comp)
    // base.extend(comp) 的作用是将一个普通对象转为组件构造函数
    ? base.extend(comp)
    : comp
}

// 创建异步的占位符，返回一个空的 vnode 节点
export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  /*
      相当于：
      node.asyncMeta = { data: data, context: context, children: children, tag: tag }
   */
  node.asyncMeta = { data, context, children, tag }
  return node
}

// 根据工厂函数 factory 的不同状态返回不同的组件构造函数
/*
    ① 异步组件工厂函数 factory 只是普通的函数，没有 factory.cid 属性
    ② 而通过 Ctor = Vue.extend(extendOptions) 创建的组件构造函数都有 Ctor.cid 属性
 
    如果执行 Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context) 后
    Ctor 为 undefined，说明异步任务没执行完，组件构造函数还没创建，那就调用 createAsyncPlaceholder() 先创建一个占位符
 */
export function resolveAsyncComponent (
  factory: Function, 
  baseCtor: Class<Component>,
  context: Component
): Class<Component> | void {
  // 1. 满足以下条件，直接返回 factory.errorComp 这个组件构造函数
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  // 2. 如果条件 1 不满足，factory.resolved 存在，那就返回 factory.resolved 这个组件构造函数
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  // 3. 如果条件 1 和 2 都不满足，满足以下条件，就返回 factory.loadingComp 这个组件构造函数
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  // ① 如果 factory.contexts 存在，说明已经 pending 过
  if (isDef(factory.contexts)) {
    // 就把组件 context 加进数组 factory.contexts 即可
    factory.contexts.push(context)
  // ② 否则，就同步执行了，一步步走以下流程，给 factory 添加各种属性
  } else {
    // 新建 factory.contexts
    const contexts = factory.contexts = [context]
    // 同步
    let sync = true

    /*
       遍历组件数组 contexts，依次执行每一个组件的 $forceUpdate()
       vm.$forceUpdate() -> vm._watcher.update()

       也就是说，这里主动更新每个组件的视图
     */
    const forceRender = () => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }
    }


    // resolve 方法只能执行一次
    const resolve = once((res: Object | Class<Component>) => {
      /*
          ensureCtor() 对 res 修正，确保返回一个组件构造函数
          所以，factory.resolved 保存的是一个组件构造函数
       */
      // cache resolved
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      if (!sync) {
        // 遍历组件数组 contexts，依次更新每个组件的视图
        forceRender()
      }
    })

    // reject 方法只能执行一次
    const reject = once(reason => {
      // 警告：resolve 异步组件失败
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      // 如果有 factory.errorComp，那就标志组件出错，更新视图
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender()
      }
    })

    /*
        factory 工厂函数也是普通函数，只不过它里面会执行异步任务

        官网上异步组件构造函数是这样定义的：
        Vue.component('async-example', function (resolve, reject) {
          setTimeout(function () {
            // 将组件定义传入 resolve 回调函数
            resolve({
              template: '<div>I am async!</div>'
            })
          }, 1000)
        })

        也就是 Vue.component('async-example',fn)，不会对 fn 做任何修正
        于是，this.options['components']['async-example'] = fn;

        可以看到，工厂函数 factory 就是普通的函数，只不过该函数里会执行异步任务
        ① 异步任务执行成功就调用 resolve 方法
        ② 异步任务执行失败就调用 reject 方法

        再看看 res = factory(resolve, reject)
        ① 将 factory 函数返回值赋给 res
        ② 执行 factory 函数里的异步任务
        ③ 异步任务执行成功就调用 resolve 方法（缓存 factory.resolved 构造函数）
        ④ 异步任务执行失败就调用 reject 方法（标志组件出错，更新视图）
        （注意：这只是上面例子的执行流程，实际上 factory 函数可以不调用 resolve/reject 方法）
        
        注意：是先返回值，后执行异步任务。下面写个简单的 demo 验证一下：
        function asyncFn () {
          setTimeout(function () {
            console.log('异步任务完成')
          }, 2000)
          return '返回值'
        }

        var res = asyncFn();
        console.log(res)

        这段代码的打印结果是：
        返回值
        异步任务完成

        简单理解就是：先执行同步任务，后执行异步任务
     */
    const res = factory(resolve, reject)

    /*
      上面官网例子中工厂函数 factory 返回了 undefined。
      其实，工厂函数 factory 还可以返回其他值：

      ① 返回一个 Promise 对象
      Vue.component(
        'async-webpack-example',
        // 该 `import` 函数返回一个 `Promise` 对象。
        () => import('./my-async-component')
      )

      ② 返回一个普通 json 对象
      const factory = () => ({
        // 需要加载的组件。应当是一个 Promise
        component: import('./MyComp.vue'),
        // 加载中应当渲染的组件
        loading: LoadingComp,
        // 出错时渲染的组件
        error: ErrorComp,
        // 渲染加载中组件前的等待时间。默认：200ms。
        delay: 200,
        // 最长等待时间。超出此时间则渲染错误组件。默认：Infinity
        timeout: 3000
      })
     */
    if (isObject(res)) {
      // ① res 为 Promise 对象
      if (typeof res.then === 'function') {
        /*
          这么理解：
          ① 工厂方法 factory(resolve, reject) 执行时调用了 resolve 方法，就像上面的例子那样，那就定义了 factory.resolved
          ② 工厂方法 factory(resolve, reject) 执行时没调用 resolve 方法，那就再这里交给 Promise 对象处理
         */ 
        if (isUndef(factory.resolved)) {
          // 作用就是 promise 成功后定义 factory.resolved 组件构造函数
          res.then(resolve, reject)
        }
      // ② res 为普通 json 对象
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        // res.component 是一个 Promise 对象，成功后定义 factory.resolved 组件构造函数
        res.component.then(resolve, reject)

        // 定义 factory.errorComp 组件构造函数
        if (isDef(res.error)) {
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        // 定义 factory.loadingComp 组件构造函数
        if (isDef(res.loading)) {
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          
          // 等待时间为 0
          if (res.delay === 0) {
            factory.loading = true
          // 在时间 res.delay 后，若还不能正常渲染，那就用”正在加载中组件“更新视图
          } else {
            setTimeout(() => {
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender()
              }
            }, res.delay || 200)
          }
        }

        // 超出时间 res.timeout 则渲染错误组件
        if (isDef(res.timeout)) {
          setTimeout(() => {
            if (isUndef(factory.resolved)) {
              // reject 函数的实参是错误原因
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    // 非同步，异步
    sync = false

    // return in case resolved synchronously
    /*
      ① factory.loading 为 true，返回组件 factory.loadingComp
      ② 否则，返回 factory.resolved（试一试，也许此时已经有该属性了，没有也没关系）
     */
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
