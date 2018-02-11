/* @flow */

import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { isChrome, isIE, supportsPassive } from 'core/util/env'
import { RANGE_TOKEN, CHECKBOX_RADIO_TOKEN } from 'web/compiler/directives/model'

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
// 规范化事件处理函数（v-model 事件处理函数在自定义事件处理函数前面）
function normalizeEvents (on) {
  let event
  
  /*
      RANGE_TOKEN = '__r'
      若 input 的 type === 'range'，那么其事件类型最开始就是用 RANGE_TOKEN 代替的
      在这里才将 RANGE_TOKEN 替换为真正的事件类型名
   */
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event
    event = isIE ? 'change' : 'input'
    // 合并事件处理函数数组（注意 v-model 添加事件处理函数在前面）
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }

  /*
      CHECKBOX_RADIO_TOKEN = '__c'
      若 input 的 type === 'checkbox'，那么其事件类型最开始就是用 CHECKBOX_RADIO_TOKEN 代替的
      在这里才将 CHECKBOX_RADIO_TOKEN 替换为真正的事件类型名
   */
  if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
    // Chrome fires microtasks in between click/change, leads to #4521
    event = isChrome ? 'click' : 'change'
    // 合并事件处理函数数组（注意 v-model 添加事件处理函数在前面）
    on[event] = [].concat(on[CHECKBOX_RADIO_TOKEN], on[event] || [])
    delete on[CHECKBOX_RADIO_TOKEN]
  }
}

let target: HTMLElement

// 添加事件绑定
function add (
  event: string,
  handler: Function,
  once: boolean,
  capture: boolean,
  passive: boolean
) {
  if (once) {
    const oldHandler = handler
    const _target = target // save current target element in closure
    handler = function (ev) {
      const res = arguments.length === 1
        ? oldHandler(ev)                     // 1 个实参
        : oldHandler.apply(null, arguments)  // 多个实参

      /*
          只要函数执行结果不是 null，就解除绑定
          换句话说，若执行结果是 null，那么就不解除绑定了
       */ 
      if (res !== null) {
        remove(event, handler, capture, _target)
      }
    }
  }

  // 添加事件绑定
  target.addEventListener(
    event,
    handler,
    supportsPassive
      ? { capture, passive }
      : capture
  )
  /*
    dom 新规范规定，addEventListener() 的第三个参数可以是个对象值了：
    addEventListener(type, listener, {
        capture: false,
        passive: false,
        once: false
    })
  */
}

// 解除事件绑定
function remove (
  event: string,
  handler: Function,
  capture: boolean,
  _target?: HTMLElement
) {
  (_target || target).removeEventListener(event, handler, capture)
}

// 更新事件监听
function updateDOMListeners (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }

  const on = vnode.data.on || {}
  const oldOn = oldVnode.data.on || {}

  target = vnode.elm
  // 将 v-model 回调函数放到回调函数队列最前面
  normalizeEvents(on)
  // 更新事件监听函数
  updateListeners(on, oldOn, add, remove, vnode.context)
}

export default {
  create: updateDOMListeners,
  update: updateDOMListeners
}
