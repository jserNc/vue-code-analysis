/* @flow */

import config from 'core/config'
import { addHandler, addProp, getBindingAttr } from 'compiler/helpers'
import { genComponentModel, genAssignmentCode } from 'compiler/directives/model'

let warn

// in some cases, the event used has to be determined at runtime
// so we used some reserved tokens during compile.
// 在某些情况下，事件名必须在运行时才能确定，所以在编译期间我们使用一些保留 token
export const RANGE_TOKEN = '__r'
export const CHECKBOX_RADIO_TOKEN = '__c'

/*
    一个指令对象可包括以下几个钩子函数，例如：

    bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
    inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
    update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
    componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
    unbind：只调用一次，指令与元素解绑时调用。
  
    这里的 model 函数之后会被用做钩子函数

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
export default function model (
  el: ASTElement,
  dir: ASTDirective,
  _warn: Function
): ?boolean {
  warn = _warn
  const value = dir.value
  const modifiers = dir.modifiers
  const tag = el.tag
  const type = el.attrsMap.type

  if (process.env.NODE_ENV !== 'production') {
    const dynamicType = el.attrsMap['v-bind:type'] || el.attrsMap[':type']
    // 警告1：v-model 不支持动态的 input 类型，如果非要用，建议用 v-if 分支来代替
    if (tag === 'input' && dynamicType) {
      warn(
        `<input :type="${dynamicType}" v-model="${value}">:\n` +
        `v-model does not support dynamic input types. Use v-if branches instead.`
      )
    }
    // inputs with type="file" are read only and setting the input's
    // value will throw an error.
    // 警告2：file 类型的 input 是只读的
    if (tag === 'input' && type === 'file') {
      warn(
        `<${el.tag} v-model="${value}" type="file">:\n` +
        `File inputs are read only. Use a v-on:change listener instead.`
      )
    }
  }

  if (el.component) {
    /*
        生成 el.model 这个 json 对象：
        el.model = {
          value: ("(" + value + ")"),
          expression: ("\"" + value + "\""),
          callback: ("function (" + baseValueExpression + ") {" + assignment + "}")
        };
     */
    genComponentModel(el, value, modifiers)
    // component v-model doesn't need extra runtime
    return false
  // 下拉列表
  } else if (tag === 'select') {
    genSelect(el, value, modifiers)
  // 多选框
  } else if (tag === 'input' && type === 'checkbox') {
    genCheckboxModel(el, value, modifiers)
  // 单选框
  } else if (tag === 'input' && type === 'radio') {
    genRadioModel(el, value, modifiers)
  // 一般的 input/textarea
  } else if (tag === 'input' || tag === 'textarea') {
    genDefaultModel(el, value, modifiers)
  // 组件
  } else if (!config.isReservedTag(tag)) {
    genComponentModel(el, value, modifiers)
    // component v-model doesn't need extra runtime
    return false
  } else if (process.env.NODE_ENV !== 'production') {
    // 警告：该元素不支持 v-model
    warn(
      `<${el.tag} v-model="${value}">: ` +
      `v-model is not supported on this element type. ` +
      'If you are working with contenteditable, it\'s recommended to ' +
      'wrap a library dedicated for that purpose inside a custom component.'
    )
  }

  // ensure runtime directive metadata
  return true
}

// 为 tag === 'input' && type === 'checkbox' 的元素生成 model
function genCheckboxModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
) {
  const number = modifiers && modifiers.number
  const valueBinding = getBindingAttr(el, 'value') || 'null'
  const trueValueBinding = getBindingAttr(el, 'true-value') || 'true'
  const falseValueBinding = getBindingAttr(el, 'false-value') || 'false'
  
  /*
    简化一下 addProp 的第三个参数，value 值如下：
    ① trueValueBinding === 'true'
       Array.isArray( value ) ? _i(value , valueBinding) > -1 : value
    ② trueValueBinding !== 'true' 
       Array.isArray( value ) ? _i(value , valueBinding) > -1 : _q(value , trueValueBinding)
    
    其中：
    Vue.prototype._i = looseIndexOf
    Vue.prototype._q = looseEqual

  */
  addProp(el, 'checked',
    `Array.isArray(${value})` +
      `?_i(${value},${valueBinding})>-1` + (
        trueValueBinding === 'true'
          ? `:(${value})`
          : `:_q(${value},${trueValueBinding})`
      )
  )
  /*
    CHECKBOX_RADIO_TOKEN = '__c'
    
    addHandler 函数的大致作用为：
    addHandler (el,name,value,modifiers,important,warn) 
    -> el.events[name] = el.events[name].push({ value: value, modifiers: modifiers })

    这的 value 为:
    var $$a = value,
        $$el = $event.target,
        $$c = $$el.checked ? trueValueBinding : falseValueBinding;

    if(Array.isArray($$a)){
        var $$v = number ? _n(valueBinding): valueBinding,
            $$i = _i($$a,$$v);
        
        // ① $$v 不存在于数组 $$a 中，那就把它加入数组
        if($$c){
            $$i < 0 && (value = $$a.concat($$v))
        // ② $$v 存在于数组 $$a 中，那就把它从数组中移除，例如 [1, 2, 3, 4, 5, 6].slice(0,3).concat([1, 2, 3, 4, 5, 6].slice(3+1)) -> [1, 2, 3, 5, 6]
        } else {
            $$i > -1 && (value = $$a.slice(0,$$i).concat($$a.slice($$i+1)))
        }
    } else {
        genAssignmentCode(value, '$$c');
    }
  */
  addHandler(el, CHECKBOX_RADIO_TOKEN,
    `var $$a=${value},` +
        '$$el=$event.target,' +
        `$$c=$$el.checked?(${trueValueBinding}):(${falseValueBinding});` +
    'if(Array.isArray($$a)){' +
      `var $$v=${number ? '_n(' + valueBinding + ')' : valueBinding},` +
          '$$i=_i($$a,$$v);' +
      `if($$c){$$i<0&&(${value}=$$a.concat($$v))}` +
      `else{$$i>-1&&(${value}=$$a.slice(0,$$i).concat($$a.slice($$i+1)))}` +
    `}else{${genAssignmentCode(value, '$$c')}}`,
    null, true
  )
}

