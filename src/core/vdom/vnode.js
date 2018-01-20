/* @flow */

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
