/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

import { looseEqual, looseIndexOf, makeMap } from 'shared/util'
import { warn, isAndroid, isIE9, isIE, isEdge } from 'core/util/index'

// <input> 的 type 类型为下列值之一
const isTextInputType = makeMap('text,number,password,search,email,tel,url')

// ie9 下，如果文档发生了 selectionchange 事件，那就触发”当前获得焦点并且有 v-model 属性的元素“的 input 事件
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  document.addEventListener('selectionchange', () => {
    // activeElement 属性返回文档中当前获得焦点的元素
    const el = document.activeElement
    if (el && el.vmodel) {
      // 触发 input 事件（事件源为 el）
      trigger(el, 'input')
    }
  })
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
  // 被绑定元素插入父节点时调用
  inserted (el, binding, vnode) {
    // 1. <select> 下拉列表
    if (vnode.tag === 'select') {
      const cb = () => {
        // 设置下拉列表选项
        setSelected(el, binding, vnode.context)
      }
      cb()

      if (isIE || isEdge) {
        setTimeout(cb, 0)
      }
      /*
          el.options 集合返回包含 <select> 元素中所有 <option> 的一个数组
          el._vOptions 为数组。数组元素时下拉列表每个 option 的状态值

          之所以不写成 el._vOptions = el.options.map(getValue)
          是因为 el.options 不是真数组，只是类数组
       */ 
      el._vOptions = [].map.call(el.options, getValue)
    // 2. <textarea> 标签或者 <input> 标签（type 为 text,number,password,search,email,tel,url 之一）
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      /*
          modifiers：一个包含修饰符的对象。
          例如：v-my-directive.foo.bar 中，修饰符对象为 { foo: true, bar: true }。
       
          v-model 修饰符：
          .lazy - 取代 input，监听 change 事件
          .number - 输入字符串转为数字
          .trim - 输入首尾空格过滤
       */
      el._vModifiers = binding.modifiers
      
      // 监听 input 事件
      if (!binding.modifiers.lazy) {
        // Safari < 10.2 & UIWebView doesn't fire compositionend when
        // switching focus before confirming composition choice
        // this also fixes the issue where some browsers e.g. iOS Chrome
        // fires "change" instead of "input" on autocomplete.
        
        // onCompositionEnd 函数会触发 input 事件
        el.addEventListener('change', onCompositionEnd)
        
        if (!isAndroid) {
          // compositionstart 事件触发于一段文字的输入之前
          el.addEventListener('compositionstart', onCompositionStart)
          // 当文本段落的组成完成或取消时, compositionend 事件将被激发。onCompositionEnd 函数会触发 input 事件
          el.addEventListener('compositionend', onCompositionEnd)
        }

        if (isIE9) {
          el.vmodel = true
        }
      }
    }
  },
  // 所在组件的 VNode 及其孩子的 VNode 全部更新时调用
  componentUpdated (el, binding, vnode) {
    // <select> 下拉列表
    if (vnode.tag === 'select') {
      // 重新设置下拉类别选项
      setSelected(el, binding, vnode.context)
      // in case the options rendered by v-for have changed,
      // it's possible that the value is out-of-sync with the rendered options.
      // detect such cases and filter out values that no longer has a matching
      // option in the DOM.
      // ① 之前的下拉选项数组
      const prevOptions = el._vOptions
      // ② 当前的下拉选项数组
      const curOptions = el._vOptions = [].map.call(el.options, getValue)
      
      // 只有之前的数组和现在的数组有一项不同就触发 change 事件
      if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {
        trigger(el, 'change')
      }
    }
  }
}

// 设置下拉列表选项
function setSelected (el, binding, vm) {
  const value = binding.value
  // 多选下拉
  const isMultiple = el.multiple

  /*
      警告：
      `<select multiple v-model="${binding.expression}"> `
      多选下拉绑定的值应该是个数组，而 binding.value 并不是数组
   */
  if (isMultiple && !Array.isArray(value)) {
    process.env.NODE_ENV !== 'production' && warn(
      `<select multiple v-model="${binding.expression}"> ` +
      `expects an Array value for its binding, but got ${
        Object.prototype.toString.call(value).slice(8, -1)
      }`,
      vm
    )
    // 就此返回
    return
  }


  let selected, option

  /*
      el.options 集合可返回包含 <select> 元素中所有 <option> 的一个数组
      下面遍历这个 el.options 集合
   */
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    // ① 多选下拉（value 为数组）
    if (isMultiple) {
      // true or false
      selected = looseIndexOf(value, getValue(option)) > -1
      
      // 直接写 option.selected = selected 不就完了
      if (option.selected !== selected) {
        option.selected = selected
      }
    // ② 单选下拉（value 是单个值）
    } else {
      if (looseEqual(getValue(option), value)) {
        // el.selectedIndex 设置或者返回 select 对象已选选项的索引值
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }

  // 单选列表，一个都没匹配到，那就将 selectedIndex 强制写为 -1
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}

// 返回 option._value || option.value
function getValue (option) {
  return '_value' in option
    ? option._value
    : option.value
}

// compositionstart 事件触发于一段文字的输入之前
function onCompositionStart (e) {
  e.target.composing = true
}

// 当文本段落的组成完成或取消时, compositionend 事件将被激发。
function onCompositionEnd (e) {
  // prevent triggering an input event for no reason
  // 不会无缘无故执行该方法来触发 input 事件，触发是真的有输入使得 e.target.composing 为 true
  if (!e.target.composing) return

  // ① 将 e.target.composing 置为 false
  e.target.composing = false
  // ② 触发 input 事件
  trigger(e.target, 'input')
}

// 以 el 作为事件源，触发 type 事件
function trigger (el, type) {
  // ① 新建 HTMLEvents 实例
  const e = document.createEvent('HTMLEvents')
  /*
      initEvent(type,bubbles,cancelable,option) 方法可以接受四个参数:
      type：事件名称，格式为字符串。
      bubbles：事件是否应该冒泡，格式为布尔值。可以使用 event.bubbles 属性读取它的值。
      cancelable：事件是否能被取消，格式为布尔值。可以使用 event.cancelable 属性读取它的值。
      option：为事件对象指定额外的属性。
   */
  // ② 初始化事件
  e.initEvent(type, true, true)
  // ③ 触发事件
  el.dispatchEvent(e)
}
