/* @flow */

import { parseFilters } from './parser/filter-parser'

// 基本的警告函数
export function baseWarn (msg: string) {
  console.error(`[Vue compiler]: ${msg}`)
}

// 返回一个 module[key] 组成的数组，即 [ module1.key,  module2.key,  module2.key, ...]
export function pluckModuleFunction<F: Function> (
  modules: ?Array<Object>,
  key: string
): Array<F> {
  return modules
    ? modules.map(m => m[key]).filter(_ => _)
    : []
}

// 添加 prop
export function addProp (el: ASTElement, name: string, value: string) {
  (el.props || (el.props = [])).push({ name, value })
}

// 添加 attr
export function addAttr (el: ASTElement, name: string, value: string) {
  (el.attrs || (el.attrs = [])).push({ name, value })
}


/*
    添加指令，例如：<input type="text" v-show="isShow" value="" v-model="someText"/>
    el.directives : [
         {
             name: "show",
             rawName: "v-show",
             value: "isShow",
             arg: null,
             modifiers: undefined
         },
         {
             name: "model",
             rawName: "v-model",
             value: "someText",
             arg: null,
             modifiers: undefined
         }
    ]
 */
export function addDirective (
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg: ?string,
  modifiers: ?ASTModifiers
) {
  (el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
}

/*
    其实就是将 { value, modifiers } 添加到数组 el.events[name] 中
    至于加在数组最前面还是数组最后面，取决于参数 important
 */
export function addHandler (
  el: ASTElement,
  name: string,
  value: string,
  modifiers: ?ASTModifiers,
  important?: boolean,
  warn?: Function
) {

  /*
    dom 新的规范规定，addEventListener() 的第三个参数可以是个对象值了，该对象可用的属性有三个：
    addEventListener(type, listener, {
        capture: false,   // 等价于以前的 useCapture 参数
        passive: false,   // true 表明不会调用 preventDefault 函数来阻止默认滑动行为
        once: false       // true 表明该监听器是一次性的
    })

    当属性 passive 的值为 true 的时候，代表该监听器内部不会调用 preventDefault 函数来阻止默认滑动行为，
    Chrome 浏览器称这类型的监听器为顺从(passive)监听器。目前 Chrome 主要利用该特性来优化页面的滑动性能，
    所以 Passive Event Listeners 特性当前仅支持 mousewheel/touch 相关事件。
  */
 
  // warn prevent and passive modifier
  if (
    process.env.NODE_ENV !== 'production' && warn &&
    modifiers && modifiers.prevent && modifiers.passive
  ) {
    // passive 和 prevent 不能一起用。passive 处理函数不能阻止默认事件。
    warn(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.'
    )
  }

  // 第 1 步: 修正 name 和 modifiers

  if (modifiers && modifiers.capture) {
    delete modifiers.capture
    // 标记该事件为捕获模式
    name = '!' + name
  }
  if (modifiers && modifiers.once) {
    delete modifiers.once
    // 标记该事件只触发一次
    name = '~' + name 
  }
  if (modifiers && modifiers.passive) {
    delete modifiers.passive
    // 标记该事件是顺从的
    name = '&' + name
  }

  // 第 2 步: 获取 events

  let events
  if (modifiers && modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }

  // 待添加的 handler
  const newHandler = { value, modifiers }
  // 原来的 hanlers 数组
  const handlers = events[name]
  
  // 第 3 步: 往 events 中添加 { value: value, modifiers: modifiers }

  // ① handlers 是数组，那就把 newHandler 加入到这个数组中，至于是加在最前面还是最后面，取决于 important 参数
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  // ② handlers 不是数组，那就将 newHandler 和 handlers 拼成数组
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  // ③ handlers 不存在，用 newHandler 初始化之
  } else {
    events[name] = newHandler
  }
}



// 首先获取动态值，获取不到再获取静态值。
export function getBindingAttr (
  el: ASTElement,
  name: string,
  getStatic?: boolean
): ?string {
  /*
      以 <a v-bind:href="url">...</a> 为例：
      ① dynamicValue = el.attrsMap[':href'] || el.attrsMap['v-bind:href']
      ② 删除 el.attrsList 数组中 ':href' 或 'v-bind:href' 对应项
   */
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||
    getAndRemoveAttr(el, 'v-bind:' + name)

  // 1. 动态值
  if (dynamicValue != null) {
    // 解析为字符串，例如：parseFilters("message | filterA | filterB") -> "_f("filterB")(_f("filterA")(message))"
    return parseFilters(dynamicValue)
  // 2. 静态值
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      // 解析为字符串
      return JSON.stringify(staticValue)
    }
  }
}

// 删除 el.attrsList 数组中 name 对应项，并返回 el.attrsMap[name]
export function getAndRemoveAttr (el: ASTElement, name: string): ?string {
  let val
  /*
    ① el.attrsMap 是一个 json 对象，结构大概是：
    {
        name1 : value1,
        name2 : value2,
        name3 : value3,
        ...
    }

    ② el.attrsList 是一个数组，结构大概是：
    [
        {
            name : name1,
            value : value1
        },
        {
            name : name2,
            value : value2
        }
        ...
    ]
  */
  // ① 获取 el.attrsMap[name] 作为最终返回值
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      // ② 删除 el.attrsList 中对应项
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  // 返回属性值
  return val
}
