/* @flow */

/*
  vnode.data 属性是 VNodeData 类型
  那么首先看一下 VNodeData，即 VNode 数据对象

  在 VNode 数据对象中，下列属性名是级别最高的字段。该对象也允许你绑定普通的 HTML 特性，就像 DOM 属性一样，比如 innerHTML (这会取代 v-html 指令)。

  {
    // 和`v-bind:class`一样的 API
    'class': {
      foo: true,
      bar: false
    },
    // 和`v-bind:style`一样的 API
    style: {
      color: 'red',
      fontSize: '14px'
    },
    // 正常的 HTML 特性
    attrs: {
      id: 'foo'
    },
    // 组件 props
    props: {
      myProp: 'bar'
    },
    // DOM 属性
    domProps: {
      innerHTML: 'baz'
    },
    // 事件监听器基于 `on`
    // 所以不再支持如 `v-on:keyup.enter` 修饰器
    // 需要手动匹配 keyCode。
    on: {
      click: this.clickHandler
    },
    // 仅对于组件，用于监听原生事件，而不是组件内部使用
    // `vm.$emit` 触发的事件。
    nativeOn: {
      click: this.nativeClickHandler
    },
    // 自定义指令。注意，你无法对 `binding` 中的 `oldValue`
    // 赋值，因为 Vue 已经自动为你进行了同步。
    directives: [
      {
        name: 'my-custom-directive',
        value: '2',
        expression: '1 + 1',
        arg: 'foo',
        modifiers: {
          bar: true
        }
      }
    ],
    // Scoped slots in the form of
    // { name: props => VNode | Array<VNode> }
    scopedSlots: {
      default: props => createElement('span', props.text)
    },
    // 如果组件是其他组件的子组件，需为插槽指定名称
    slot: 'name-of-slot',
    // 其他特殊顶层属性
    key: 'myKey',
    ref: 'myRef'
  }
  
  【重要】这个 ”VNode 数据对象“ 就是 createElement() 函数第二个实参

  // 返回 VNode 类型值
  createElement(
    // {String | Object | Function}
    // 一个 HTML 标签字符串，组件选项对象，或者一个返回值
    // 类型为 String/Object 的函数，必要参数
    'div',

    // {Object}
    // 一个包含模板相关属性的数据对象
    // 这样，您可以在 template 中使用这些属性。可选参数。
    {
      // 这个对象就是上面说的 ”VNode 数据对象“
    },

    // {String | Array}
    // 子节点 (VNodes)，由 `createElement()` 构建而成，
    // 或使用字符串来生成“文本节点”。可选参数。
    [
      '先写一些文字',
      createElement('h1', '一则头条'),
      createElement(MyComponent, {
        props: {
          someProp: 'foobar'
        }
      })
    ]
  )
 */



export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  /*
      ① vnode.context 为当前 vnode 所在的父组件实例
      也就是说，vnode 在组件 vnode.context 中渲染，例如：

      <div id="parent">
        <user-profile ref="profile"></user-profile>
      </div>

      var parent = new Vue({ el: '#parent' })
      var child = parent.$refs.profile

      假设 vnode 对应节点 <user-profile ref="profile"></user-profile>
      那么，vnode.context 就是 parent

      ② vnode.componentInstance 为该节点对应的组件实例
      那么，vnode.componentInstance 就是 child
   */
  context: Component | void; // rendered in this component's scope
  functionalContext: Component | void; // only for functional component root nodes
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag;
    this.data = data;
    this.children = children;
    this.text = text;
    this.elm = elm;
    this.ns = undefined;
    // 所在的组件实例，也就是说当前 vnode 在组件 vnode.context 中渲染
    this.context = context;
    this.functionalContext = undefined;
    this.key = data && data.key;
    this.componentOptions = componentOptions;
    // 当前 vnode 节点对应的组件实例
    this.componentInstance = undefined;
    this.parent = undefined;
    this.raw = false;
    this.isStatic = false;
    this.isRootInsert = true;
    // 是否为空的注释占位符
    this.isComment = false;
    // 是否为克隆节点
    this.isCloned = false;
    // 是否为 v-once 节点
    this.isOnce = false;
    // 异步组件工厂方法
    this.asyncFactory = asyncFactory;
    // 异步组件相关元数据，例如 node.asyncMeta = { data: data, context: context, children: children, tag: tag }
    this.asyncMeta = undefined;
    this.isAsyncPlaceholder = false;
  }

  /*
    定义 child 属性的获取函数。即在 VNode.prototype 原型上定义 child 属性的获取 getter
    
    ① 转成 es5 的写法：
    var prototypeAccessors = { child: {} };
    prototypeAccessors.child.get = function () {
      return this.componentInstance
    };
    Object.defineProperties( VNode.prototype, prototypeAccessors );
    
    对于实例 vnode，获取 vnode.child 返回 vnode.componentInstance

    ② 说一说 Object.defineProperties()
    Object.defineProperties() 方法直接在一个对象上定义新的属性或修改现有属性，并返回该对象。

    例如：
    var obj = {};
    Object.defineProperties(obj, {
      'property1': {
        value: true,
        writable: true
      },
      'property2': {
        value: 'Hello',
        writable: false
      }
      // etc. etc.
    });

    所以这里又相当于：
    Object.defineProperties( VNode.prototype, {
      child: {
        get:function () {
          return this.componentInstance
        };
      }
    });
   */
  get child (): Component | void {
    return this.componentInstance
  }
}

// 创建空的 vnode
export const createEmptyVNode = (text: string = '') => {
  // 参数为空，node 的所有属性都是 undefined
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

// 创建文本节点
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
/*
 【有一个约束】：组件树中的所有 VNodes 必须是唯一的

  试想：如果是浅拷贝方式来克隆一个节点，那么多个节点之间共用一个 vnode 实例
  例如：<div id="parent">
      <user-profile ref="profile1"></user-profile>
      <user-profile ref="profile2"></user-profile>
  </div>
  假如这里的 2 个 <user-profile> 共用一个 vnode

  那么 vnode.componentInstance 到底是 profile1 还是 profile2 呢？
  
  所以，为了避免这种问题，克隆的节点的时候新建一个完全独立的 vnode 实例，只是沿用属性
 */
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  // 标记当前 vnode 是克隆的
  cloned.isCloned = true
  return cloned
}

// 克隆一组 vnode
export function cloneVNodes (vnodes: Array<VNode>): Array<VNode> {
  const len = vnodes.length
  const res = new Array(len)
  for (let i = 0; i < len; i++) {
    res[i] = cloneVNode(vnodes[i])
  }
  return res
}
