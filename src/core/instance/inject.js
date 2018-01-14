/* @flow */

import { warn } from '../util/index'
import { hasSymbol } from 'core/util/env'
import { defineReactive, observerState } from '../observer/index'

 /*
    provide 和 inject 主要为高阶插件/组件库提供用例。并不推荐直接用于应用程序代码中。
    
    var Provider = {
      provide: {
        foo: 'bar'
      },
      // ...
    }
    var Child = {
      inject: ['foo'],
      created () {
        console.log(this.foo) // => "bar"
      }
      // ...
    }

    可以看到，子组件的 inject 会去祖先组件的 provide 中取值
*/


// 初始化 provide，添加 vm._provided 属性
export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    // 如果 provide 是函数，取函数执行结果，否则就取 provide
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

export function initInjections (vm: Component) {
  /*
      一个 json 对象，例如：
      {
          'foo' : 'bar'
      }
   */
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // observerState.shouldConvert 为 true 时，observe 方法才有效
    observerState.shouldConvert = false
    Object.keys(result).forEach(key => {
      /*
        以下代码块，简单点看就是一句：
        defineReactive(vm, key, result[key])

        在 vm 对象上拦截 key 属性的 get/set 操作

        一般情况下 defineReactive 函数会触发 observe(result[key])
        但是，observerState.shouldConvert 为 false 就相当于不执行 observe 方法无效了
       
        所以，foo 属性就这样挂载到了 vm 实例上
       */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    observerState.shouldConvert = true
  }
}

// 返回一个 json 对象，键名为 inject 中【数组索引 | 属性名】，键值为 provide【属性名】中属性值
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    /*
      ① hasSymbol 为 true 表示原生支持 Symblo 和 Reflect
      ② Reflect.ownKeys 方法用于返回对象的所有属性，基本等同于 Object.getOwnPropertyNames 与 Object.getOwnPropertySymbols 之和
      ③ Object.keys 方法返回对象的可枚举属性组成的数组

      若 inject 是一个数组，那么 keys 就是数组的索引集合
    */
    const keys = hasSymbol
        ? Reflect.ownKeys(inject)
        : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      // inject【数组索引 | 属性名】
      const key = keys[i]
      // inject【属性值】对应 provide【属性名】
      const provideKey = inject[key]
      let source = vm
      // 向上遍历祖先实例
      while (source) {
        // 只要当前属性名存在于某个祖先 vm.$options.provide 中，就终止循环
        if (source._provided && provideKey in source._provided) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      // hasOwn(result, key) 为 false，说明以上并没给执行给 result 添加 key 属性的操作，也就是所有祖先元素中都没找到，那就发出警告
      if (process.env.NODE_ENV !== 'production' && !hasOwn(result, key)) {
        warn(`Injection "${key}" not found`, vm)
      }
    }
    /*
      于是，很自然地想到以上例子得到的 result 为：
      {
          '0' : 'bar'
      }
      可事实并不是这样，inject 选项在实例化过程中会被 normalizeInject 函数处理，将数组形式转为对象形式
      也就是说，inject: ['foo'] 实质等同于 inject: { 'foo' : 'foo'}

      所以，result 应该是：
      {
          'foo' : 'bar'
      }
     */
    return result
  }
}
