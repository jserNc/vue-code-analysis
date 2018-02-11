/* @flow */

import {
  isDef,
  isUndef
} from 'shared/util'

import {
  concat,
  stringifyClass,
  genClassForVnode
} from 'web/util/index'

// 更新 class
function updateClass (oldVnode: any, vnode: any) {
  const el = vnode.elm
  const data: VNodeData = vnode.data
  const oldData: VNodeData = oldVnode.data

  // 如果新旧虚拟节点都没有 staticClass 和 class，那就在此返回
  if (
    isUndef(data.staticClass) &&
    isUndef(data.class) && (
      isUndef(oldData) || (
        isUndef(oldData.staticClass) &&
        isUndef(oldData.class)
      )
    )
  ) {
    return
  }

  // 返回字符串形式的 class 值，如 'cls1 cls2 cls3 cls4 cls5 cls6'
  let cls = genClassForVnode(vnode)

  // handle transition classes
  // 过渡相关 class
  const transitionClass = el._transitionClasses
  if (isDef(transitionClass)) {
    // concat(a,b) 连接字符串 a 和 b，中间用空格分开
    cls = concat(cls, stringifyClass(transitionClass))
  }

  // 若不等于之前的 class 值，那就更新
  if (cls !== el._prevClass) {
    el.setAttribute('class', cls)
    el._prevClass = cls
  }
}

export default {
  create: updateClass,
  update: updateClass
}
