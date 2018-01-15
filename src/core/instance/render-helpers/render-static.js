/* @flow */

import { cloneVNode, cloneVNodes } from 'core/vdom/vnode'

/**
 * Runtime helper for rendering static trees.
 */
// Vue.prototype._m = renderStatic;
export function renderStatic (
  index: number,
  isInFor?: boolean
): VNode | Array<VNode> {
  let tree = this._staticTrees[index]
  // if has already-rendered static tree and not inside v-for,
  // we can reuse the same tree by doing a shallow clone.
  
  // ① 如果之前已经渲染了静态树并且不是在 v-for 内部。我们可以通过浅拷贝来复用这颗树，就此返回。
  if (tree && !isInFor) {
    return Array.isArray(tree)
      ? cloneVNodes(tree) // 克隆一组节点
      : cloneVNode(tree)  // 克隆一个节点
  }
  // ② 否则，生成一棵新的静态树（staticRenderFns 函数的作用就是生成静态树）
  tree = this._staticTrees[index] =
    this.$options.staticRenderFns[index].call(this._renderProxy)
  
  // 标记 tree 里的每个节点
  markStatic(tree, `__static__${index}`, false)
  return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 */
export function markOnce (
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}

function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {
  // ① tree 是多个节点组成的数组
  if (Array.isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  // ② tree 是单个节点
  } else {
    markStaticNode(tree, key, isOnce)
  }
}

// 标记静态节点
function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}
