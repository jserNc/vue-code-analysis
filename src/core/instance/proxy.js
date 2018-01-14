/* not type checking this file because flow doesn't play well with Proxy */
// 由于 flow 对于 Proxy 的检测支持性不好，所以本文件就不检测了

// 全局配置对象
import config from 'core/config'
import { warn, makeMap } from '../util/index'

let initProxy

// 非生产环境执行
if (process.env.NODE_ENV !== 'production') {
  // 全局关键词/方法
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )

  const warnNonPresent = (target, key) => {
    // 实例的属性/方法 key 未定义，但是在渲染过程中被引用了。确保声明活性的 data 属性。
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      `referenced during render. Make sure to declare reactive data ` +
      `properties in the data option.`,
      target
    )
  }

  // 是否原生支持 Proxy
  const hasProxy = typeof Proxy !== 'undefined' && Proxy.toString().match(/native code/)

  if (hasProxy) {
    // 内置的修饰符
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta')
    // 在 config.keyCodes 对象设置属性的时候进行拦截
    config.keyCodes = new Proxy(config.keyCodes, {
      set (target, key, value) {
        // 内置的修饰符被重写时发出警告，不让重写
        if (isBuiltInModifier(key)) {
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        // 其他的都能成功设置
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  // has(target, propKey)：拦截 propKey in proxy 的操作，返回一个布尔值。
  const hasHandler = {
    // 判断 target 对象是否含有属性 key
    has (target, key) {
      // ① key 是 target 的可枚举属性
      const has = key in target
      // ② key 为全局关键词或以 _ 开头
      const isAllowed = allowedGlobals(key) || key.charAt(0) === '_'
      // 以上两条件都不满足，发出警告
      if (!has && !isAllowed) {
        warnNonPresent(target, key)
      }
      // key 为 target 的属性时返回 true
      return has || !isAllowed
    }
  }
  
  // get(target, propKey, receiver)：拦截对象属性的读取，比如 proxy.foo 和 proxy['foo']
  const getHandler = {
    // 返回 target 对象的 key 属性
    get (target, key) {
      // key 不是 target 的可枚举属性时，发出警告
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  // 设置 vm._renderProxy 属性
  initProxy = function initProxy (vm) {
    // ① 原生支持 Proxy，vm._renderProxy 是代理后的 vm
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      const handlers = options.render && options.render._withStripped
        // 代理属性 get 操作
        ? getHandler
        // 代理 propKey in proxy 操作
        : hasHandler
	 
      // 代理 vm 对象的属性操作
      vm._renderProxy = new Proxy(vm, handlers)
    // ② 不支持 Proxy，vm._renderProxy 就是 vm
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
