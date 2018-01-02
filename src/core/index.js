import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'

initGlobalAPI(Vue)

// 获取 vm.$isServer 时，执行 isServerRendering 函数，标志是否在服务器渲染
Object.defineProperty(Vue.prototype, '$isServer', {
  // isServerRendering 是一个函数
  get: isServerRendering
})

// 获取 vm.$ssrContext 时，返回 vm.$vnode.ssrContext
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    return this.$vnode && this.$vnode.ssrContext
  }
})

// 构建的时候调用 build/config.js，会将 __VERSION__ 替换为实际的版本号 version = process.env.VERSION || require('../package.json').version
Vue.version = '__VERSION__'

// 导出构造函数 Vue
export default Vue
