/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

// patch 过程中在组件的 vnode 上触发的钩子
const componentVNodeHooks = {
  // 1. 初始化（创建组件实例）
  init (
    vnode: VNodeWithData,
    hydrating: boolean,
    parentElm: ?Node,
    refElm: ?Node
  ): ?boolean {
    // ① 若该 vnode 没有对应的组件实例，那就创建一个新的
    if (!vnode.componentInstance || vnode.componentInstance._isDestroyed) {
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        // activeInstance 为全局唯一的正在激活状态的组件实例
        activeInstance,
        parentElm,
        refElm
      )
      /*
          vm.$mount() 手动地挂载一个未挂载的实例
          a. 参数为元素选择器，挂载到该元素，替换的该元素内容
          var MyComponent = Vue.extend({
            template: '<div>Hello!</div>'
          })
          new MyComponent().$mount('#app')

          b. 参数为空/undefined，在文档之外渲染，随后再挂载
          var component = new MyComponent().$mount()
          document.getElementById('app').appendChild(component.$el)
       */
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    // ② vnode 有对应的组件实例，那就更新这个组件（这里的 vnode.data.keepAlive 是个布尔值，true）
    } else if (vnode.data.keepAlive) {
      // kept-alive components, treat as a patch
      // kept-alive 组件，当做 patch 对待
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    }
  },

  // 2. prepatch（更新组件实例）
  /*
      看看数据类型 MountedComponentVNode：
      declare type MountedComponentVNode = {
        context: Component;
        componentOptions: VNodeComponentOptions;
        componentInstance: Component;
        parent: VNode;
        data: VNodeData;
      };

      prepatch(oldVnode,vnode) 的作用是更新组件：
      ① 从 oldVnode 中获取对应的组件实例 child
      ② 对实例 child 的 props、listeners、parent vnode、children 等进行更新
   */
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    // 组件实例
    const child = vnode.componentInstance = oldVnode.componentInstance
    // 对组件 child 的 props、listeners、parent vnode、children 等进行更新
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode,             // new parent vnode
      options.children   // new children
    )
  },

  // 3. insert（标记组件的 _isMounted、_directInactive 等状态）
  insert (vnode: MountedComponentVNode) {
    /*
        var context = vnode.context;
        var componentInstance = vnode.componentInstance;

        context 和 componentInstance 都是 Component 类型，也就是说都是组件实例
        做个猜想（未验证）：
        ① componentInstance 是 vnode 对应的组件实例
        ② context 是父组件实例
     */
    const { context, componentInstance } = vnode
    // ① 标记 componentInstance._isMounted 为 true
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    // ② 标记激活了组件 componentInstance
    if (vnode.data.keepAlive) {
      // a. 将 componentInstance 添加到 activatedChildren 数组中（随后这个 componentInstance 组件会被标记激活了）
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      // b. 直接标记激活了组件 componentInstance
      } else {
        // 
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  // 4. destroy（销毁组件）
  destroy (vnode: MountedComponentVNode) {
    // var componentInstance = vnode.componentInstance 即 vnode 对应的组件实例
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      // ① 不需要 keepAlive，直接销毁
      if (!vnode.data.keepAlive) {
        // 销毁组件
        componentInstance.$destroy()
      // ② 需要 keepAlive，那就标记失效
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

// ["init", "prepatch", "insert", "destroy"]
const hooksToMerge = Object.keys(componentVNodeHooks)

// 返回 vnode
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | void {
  // ① 若没指定构造函数 Ctor，就此返回
  if (isUndef(Ctor)) {
    return
  }

  // baseCtor 指的是构造函数 Vue ?
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // ② 若 Ctor 是个选项对象，那就将其转为构造函数
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory, reject.
  // ③ 到这里，Ctor 还不是构造函数，那就发出警告，并返回
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // 1. 异步组件
  let asyncFactory
  /*
    ① 异步组件工厂函数 factory 只是普通的函数，没有 factory.cid 属性
    ② 而通过 Ctor = Vue.extend(extendOptions) 创建的组件构造函数都有 Ctor.cid 属性
 */
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    // 根据工厂函数 asyncFactory 的不同状态返回不同的组件构造函数
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    /*
        resolveAsyncComponent() 返回值为 undefined，说明异步任务没执行完，组件构造函数还没创建
        那就调用 createAsyncPlaceholder() 先创建一个占位符
     */
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      // 创建组件占位符（看起来像注释节点，但是它会保存节点所有的原始信息，水化后就可以变成正常节点了）
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  /*
      Ctor.options = Ctor.super.options + Ctor.extendOptions，也就是：
      子类构造函数的 options 是父类构造函数的 options 和自身扩展的 options 和并集
   */
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  if (isDef(data.model)) {
    // 自定义组件 v-model 绑定的 prop 和 event（默认情况下是 value 和 input）
    transformModel(Ctor.options, data)
  }

  // extract props
  /*
    ① 遍历 Ctor.options.props 对象的键名 key
    ② 从 data.props 和 data.attrs 提取值
    ③ 若找到 (data.props | data.attrs)[key]，就复制到 res 对象中
    ④ 最后返回 json 对象 res
 */
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // 2. 函数式组件，返回 vnode
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  /*
      除了 props & listeners & slot，抽象组件不需要任何数据了
      ① 将 data 对象清空
      ② data.slot 属性重新加回来
      ③ props 和 listeners 属性在哪加回来的呢？new VNode() 过程中？
   */
  // 3. 抽象组件
  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // merge component management hooks onto the placeholder node
  // 将对象 data.hook 的 "init", "prepatch", "insert", "destroy" 四个属性进行更新
  mergeHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  // 4. 一般组件，新建 vnode
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )
  return vnode
}

// 创建与 vnode 对应的组件实例
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
  parentElm?: ?Node,
  refElm?: ?Node
): Component {
  const vnodeComponentOptions = vnode.componentOptions
  // ① 修正选项对象
  const options: InternalComponentOptions = {
    _isComponent: true,
    parent,
    propsData: vnodeComponentOptions.propsData,
    _componentTag: vnodeComponentOptions.tag,
    _parentVnode: vnode,
    _parentListeners: vnodeComponentOptions.listeners,
    _renderChildren: vnodeComponentOptions.children,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }
  /*
      1. 插槽
      假定 my-component 组件有如下模板：
      <div>
        <h2>我是子组件的标题</h2>
        <slot>
          只有在没有要分发的内容时才会显示。
        </slot>
      </div>

      父组件模板：
      <div>
        <h1>我是父组件的标题</h1>
        <my-component>
          <p>这是一些初始内容</p>
          <p>这是更多的初始内容</p>
        </my-component>
      </div>

      渲染结果：
      <div>
        <h1>我是父组件的标题</h1>
        <div>
          <h2>我是子组件的标题</h2>
          <p>这是一些初始内容</p>
          <p>这是更多的初始内容</p>
        </div>
      </div>

      2. 内联模板。如果子组件有 inline-template 特性，子组件将把它的内容当作子组件自身的模板，而不是把它当作分发内容。
      <my-component inline-template>
        <div>
          <p>这些将作为组件自身的模板。</p>
          <p>而非父组件透传进来的内容。</p>
        </div>
      </my-component>

      插槽和内联模板一对比就会发现：
      ① 对于插槽，<my-component> 里的内容是父组件的内容
      ② 对于内联模板，<my-component inline-template> 里的内容属于子组件
   */
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate

  // 对于内联组件，组件的内容都是固定的，可以直接确定 render 和 staticRenderFns
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // ② 根据选项对象创建组件实例
  return new vnodeComponentOptions.Ctor(options)
}

// 将对象 data.hook 的 "init", "prepatch", "insert", "destroy" 四个属性进行更新
function mergeHooks (data: VNodeData) {
  if (!data.hook) {
    data.hook = {}
  }
  /*
      hooksToMerge = Object.keys(componentVNodeHooks)
      -> hooksToMerge = ["init", "prepatch", "insert", "destroy"]
      
      以 key = "prepatch" 为例：
      fromParent = data.hook["prepatch"]
      ours = componentVNodeHooks["prepatch"]
      
      mergeHook(ours, fromParent) 表示合并两个钩子方法
   */
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const fromParent = data.hook[key]
    const ours = componentVNodeHooks[key]
    // 更新 data.hook[key]
    data.hook[key] = fromParent ? mergeHook(ours, fromParent) : ours
  }
}

// 合并钩子方法
function mergeHook (one: Function, two: Function): Function {
  return function (a, b, c, d) {
    one(a, b, c, d)
    two(a, b, c, d)
  }
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
/*
    将组件的自定义 v-model 信息（value 和 callback）转成 prop 和 event
    实际调用时：transformModel(Ctor.options, data)

    默认情况下 v-model 指令绑定的是表单元素的 value 属性，监听的是 input 事件。
    在定义组件实例的时候，我们可以自定义绑定的 prop 和监听的事件，例如：
    new Vue({
      ...
      model : {
        prop : 'myProp';
        event : 'click';
      }
      ...
    })
    这样 v-model 指令绑定的时候 'myProp'，监听的是 'click' 事件
 */
function transformModel (options, data: any) {
  /*
    组件选项对象的 model 属性是个 json 对象，也就是说我们定义组件实例时可以传入这种形式的 model
    declare type ComponentOptions = {
      ...
      // 自定义组件 v-model 绑定的 prop 和 event（默认情况下是 value 和 input）
      model?: {
        prop?: string;
        event?: string;
      };
      ...
    };
   */
  const prop = (options.model && options.model.prop) || 'value';
  const event = (options.model && options.model.event) || 'input';

  /*
    ① genComponentModel ( el, value, modifiers) 方法对元素的 v-model 属性解析生成
      el.model = {
        value: ("(" + value + ")"),
        expression: ("\"" + value + "\""),
        callback: ("function (" + baseValueExpression + ") {" + assignment + "}")
      };
    ② genData$2 (el, state) 方法将其挂载到 data 上
      if (el.model) {
        data += "model:{value:" + (el.model.value) + ",callback:" + (el.model.callback) + ",expression:" + (el.model.expression) + "},";
      }
      也就是：
      data.model : { 
          value : el.model.value, 
          callback : el.model.callback, 
          expression : el.model.expression
      }
   */

  // ① 加入 data.props 对象中
  (data.props || (data.props = {}))[prop] = data.model.value

  // ② 加入 data.on 对象中
  const on = data.on || (data.on = {})
  
  if (isDef(on[event])) {
    // on[event] 应该是个数组，数组合并
    on[event] = [data.model.callback].concat(on[event])
  } else {
    on[event] = data.model.callback
  }
}
