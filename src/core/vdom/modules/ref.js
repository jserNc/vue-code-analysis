/* @flow */

import { remove } from 'shared/util'

/*
    官网给出子组件引用的用法
    使用 ref 为子组件指定一个引用 ID，就可以直接访问子组件了

    <div id="parent">
      <user-profile ref="profile"></user-profile>
    </div>

    // 新建父组件实例
    var parent = new Vue({ el: '#parent' })
    // 访问子组件实例
    var child = parent.$refs.profile

    注意：$refs 只在组件渲染完成后才填充，并且它是非响应式的。它仅仅是一个直接操作子组件的应急方案——应当避免在模板或计算属性中使用 $refs
 */

// ref 生命周期 create -> update -> destroy
export default {
  create (_: any, vnode: VNodeWithData) {
    // 添加引用
    registerRef(vnode)
  },
  update (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
      // 删除旧的引用
      registerRef(oldVnode, true)
      // 添加新的引用
      registerRef(vnode)
    }
  },
  destroy (vnode: VNodeWithData) {
    // 删除引用
    registerRef(vnode, true)
  }
}

/*
    ① 参数 isRemoval 为 true，删除引用
    ② 否则，添加引用
 */
export function registerRef (vnode: VNodeWithData, isRemoval: ?boolean) {
  const key = vnode.data.ref
  // 如果没有 ref 引用，就此返回
  if (!key) return

  /*
      vm 为当前 vnode 所在的父组件实例，例如上例中的 parent
      vm.$refs 用来管理所有子组件的引用
   */
  const vm = vnode.context

  // vnode 对应的组件实例，也就是 ref
  const ref = vnode.componentInstance || vnode.elm
  const refs = vm.$refs

  // 1. isRemoval 为 true，删除引用
  if (isRemoval) {
    /*
        ① refs[key] 是数组，删除数组中的 ref

        当 ref 和 v-for 一起使用时，获取到的引用会是一个数组，包含和循环数据源对应的子组件。
        所以 refs[key] 是一组组件实例，ref 就是其中一个
     */
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref)
    // ② refs[key] 不是数组，直接置为 undefined
    } else if (refs[key] === ref) {
      refs[key] = undefined
    }
  // 2. isRemoval 为 false/undefined/null，添加引用
  } else {
    // ① 当 ref 和 v-for 一起使用时，需要 refs[key] 需要转为数组
    if (vnode.data.refInFor) {
      // refs[key] 不是数组，转为数组
      if (!Array.isArray(refs[key])) {
        refs[key] = [ref]
      // refs[key] 是数组，添加 ref
      } else if (refs[key].indexOf(ref) < 0) {
        refs[key].push(ref)
      }
    // ② 一般情况，直接给 refs 添加 key 属性就好了
    } else {
      refs[key] = ref
    }
  }
}
