/* @flow */

// Provides transition support for a single element/component.
// supports transition mode (out-in / in-out)

import { warn } from 'core/util/index'
import { camelize, extend, isPrimitive } from 'shared/util'
import { mergeVNodeHook, getFirstComponentChild } from 'core/vdom/helpers/index'

// 过渡相关 prop
export const transitionProps = {
  name: String,
  appear: Boolean,
  css: Boolean,
  mode: String,   // out-in / in-out
  type: String,

  // 进入相关 class 
  enterClass: String,
  leaveClass: String,
  enterToClass: String,

  // 离开相关 class
  leaveToClass: String,
  enterActiveClass: String,
  leaveActiveClass: String,

  // 出现相关 class
  appearClass: String,
  appearActiveClass: String,
  appearToClass: String,

  // 持续时间
  duration: [Number, String, Object]
}

// in case the child is also an abstract component, e.g. <keep-alive>
// we want to recursively retrieve the real component to be rendered
// 我们需要递归地检索出真正需要被重新渲染的组件，以免子组件也是一个抽象组件（例如 <keep-alive>）。返回需要被重新渲染的 vnode
function getRealChild (vnode: ?VNode): ?VNode {
  const compOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
  // 如果子组件也是抽象组件，那就递归检索
  if (compOptions && compOptions.Ctor.options.abstract) {
    // getFirstComponentChild() 用来获取第一个子组件
    return getRealChild(getFirstComponentChild(compOptions.children))
  } else {
    return vnode
  }
}

// 提取 transition 数据，返回一个 json 对象
export function extractTransitionData (comp: Component): Object {
  const data = {}
  const options: ComponentOptions = comp.$options
  // ① 提取 props
  for (const key in options.propsData) {
    data[key] = comp[key]
  }

  // ② 提取 events
  // extract listeners and pass them directly to the transition methods
  const listeners: ?Object = options._parentListeners
  for (const key in listeners) {
    data[camelize(key)] = listeners[key]
  }
  return data
}

// 渲染占位符，生成 <keep-alive> 元素
function placeholder (h: Function, rawChild: VNode): ?VNode {
  if (/\d-keep-alive$/.test(rawChild.tag)) {
    return h('keep-alive', {
      props: rawChild.componentOptions.propsData
    })
  }
}

// 只要有一个父组件有 transition 数据，就返回 true
function hasParentTransition (vnode: VNode): ?boolean {
  while ((vnode = vnode.parent)) {
    if (vnode.data.transition) {
      return true
    }
  }
}

// 新旧子节点的 key 和 tag 都相同，就认为是同一个子节点
function isSameChild (child: VNode, oldChild: VNode): boolean {
  return oldChild.key === child.key && oldChild.tag === child.tag
}

// 同时拥有 isComment、asyncFactory 等两个属性就认为是异步占位符
function isAsyncPlaceholder (node: VNode): boolean {
  return node.isComment && node.asyncFactory
}

