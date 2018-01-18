/* @flow */

import { isDef } from 'shared/util'

// 获取第一个子组件
export function getFirstComponentChild (children: ?Array<VNode>): ?VNode {
  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i]
      // 只有组件才有 componentOptions 属性
      if (isDef(c) && isDef(c.componentOptions)) {
        return c
      }
    }
  }
}
