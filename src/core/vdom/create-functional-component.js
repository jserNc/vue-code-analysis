/* @flow */

import VNode from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'

import {
  isDef,
  camelize,
  validateProp
} from '../util/index'

/*
  createFunctionalComponent 只在 createComponent 函数中调用：
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }
  如果组件构造函数选项里 functional 为 true，那么该组件就是函数式组件
  例如：
  Vue.component('my-component', {
    functional: true,
    // 为了弥补缺少的实例，提供第二个参数作为上下文
    render: function (createElement, context) {
      // ...
    },
    // Props 可选
    props: {
      // ...
    }
  })
  
 【函数式组件的特点是】：它无状态 (没有 data)，无实例 (没有 this 上下文)。
  
  对比一下普通的组件定义：
  Vue.component('anchored-heading', {
    render: function (createElement) {
      // render 函数只有一个参数
    },
    props: {
      // ...
    }
  })

  函数式组件和普通组件定义的不同点体现在：
  1. 显式指定 functional: true
  2. render 函数多一个参数 context 代表上下文
     其中，context 包括以下属性供组件使用：
     props：提供 props 的对象
     children: VNode 子节点的数组
     slots: slots 对象
     data：传递给组件的 data 对象
     parent：对父组件的引用
     listeners: (2.3.0+) 一个包含了组件上所注册的 v-on 侦听器的对象。这只是一个指向 data.on 的别名。
     injections: (2.3.0+) 如果使用了 inject 选项，则该对象包含了应当被注入的属性。
 */

// 创建函数式组件，返回值为 vnode
export function createFunctionalComponent (
  Ctor: Class<Component>,
  propsData: ?Object,
  data: VNodeData,
  context: Component,
  children: ?Array<VNode>
): VNode | void {
  const props = {}
  const propOptions = Ctor.options.props

  /*
    在 2.3.0 之前的版本中，如果一个函数式组件想要接受 props，则 props 选项是必须的。
    在 2.3.0 或以上的版本中，你可以省略 props 选项，所有组件上的属性都会被自动解析为 props。
   */
  // ① 定义了 Ctor.options.props，那就以它作为 props
  if (isDef(propOptions)) {
    // 遍历 Ctor.options.props，以键值对的形式存到 props 对象中
    for (const key in propOptions) {
      // 返回合法的属性值
      props[key] = validateProp(key, propOptions, propsData || {})
    }
  // ② 否则，就将 data.attrs 和 data.props 作为 props
  } else {
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    if (isDef(data.props)) mergeProps(props, data.props)
  }

  // ensure the createElement function in functional components
  // gets a unique context - this is necessary for correct named slot check
  /*
      对于组件选项中的 render 函数，函数式组件会比普通的组件多一个执行上下文 context 参数
      render: function (createElement, context) {
        // ...
      }
   */
  const _context = Object.create(context)
  /*
      h 是一个函数，该函数的作用是返回一个 vnode
      h(a, b, c, d)
      -> createElement(_context, a, b, c, d, true)

      SIMPLE_NORMALIZE = 1; 简单标准化
      ALWAYS_NORMALIZE = 2; 正常标准化

      createElement 最后一个参数为 true 表示对 children(c) 强制采用”正常标准化”处理
   */
  const h = (a, b, c, d) => createElement(_context, a, b, c, d, true)
  /*
      函数式组件在声明的时候，render 函数有两个参数：
      // 为了弥补缺少的实例，提供第二个参数作为上下文
      render: function (createElement, context) {
        // ...
      }
   */
  const vnode = Ctor.options.render.call(null, h, {
    data,
    props,
    children,
    parent: context,
    listeners: data.on || {},
    /*
        resolveInject() 返回一个 json 对象，键名为 inject 中【数组索引 | 属性名】，键值为 provide【属性名】中属性值
        例如：
        {
          'foo' : 'bar'
        }
     */
    injections: resolveInject(Ctor.options.inject, context),
    /*
        slots 是一个函数，执行结果是一个 json 对象，每个子属性是由 dom 元素组成的数组
        slots()
        -> resolveSlots(children, context)
        -> {
          default : [...],
          name1 : [...],
          name2 : [...],
          ...
        }
     */
    slots: () => resolveSlots(children, context)
  })
  // 给 vnode 添加属性
  if (vnode instanceof VNode) {
    vnode.functionalContext = context
    vnode.functionalOptions = Ctor.options
    if (data.slot) {
      (vnode.data || (vnode.data = {})).slot = data.slot
    }
  }
  return vnode
}

// 将 from 的属性（属性名驼峰化）都赋给 to
function mergeProps (to, from) {
  for (const key in from) {
    // camelize 方法将连字符分隔的字符串驼峰化，例如：camelize('a-b-c') -> aBC
    to[camelize(key)] = from[key]
  }
}