// Transition 组件配置对象
export default {
  name: 'transition',
  props: transitionProps,
  // 抽象组件
  abstract: true,

  render (h: Function) {
    let children: ?Array<VNode> = this.$options._renderChildren

    // 若没有子元素，就此返回
    if (!children) {
      return
    }

    // filter out text nodes (possible whitespaces)
    // 剔除掉文本元素
    children = children.filter((c: VNode) => c.tag || isAsyncPlaceholder(c))

    // 如果剔除文本子元素后不剩下子元素了，那就返回
    if (!children.length) {
      return
    }

    // warn multiple elements
    // 警告：<transition> 只能用于单一的元素，<transition-group> 可以用于列表
    if (process.env.NODE_ENV !== 'production' && children.length > 1) {
      warn(
        '<transition> can only be used on a single element. Use ' +
        '<transition-group> for lists.',
        this.$parent
      )
    }

    /*
        in-out：新元素先进行过渡，完成之后当前元素过渡离开。
        out-in：当前元素先进行过渡，完成之后新元素过渡进入。
    */
    const mode: string = this.mode

    // 警告：mode 必须是 in-out/out-in，其他的无效
    if (process.env.NODE_ENV !== 'production' &&
      mode && mode !== 'in-out' && mode !== 'out-in'
    ) {
      warn(
        'invalid <transition> mode: ' + mode,
        this.$parent
      )
    }

    // 原元素
    const rawChild: VNode = children[0]

    // if this is a component root node and the component's
    // parent container node also has transition, skip.
    // 如果祖先节点也有 transition，那就返回
    if (hasParentTransition(this.$vnode)) {
      return rawChild
    }

    // apply transition data to child
    // use getRealChild() to ignore abstract components e.g. keep-alive
    // getRealChild() 方法会忽略抽象组件，找到真正需要被渲染的组件
    const child: ?VNode = getRealChild(rawChild)
    // 如果除了抽象组件不剩下什么，那就返回
    if (!child) {
      return rawChild
    }

    // 如果正在离开过渡，渲染占位符，生成 <keep-alive> 元素
    if (this._leaving) {
      return placeholder(h, rawChild)
    }

    // ensure a key that is unique to the vnode type and to this transition
    // component instance. This key will be used to remove pending leaving nodes
    // during entering.
    // 确保 key 对于某种 vnode 类型或者对于过渡组件实例是唯一的。在 entering 过程中这个 key 会被用来移除 pending leaving 节点
    const id: string = `__transition-${this._uid}-`

    /*
        ① child.key == null
           a. child.isComment == true
              child.key = "__transition-" + (this._uid) + "-comment"
           b. child.isComment != true
              child.key = "__transition-" + (this._uid) + child.tag

        ② child.key != null
           a. child.key 是数值或字符串
              child.key = "__transition-" + (this._uid) + child.key
           b. child.key 是其他值
              child.key = child.key

        总之，这里对 child.key 进行修正
    */
    child.key = child.key == null
      ? child.isComment
        ? id + 'comment'
        : id + child.tag
      : isPrimitive(child.key)
        ? (String(child.key).indexOf(id) === 0 ? child.key : id + child.key)
        : child.key

    /*
        extractTransitionData() 方法用于提取 props 和 listeners，返回一个 json 对象
        这里把这个 json 对象赋值给 child.data.transition
    */
    const data: Object = (child.data || (child.data = {})).transition = extractTransitionData(this)
    // 旧的原元素
    const oldRawChild: VNode = this._vnode
    // getRealChild() 方法会忽略抽象组件，找到真正需要被渲染的组件
    const oldChild: VNode = getRealChild(oldRawChild)

    // mark v-show
    // so that the transition module can hand over the control to the directive
    // 只要有一个指令的名称为 'show'，那就把 child.data.show 标记为 true（标记 v-show）
    if (child.data.directives && child.data.directives.some(d => d.name === 'show')) {
      child.data.show = true
    }

    // 新旧节点不相同，并且旧节点不是异步占位符
    if (
      oldChild &&
      oldChild.data &&
      !isSameChild(child, oldChild) &&
      !isAsyncPlaceholder(oldChild)
    ) {
      // replace old child transition data with fresh one, important for dynamic transitions!
      // 用 child.data.transition 的属性覆盖 oldChild.data.transition 的属性
      const oldData: Object = oldChild && (oldChild.data.transition = extend({}, data))
      
      // ① 当前元素先进行过渡，完成之后新元素过渡进入
      if (mode === 'out-in') {
        // return placeholder node and queue update when leave finishes
        // 标记正在离开
        this._leaving = true
        /*
            mergeVNodeHook (def, hookKey, hook) 将钩子方法 hook 加入到 def[hookKey] 中，也就是添加一个钩子方法，以后执行 def[hookKey] 也就会执行 hook 方法了
            钩子函数合并后，'afterLeave' 钩子函数会强制更新视图
         */
        mergeVNodeHook(oldData, 'afterLeave', () => {
          this._leaving = false
          this.$forceUpdate()
        })
        return placeholder(h, rawChild)
      // ② 新元素先进行过渡，完成之后当前元素过渡离开
      } else if (mode === 'in-out') {
        if (isAsyncPlaceholder(child)) {
          return oldRawChild
        }
        let delayedLeave
        const performLeave = () => { delayedLeave() }
        mergeVNodeHook(data, 'afterEnter', performLeave)
        mergeVNodeHook(data, 'enterCancelled', performLeave)
        mergeVNodeHook(oldData, 'delayLeave', leave => { delayedLeave = leave })
      }
    }

    return rawChild
  }
}
