/* @flow */

import { isDef, isObject } from 'shared/util'

// 返回字符串形式的 class 值，如 'cls1 cls2 cls3 cls4 cls5 cls6'
export function genClassForVnode (vnode: VNode): string {
  let data = vnode.data
  let parentNode = vnode
  let childNode = vnode

  // 1. 从当前组件开始，逐级拼接子组件的 class
  while (isDef(childNode.componentInstance)) {
    childNode = childNode.componentInstance._vnode
    if (childNode.data) {
      data = mergeClassData(childNode.data, data)
    }
  }

  // 2. 从当前组件开始，组件拼接祖先组件的 class
  while (isDef(parentNode = parentNode.parent)) {
    if (parentNode.data) {
      data = mergeClassData(data, parentNode.data)
    }
  }

  // 合并静态和动态 class 值，返回字符串形式的 class 值
  return renderClass(data.staticClass, data.class)
}

/*
    合并父子元素 class（静态和静态合并，动态和动态合并），返回一个 json 对象
    {
        staticClass : 'cls1 cls2...',
        class : [child.class, parent.class]
    }
 */
function mergeClassData (child: VNodeData, parent: VNodeData): {
  staticClass: string,
  class: any
} {
  return {
    staticClass: concat(child.staticClass, parent.staticClass),
    class: isDef(child.class)
      ? [child.class, parent.class]
      : parent.class
  }
}

/*
    拼接静态、动态 class 值

    例如:
    静态 staticClass = 'cls1 cls2 cls3'
    动态 dynamicClass = {
        cls4 : 'val1',
        cls5 : 'val2',
        cls6 : 'val3'
    }

    拼接后：'cls1 cls2 cls3 cls4 cls5 cls6'
 */
export function renderClass (
  staticClass: ?string,
  dynamicClass: any
): string {
  // ① 有静态/动态 class
  if (isDef(staticClass) || isDef(dynamicClass)) {
    return concat(staticClass, stringifyClass(dynamicClass))
  }
  // ② 没有 class，直接返回空字符串
  return ''
}

// 连接字符串 a 和 b，中间用空格分开
export function concat (a: ?string, b: ?string): string {
  return a ? b ? (a + ' ' + b) : a : (b || '')
}

/*
    将 value 转为字符串形式的 class 值，例如：

    ① value 为数组
    stringifyClass(['cls1','cls2','cls3']);
    -> "cls1 cls2 cls3"

    ② value 为对象
    stringifyClass({
        cls1 : 'val1',
        cls2 : 'val2',
        cls3 : 'val3'
    });
    -> "cls1 cls2 cls3"
 */ 
export function stringifyClass (value: any): string {
  if (Array.isArray(value)) {
    return stringifyArray(value)
  }
  if (isObject(value)) {
    return stringifyObject(value)
  }
  if (typeof value === 'string') {
    return value
  }
  /* istanbul ignore next */
  return ''
}

/*
    数组转为字符串形式，元素之间用空格分开，例如：
    stringifyArray(['cls1','cls2','cls3']);
    -> "cls1 cls2 cls3"
*/
function stringifyArray (value: Array<any>): string {
  let res = ''
  let stringified
  for (let i = 0, l = value.length; i < l; i++) {
    if (isDef(stringified = stringifyClass(value[i])) && stringified !== '') {
      if (res) res += ' '
      res += stringified
    }
  }
  return res
}

/*
    对象转为字符串形式，注意只取出对象的键名，用空格分开，例如：
    stringifyObject({
        cls1 : 'val1',
        cls2 : 'val2',
        cls3 : 'val3'
    });
    -> "cls1 cls2 cls3"
*/
function stringifyObject (value: Object): string {
  let res = ''
  for (const key in value) {
    if (value[key]) {
      if (res) res += ' '
      res += key
    }
  }
  return res
}
