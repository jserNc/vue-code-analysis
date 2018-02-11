/* @flow */

import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser, isChrome } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils
// 平台相关工具方法
Vue.config.mustUseProp = mustUseProp           // 几种特殊元素的属性会添加进 el.props 数组，而不是 el.attrs 数组
Vue.config.isReservedTag = isReservedTag       // 是否为 html/svg 保留标签名
Vue.config.isReservedAttr = isReservedAttr     // 是否为 'style' | 'class'
Vue.config.getTagNamespace = getTagNamespace   // 获取标签的命名空间，例如 'svg' | 'math'
Vue.config.isUnknownElement = isUnknownElement // 是否为未知元素标签名

// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// patch = createPatchFunction({ nodeOps: nodeOps, modules: modules })
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // query(el) 根据 el 选择器，返回对应元素，如果找不到，就新创建一个 div 返回
  el = el && inBrowser ? query(el) : undefined
  /*
      注意，mountComponent 函数的第二个参数 el 可以为空/undefined

      ① el 为 dom 元素，挂载到该元素，替换的该元素内容
      ② el 为 空/undefined，在文档之外渲染，随后再挂载
   */
  return mountComponent(this, el, hydrating)
}

// devtools global hook
// setTimeout(f,0) 可以让后面的同步代码先执行，然后再尽可能早地执行 f 函数
setTimeout(() => {

  // 1. 配置开启 devtools
  if (config.devtools) {
    // ① 已经有 devtools，则初始化。其中 devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__
    if (devtools) {
      devtools.emit('init', Vue)
    // ② 否则，控制台提示下载 devtools
    } else if (process.env.NODE_ENV !== 'production' && isChrome) {
      console[console.info ? 'info' : 'log'](
        'Download the Vue Devtools extension for a better development experience:\n' +
        'https://github.com/vuejs/vue-devtools'
      )
    }
  }

  // 2. 未开启 devtools。在控制台提示：当前为开发模式，若需要部署生产模式代码别忘了开启生产模式开关
  if (process.env.NODE_ENV !== 'production' &&
    config.productionTip !== false &&
    inBrowser && typeof console !== 'undefined'
  ) {
    console[console.info ? 'info' : 'log'](
      `You are running Vue in development mode.\n` +
      `Make sure to turn on production mode when deploying for production.\n` +
      `See more tips at https://vuejs.org/guide/deployment.html`
    )
  }
}, 0)

export default Vue