// 为 tag === 'input' && type === 'radio' 的元素生成 model
function genRadioModel (
    el: ASTElement,
    value: string,
    modifiers: ?ASTModifiers
) {
  const number = modifiers && modifiers.number

  // :value 或 v-bind:value 的值
  let valueBinding = getBindingAttr(el, 'value') || 'null'
  // 如果有 number 修饰符，就转为数值
  valueBinding = number ? `_n(${valueBinding})` : valueBinding

  // 添加 checked 属性
  addProp(el, 'checked', `_q(${value},${valueBinding})`)
  // CHECKBOX_RADIO_TOKEN = '__c'
  addHandler(el, CHECKBOX_RADIO_TOKEN, genAssignmentCode(value, valueBinding), null, true)
}

// 为 tag === 'select' 的元素生成 model
function genSelect (
    el: ASTElement,
    value: string,
    modifiers: ?ASTModifiers
) {
  const number = modifiers && modifiers.number

  /*
    var selectedVal = Array.prototype.filter
                      .call($event.target.options , function(o){return o.selected})
                      .map(function(o){
                         var val = "_value" in o ? o._value : o.value;
                         return (number ? _n(val) : val) 
                      });
    可以看到，selectedVal 是一个数组
  */
  const selectedVal = `Array.prototype.filter` +
    `.call($event.target.options,function(o){return o.selected})` +
    `.map(function(o){var val = "_value" in o ? o._value : o.value;` +
    `return ${number ? '_n(val)' : 'val'}})`

  const assignment = '$event.target.multiple ? $$selectedVal : $$selectedVal[0]'
  let code = `var $$selectedVal = ${selectedVal};`
  /*
      code 相当于：
      `var $$selectedVal = [...];${value}=$event.target.multiple ? $$selectedVal : $$selectedVal[0]`
   */
  code = `${code} ${genAssignmentCode(value, assignment)}`
  addHandler(el, 'change', code, null, true)
}

// 为 tag === 'input' || tag === 'textarea' 的元素生成 model
function genDefaultModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
): ?boolean {
  const type = el.attrsMap.type
  /*
      .lazy   取代 input，改为监听 change 事件
      .number 输入字符串转为数字
      .trim   去除首尾空格
   */
  const { lazy, number, trim } = modifiers || {}

  /*
        ① compositionstart 事件触发于一段文字的输入之前
        el.addEventListener('compositionstart', onCompositionStart);
        
        function onCompositionStart (e) {
          e.target.composing = true;
        }

        ② 当文本段落的组成完成或取消时, compositionend 事件将被激发。onCompositionEnd 函数会触发 input 事件
        el.addEventListener('compositionend', onCompositionEnd);
        
        function onCompositionEnd (e) {
          if (!e.target.composing) { return }
          e.target.composing = false;
          trigger(e.target, 'input');
        }
   */
  const needCompositionGuard = !lazy && type !== 'range'

  /*
    ① 有 lazy 修饰符，监听 change 事件
    ② 没有 lazy 修饰符
       a. type === 'range'，监听 __r 事件
       a. type !== 'range'，监听 input 事件 
  */
  const event = lazy
    ? 'change'
    : type === 'range'
      ? RANGE_TOKEN    // RANGE_TOKEN = '__r'
      : 'input'

  // 修正 valueExpression
  let valueExpression = '$event.target.value'
  if (trim) {
    valueExpression = `$event.target.value.trim()`
  }
  if (number) {
    valueExpression = `_n(${valueExpression})`
  }

  // code = `value = ${valueExpression}`
  let code = genAssignmentCode(value, valueExpression)

  // $event.target.composing 必须为 false 才会继续往下走
  if (needCompositionGuard) {
    code = `if($event.target.composing)return;${code}`
  }

  // 给 el 添加 value 属性
  addProp(el, 'value', `(${value})`)
  // 监听 el 的 event 事件
  addHandler(el, event, code, null, true)

  // 失去焦点时要更新视图（去除空格、字符串转为数值等视图变化）
  if (trim || number) {
    addHandler(el, 'blur', '$forceUpdate()')
  }
}
