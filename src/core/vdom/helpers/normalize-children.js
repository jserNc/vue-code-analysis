/* @flow */

import VNode, { createTextVNode } from 'core/vdom/vnode'
import { isFalse, isTrue, isDef, isUndef, isPrimitive } from 'shared/util'

// The template compiler attempts to minimize the need for normalization by
// statically analyzing the template at compile time.
// 模板编译器在编译时静态分析模板，这样可以尽可能地减少对标准化处理的依赖。


/*
   对于普通的 html 标记，标准化处理是完全不需要的，因为生成的渲染函数确保能返回 Array<VNode>。

   主要有两种情况需要进行额外的标准化处理：
   1. 当 children 包含组件时（因为功能性组件可能会返回一个数组而不是一个单独的 root）
      这种情况下，仅需要一个简单的标准化处理。即：如果某个 child 是数组，那就通过 Array.prototype.concat 方法使之扁平化。
      这样就可以确保 children 数组总是一维的（功能性组件也会对它的子组件进行标准化处理）。
*/
export function simpleNormalizeChildren (children: any) {
  for (let i = 0; i < children.length; i++) {
    // 只要有一个 child 是数组，那就将整个 children 数组降 1 维
    if (Array.isArray(children[i])) {
      /*
          ① 首先看看 concat 函数的用法：
          arrayObject.concat(arrayX,arrayX,......,arrayX)
          其中： arrayX 可以是数组，也可以是具体的值

          [1,2].concat([3,4,5],6,7,[8])
          -> [1, 2, 3, 4, 5, 6, 7, 8]

          ② 为什么不直接 [].concat(children)，对比一下就知道了：

          eg: var a = [1,[2,3,4],[5,6],7,8,9];
          Array.prototype.concat.apply([], a) -> [1, 2, 3, 4, 5, 6, 7, 8, 9]
          [].concat(a) -> [1,[2,3,4],[5,6],7,8,9]

          其实，Array.prototype.concat.apply([], a) 相当于：[].concat(a[0],a[1],...,a[a.length - 1])
          也就是 [].concat(1,[2,3,4],[5,6],7,8,9) -> [1, 2, 3, 4, 5, 6, 7, 8, 9]
       
          ③ 可以看出，这样做只能将数组降 1 个维度，例如：
          Array.prototype.concat.apply([], [1,[2,[3],4]])
          -> [1, 2, [3], 4]
       */
      return Array.prototype.concat.apply([], children)
    }
  }
  return children
}

/*
   2. 当 children 包含产生嵌套数组（多维数组）的结构时（e.g. <template>, <slot>, v-for）或 children 是用户手写的渲染函数/JSX 提供的。
      这种情况下，就需要一整套的标准化处理来应该各种类型的 children。
*/
export function normalizeChildren (children: any): ?Array<VNode> {
  /*
    ① children 为字符串（string）或数值（number），返回 [ children 转成的文本 VNode ]
    ② children 为数组，返回 normalizeArrayChildren(children)
    ③ 其他，返回 undefined
  */
  return isPrimitive(children)
    ? [createTextVNode(children)]
    : Array.isArray(children)
      ? normalizeArrayChildren(children)
      : undefined
}

// 判断文本节点
function isTextNode (node): boolean {
  return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}

// 将数组类型的 children 进行标准化处理，返回结果也为一个数组
function normalizeArrayChildren (children: any, nestedIndex?: string): Array<VNode> {
  const res = []
  let i, c, last
  for (i = 0; i < children.length; i++) {
    c = children[i]
    // ① 如果 children[i] 是 undefined/null/布尔值，那就跳过本次循环
    if (isUndef(c) || typeof c === 'boolean') continue

    /*
        这里的 last 为上一个加到 res 数组中的 children[i]

        最开始 res 为 []，last = res[-1]，也没什么影响，这样 isTextNode(last) 就是 false，对下面代码执行流程没影响
     */
    last = res[res.length - 1]

    //  ② 如果 children[i] 也是数组，递归
    if (Array.isArray(c)) {
      /*
        注意：这里用的是 res.push.apply(res,arr)，而不是 res.push(arr)，其中 arr 为数组
        push 用法是 arrayObject.push(newelement1,newelement2,...)，例如：
        [].push([1,2,3]) -> [[1,2,3]]
        [].push(1,2,3) -> [1,2,3]

        所以，res.push.apply(res,arr) 可以起到降维的作用（将数组 arr 的元素的元素拆开，一个个加进 res 数组）
       */
      res.push.apply(res, normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`))
    // ③ 如果 children[i] 是原始类型值（字符串或者数值）
    } else if (isPrimitive(c)) {
      // a. 上个节点也是文本节点，那就合并毗邻的文本节点
      if (isTextNode(last)) {
        (last: any).text += String(c)
      // b. 否则，将文本 children[i] 转为文本 vnode
      } else if (c !== '') {
        res.push(createTextVNode(c))
      }
    // ④ 如果 children[i] 是其他类型值
    } else {
      // a. 上个节点也是文本节点，那就合并毗邻的文本节点
      if (isTextNode(c) && isTextNode(last)) {
        res[res.length - 1] = createTextVNode(last.text + c.text)
      // b. 其他所有情况，将 children[i] 直接加入 res 数值
      } else {
        if (isTrue(children._isVList) &&
          isDef(c.tag) &&
          isUndef(c.key) &&
          isDef(nestedIndex)) {
          // 给 v-for 中的 c.key 赋值
          c.key = `__vlist${nestedIndex}_${i}__`
        }
        res.push(c)
      }
    }
  }
  return res
}
