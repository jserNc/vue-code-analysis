/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { shouldDecodeNewlines } from './util/compat'
import { compileToFunctions } from './compiler/index'

// 根据选择器 id 获取元素，然后返回该元素的 innerHTML
const idToTemplate = cached(id => {
  // 根据 el 选择器，返回对应元素，如果找不到，就新创建一个 div 返回
  const el = query(id)
  return el && el.innerHTML
})

// 保存之前定义的 Vue$3.prototype.$mount
const mount = Vue.prototype.$mount
// 重新定义 Vue$3.prototype.$mount，本质上还是调用 mount 方法，也就是之前定义的 Vue$3.prototype.$mount 方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  // 不能将 Vue 实例挂载到 <html> 或 <body>，只能挂载到普通元素上
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  /*
      若没有渲染函数，那就用 template/el 生成渲染函数

      即生成：
      options.render = render
      options.staticRenderFns = staticRenderFns
   */ 
  if (!options.render) {
    let template = options.template
    // 1. 将 options.template -> 字符串形式模板
    if (template) {
      if (typeof template === 'string') {
        // ① 如 template = '#app' 模板为元素 id
        if (template.charAt(0) === '#') {
          // idToTemplate(id) 根据选择器 id 获取元素，然后返回该元素的 innerHTML
          template = idToTemplate(template)
          // 警告：找不到对应的元素
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      // ② 如 template = document.getElementById('app') 模板为 dom 元素
      } else if (template.nodeType) {
        template = template.innerHTML
      // ③ 否则是无效的 template
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    // 2. 用 el 元素的 outerHTML 作为模板
    } else if (el) {
      template = getOuterHTML(el)
    }

    // 根据模板 template 生成渲染函数
    if (template) {
      // 标记开始编译
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      /*
           compileToFunctions(template, options, vm) 
           会根据模板 template 返回一个 json：
           { 
              render: fn, 
              staticRenderFns: [...]
           }
       */
      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)

      // 修改 options 对象，添加渲染函数
      options.render = render
      options.staticRenderFns = staticRenderFns

      // 标记编译结束，计算耗时
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`${this._name} compile`, 'compile', 'compile end')
      }
    }
  }

  // 修正完 this.$options 的渲染函数，开始安装元素 el
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
// 获取 el 元素的 outerHTML
function getOuterHTML (el: Element): string {
  // ① 首选取 el.outerHTML 属性
  if (el.outerHTML) {
    return el.outerHTML
  // ② 若取不到，则取父元素的 innerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

/*
    compileToFunctions(template, options, vm) 
    根据模板 template 返回一个 json：
    { 
      render: fn, 
      staticRenderFns: [...]
    }
*/
Vue.compile = compileToFunctions

export default Vue
