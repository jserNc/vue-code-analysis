/* @flow */

import { isIE9 } from 'core/util/env'
import { enter, leave } from '../modules/transition'

// recursively search for possible transition defined inside the component root
// 在当前 vnode 递归查找 transition。找到了就返回那个 vnode
function locateNode (vnode: VNode): VNodeWithData {
  return vnode.componentInstance && (!vnode.data || !vnode.data.transition)
    ? locateNode(vnode.componentInstance._vnode)
    : vnode
}


/*
    自定义指令，例如注册一个全局自定义指令 `v-focus`
    Vue.directive('focus', {
      inserted: function (el) {
        el.focus()
      }
    })

    一个指令对象可包括以下几个钩子函数，例如：
    bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
    inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
    update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
    componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
    unbind：只调用一次，指令与元素解绑时调用。

    钩子函数参数分别如下：
    node：指令所绑定的元素，可以用来直接操作 DOM 。
    dir：一个对象，包含以下属性：
        name：指令名，不包括 v- 前缀。
        value：指令的绑定值，例如：v-my-directive="1 + 1" 中，绑定值为 2。
        oldValue：指令绑定的前一个值，仅在 update 和 componentUpdated 钩子中可用。无论值是否改变都可用。
        expression：字符串形式的指令表达式。例如 v-my-directive="1 + 1" 中，表达式为 "1 + 1"。
        arg：传给指令的参数，可选。例如 v-my-directive:foo 中，参数为 "foo"。
        modifiers：一个包含修饰符的对象。例如：v-my-directive.foo.bar 中，修饰符对象为 { foo: true, bar: true }。
    vnode：Vue 编译生成的虚拟节点。
    oldVnode：上一个虚拟节点，仅在 update 和 componentUpdated 钩子中可用。
*/

export default {
  // 指令第一次绑定到元素时调用
  bind (el: any, { value }: VNodeDirective, vnode: VNodeWithData) {
    // 过渡元素
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition

    /*
        这里的 originalDisplay 要获取的是 el 在可见状态下的 style 值
        ① 若当前 el.style.display === 'none'，那么可见状态下应该为 ''
        ② 若当前 el.style.display !== 'none'，那么这就是可见状态
     */
    const originalDisplay = el.__vOriginalDisplay =
      el.style.display === 'none' ? '' : el.style.display

    // 1. 过渡进入（value 为真）
    if (value && transition && !isIE9) {
      vnode.data.show = true
      // 过渡进入
      enter(vnode, () => {
        el.style.display = originalDisplay
      })
    // 2. 直接显示/隐藏（value 为真时显示，否则隐藏）
    } else {
      el.style.display = value ? originalDisplay : 'none'
    }
  },

  // 所在组件的 VNode 更新时调用
  update (el: any, { value, oldValue }: VNodeDirective, vnode: VNodeWithData) {
    
    // 新旧虚拟节点一样，直接返回
    if (value === oldValue) return

    // 过渡元素
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    
    // 1. 过渡
    if (transition && !isIE9) {
      vnode.data.show = true
      // ① 进入过渡
      if (value) {
        enter(vnode, () => {
          el.style.display = el.__vOriginalDisplay
        })
      // ② 离开过渡
      } else {
        leave(vnode, () => {
          el.style.display = 'none'
        })
      }
    // 2. 直接显示/隐藏（value 为真时显示，否则隐藏）
    } else {
      el.style.display = value ? el.__vOriginalDisplay : 'none'
    }
  },

  // 指令与元素解绑时调用
  unbind (
    el: any,
    binding: VNodeDirective,
    vnode: VNodeWithData,
    oldVnode: VNodeWithData,
    isDestroy: boolean
  ) {
    // 恢复默认可见状态下 display 值
    if (!isDestroy) {
      el.style.display = el.__vOriginalDisplay
    }
  }
}
