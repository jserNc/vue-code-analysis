/* @flow */

import { extend, warn } from 'core/util/index'

/*
   关于作用域插槽，理解官网这个例子：
   ① 父组件模板
   <my-awesome-list :items="items">
       <li slot="item" slot-scope="props" class="my-fancy-item">{{ props.text }}</li>
   </my-awesome-list>

   ② 子组件 my-awesome-list 模板
   <ul>
       <slot name="item" v-for="item in items" :text="item.text">备选内容</slot>
   </ul>

   假如父作用域中 items 为:
   [
       { text: 'Foo' },
       { text: 'Bar' },
       { }
   ]
  
   有几点注意下：
   a. 父组件中的 <li slot="item" slot-scope="props" class="my-fancy-item">{{ props.text }}</li> 是子组件中 slot 标签的模板
   b. 当给 li 标签传不同的 props 对象时，它会渲染不同的结果
   c. props 是个对象，包括子组件传入的 text 等属性
   d. 子组件中 for 循环生成很多的 slot，每个 slot 的 text 属性不同
   e. text 属性由 props 对象带给父组件中的 li

   渲染结果为：
   <ul>
        <li class="my-fancy-item">Foo</li>
        <li class="my-fancy-item">Bar</li>
        <li class="my-fancy-item">备选内容</li>
   </ul>
*/
/**
 * Runtime helper for rendering <slot>
 */
/*
    Vue.prototype._t = renderSlot;
    
    ① 第二个参数 fallback （对应这里的 children）的意义为：
    若父组件有给插槽传入内容那就以父组件的内容为准，否则就取插槽的默认内容（也就是 fallback 这个数组）
    ② 作用域插槽，参数 props, bindObject 才起作用，静态插槽不需要这俩参数
 */ 
export function renderSlot (
  name: string,
  fallback: ?Array<VNode>,
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  // 名为 name 的作用域插槽
  const scopedSlotFn = this.$scopedSlots[name]
  // ① 有作用域插槽
  if (scopedSlotFn) { // scoped slot
    props = props || {}
    if (bindObject) {
      props = extend(extend({}, bindObject), props)
    }
    return scopedSlotFn(props) || fallback
  // ② 没有作用域插槽，只有静态插槽
  } else {
    // 名为 name 的插槽
    const slotNodes = this.$slots[name]
    // warn duplicate slot usage
    if (slotNodes && process.env.NODE_ENV !== 'production') {
      // 若当前插槽渲染过，发出警告（某个插槽重复的出现在一棵渲染树中，可能会导致渲染错误）
      slotNodes._rendered && warn(
        `Duplicate presence of slot "${name}" found in the same render tree ` +
        `- this will likely cause render errors.`,
        this
      )
      // 标志当前插槽被渲染过
      slotNodes._rendered = true
    }
    return slotNodes || fallback
  }
}
