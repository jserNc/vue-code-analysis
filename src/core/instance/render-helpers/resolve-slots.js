/* @flow */

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 */
// vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext)
export function resolveSlots (
  children: ?Array<VNode>,
  context: ?Component
): { [key: string]: Array<VNode> } {
  const slots = {}

  // ① children 不存在，返回空对象
  if (!children) {
    return slots
  }

  const defaultSlot = []
  // ② children 为数组
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    // a. 具名插槽
    if ((child.context === context || child.functionalContext === context) &&
      child.data && child.data.slot != null
    ) {
      // 插槽名，如 <h1 slot="header">这里可能是一个页面标题</h1>
      const name = child.data.slot
      // 每一个插槽名对应一个数组，因为多个插槽可以用同一个 name
      const slot = (slots[name] || (slots[name] = []))
      // template 标签，那就有多个组件
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children)
      } else {
        slot.push(child)
      }
    // b. 默认插槽
    } else {
      defaultSlot.push(child)
    }
  }
  
  /*
    只要不是 defaultSlot 数组中的每个 child 都是空白，那就保留这个默认插槽
    换句话说，如果都是空白，那就忽略，不要默认插槽了
   */ 
  if (!defaultSlot.every(isWhitespace)) {
    slots.default = defaultSlot
  }
  /*
  于是，slots 结构大致为：
  {
    default : [...],
    name1 : [...],
    name2 : [...],
    ...
  }
  注意，每一个插槽名都对应一个数组，存放多个元素。如子组件 app-layout 模板：
   <div class="container">
       <header>
            <slot name="header"></slot>
       </header>
       <main>
            <slot></slot>
       </main>
       <footer>
            <slot name="footer"></slot>
       </footer>
   </div>

  父组件模板：
   <div>
       <app-layout>
           <h1 slot="header">这里是一个页面标题</h1>
           <h1 slot="header">这里是另一个页面标题</h1>

           <p>主要内容的一个段落。</p>
           <p>另一个主要段落。</p>

           <p slot="footer">这里有一些联系信息</p>
           <p slot="footer">这里有另一些联系信息</p>
       </app-layout>
   </div>

   不管是命名插槽还是匿名插槽都可以对应多个节点
   */
  return slots
}

// 是否为空白或注释
function isWhitespace (node: VNode): boolean {
  return node.isComment || node.text === ' '
}

export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object
): { [key: string]: Function } {
  res = res || {}
  for (let i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res)
    // fns[i] 是个对象 {key : keyVal, fn : fnVal}
    } else {
      res[fns[i].key] = fns[i].fn
    }
  }
  /*
    于是，res 的结构大致如下：
    {
      keyVal1 : fnVal1,
      keyVal2 : fnVal2,
      keyVal3 : fnVal3,
      ...
    }
  */
  return res
}
