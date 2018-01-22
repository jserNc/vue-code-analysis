/* @flow */

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
// 返回值为 vonde
export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode {
  // 若 data 为数组、字符串、数值，则参数含义重新分配
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  // 强制正常标准化
  if (isTrue(alwaysNormalize)) {
    /*
      SIMPLE_NORMALIZE = 1; 简单标准化
      ALWAYS_NORMALIZE = 2; 正常标准化
    */
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}

/*
  该函数的作用是生成 vnode，分为以下几类：
  ① data && data.__ob__ 存在，return createEmptyVNode()
  ② !tag 即 tag 不存在时，return createEmptyVNode()
  ③ tag 是 html/svg 内置标签名，return vnode = new VNode(config.parsePlatformTagName(tag), data, children, undefined, undefined, context);
  ④ tag 是组件标签名（字符串），return vnode = createComponent(resolveAsset(context.$options, 'components', tag), data, context, children, tag);
  ⑤ tag 是其他字符串，return vnode = new VNode(tag, data, children, undefined, undefined, context);
  ⑥ tag 是构造函数名，return vnode = createComponent(tag, data, context, children);
 
  可以看出，除了直接调用 new VNode() 生成 vnode，就是用 createComponent() 和 createEmptyVNode() 来生成 vnode 
 */
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode {
  // ① 对 data 进行检查。避免使用被 observed 的 data 对象作为 vnode data
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    // 返回空的 vnode
    return createEmptyVNode()
  }

  /*
      var vm = new Vue({
        el: '#example',
        data: {
          currentView: 'home'
        },
        components: {
          home: { ... },
          posts: { ...  },
          archive: { ... }
        }
      })
      <component v-bind:is="currentView">
        <!-- 组件在 vm.currentview 变化时改变！ -->
      </component>

      对 vm.currentView 进行修改就可以在同一个挂载点动态切换多个组件了
   */

  // ② 对 data.is 进行检查
  if (isDef(data) && isDef(data.is)) {
    // 如果有 is 属性，用该属性值作为真正的标签名
    tag = data.is
  }

  // ③ 对 tag 进行检查
  if (!tag) {
    // in case of component :is set to falsy value
    // 得注意 :is 被设置为假值的情况
    return createEmptyVNode()
  }

  // ④ 对 data.key 进行检查
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    // key 值必须为字符串或数值等基本数据类型
    warn(
      'Avoid using non-primitive value as key, ' +
      'use string/number value instead.',
      context
    )
  }

  // ⑤ 对 children 进行检查和修正
  /*
      若 children 是数组，并且 children[0] 是函数，那么：
      1. 将这个函数作为默认的 scoped slot
      2. 将 children 数组清空
   */
  // support single function children as default scoped slot
  if (Array.isArray(children) && typeof children[0] === 'function') {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }

  // 对 children 数组进行修正，修正后 children 还是数组
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }

  // ⑥ 根据参数，生成 vnode
  let vnode, ns

  // 1. tag 是字符串
  if (typeof tag === 'string') {
    let Ctor
    // 获取该 tag 的命名空间
    ns = config.getTagNamespace(tag)

    // a. tag 是 html/svg 内置标签名
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      vnode = new VNode(
        /*
            identity = function (_) { return _; };
            config.parsePlatformTagName = identity;
            也就是说，直接用这个内置标签名
         */
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    // b. tag 是组件构造函数名
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    // c. 其他未知标签名
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  // 2. tag 为其他类型
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }

  // 如果有 vnode 就返回 vnode 
  if (isDef(vnode)) {
    // 标记命名空间
    if (ns) applyNS(vnode, ns)
    return vnode
  // 否则返回空 vnode
  } else {
    return createEmptyVNode()
  }
}

// 标记 vnode.ns = ns，vnode 和其子节点共用同一个 ns
function applyNS (vnode, ns) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    return
  }
  // 遍历子节点，递归调用 applyNS(child, ns)
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      // 子节点没有 ns 属性，标记之
      if (isDef(child.tag) && isUndef(child.ns)) {
        applyNS(child, ns)
      }
    }
  }
}
