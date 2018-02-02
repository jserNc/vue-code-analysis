/* @flow */

/*
    /build/config.js 中配置了：
    he: './entity-decoder'

    所以这里的 he 是模块名
 */
import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { cached, no, camelize } from 'shared/util'
import { genAssignmentCode } from '../directives/model'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  pluckModuleFunction
} from '../helpers'

export const onRE = /^@|^v-on:/     // 事件绑定指令
export const dirRE = /^v-|^@|^:/    // 一般指令
export const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/  // in 或 of
/*
   (( group #1 ),( group #2 ),( group #3 ))
   
   group #1 : (\{[^}]*\}|[^,]*)  { 非} 0次或多次 } 或 非, 0次或多次
   group #2 : ([^,]*)            非, 0次或多次
   group #3 : (?:,([^,]*))       , 后跟 0次或多次非 ,
*/
export const forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/

const argRE = /:(.*)$/         // 匹配指令参数
const bindRE = /^:|^v-bind:/   // 匹配 v-bind 指令
const modifierRE = /\.[^.]+/g  // 匹配指令修饰符

/*
    he.decode(html) 的作用是：
    将 html 赋值给一个 div 的 innerHTML，然后返回这个 div 的 textContent 属性
 */
const decodeHTMLCached = cached(he.decode)

// configurable state
export let warn
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

/**
 * Convert HTML string to AST.
 */
// 将模板 template 解析为 ast（抽象语法树）
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  // 警告函数
  warn = options.warn || baseWarn
  // 函数。是否为 pre 标签
  platformIsPreTag = options.isPreTag || no
  // 函数。是否必须用 prop
  platformMustUseProp = options.mustUseProp || no
  // 函数。获取标签的命名空间
  platformGetTagNamespace = options.getTagNamespace || no

  /*
      pluckModuleFunction (modules,key)
      返回一个 module[key] 组成的数组，即 [ module1.key,  module2.key,  module2.key, ...]
   
      所以：
      transforms = [ module1.transformNode,  module2.transformNode,  module2.transformNode, ...];
      preTransforms = [ module1.preTransformNode,  module2.preTransformNode,  module2.preTransformNode, ...];
      postTransforms = [ module1.postTransformNode,  module2.postTransformNode,  module2.postTransformNode, ...];
   */
  transforms = pluckModuleFunction(options.modules, 'transformNode')
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  // 分界符
  delimiters = options.delimiters

  const stack = []

  // 布尔值，是否保留空白
  const preserveWhitespace = options.preserveWhitespace !== false
  let root
  let currentParent

  /*
      v-pre 指令，例如：
      <span v-pre>{{ this will not be compiled }}</span>
      那么会跳过这个元素和它的子元素的编译过程。
   */
  let inVPre = false
  /*
      <pre> 元素可定义预格式化的文本。被包围在 pre 元素中的文本通常会保留空格和换行符。而文本也会呈现为等宽字体。
      <pre> 标签中的特殊符号被转换为符号实体，比如 "&lt;" 代表 "<"，"&gt;" 代表 ">"。
      
      例如：
      <pre>
          &lt;html&gt;

          &lt;head&gt;
            &lt;script type=&quot;text/javascript&quot; src=&quot;loadxmldoc.js&quot;&gt;
          &lt;/script&gt;
          &lt;/head&gt;

          &lt;body&gt;

            &lt;script type=&quot;text/javascript&quot;&gt;
              xmlDoc=<a href="dom_loadxmldoc.asp">loadXMLDoc</a>(&quot;books.xml&quot;);
              document.write(&quot;xmlDoc is loaded, ready for use&quot;);
            &lt;/script&gt;

          &lt;/body&gt;

          &lt;/html&gt;
      </pre>
   */
  let inPre = false
  let warned = false

  // 警告一次
  function warnOnce (msg) {
    if (!warned) {
      warned = true
      warn(msg)
    }
  }

  // 将 inVPre 和 inPre 值置为 false
  function endPre (element) {
    // ① element 有 v-pre 属性
    if (element.pre) {
      inVPre = false
    }
    // ② element.tag 是 pre 标签
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldKeepComment: options.comments,
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      const element: ASTElement = {
        type: 1,
        tag,
        attrsList: attrs,
        attrsMap: makeAttrsMap(attrs),
        parent: currentParent,
        children: []
      }
      if (ns) {
        element.ns = ns
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.'
        )
      }

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        preTransforms[i](element, options)
      }

      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else {
        processFor(element)
        processIf(element)
        processOnce(element)
        processKey(element)

        // determine whether this is a plain element after
        // removing structural attributes
        element.plain = !element.key && !attrs.length

        processRef(element)
        processSlot(element)
        processComponent(element)
        for (let i = 0; i < transforms.length; i++) {
          transforms[i](element, options)
        }
        processAttrs(element)
      }

      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          if (el.tag === 'slot' || el.tag === 'template') {
            warnOnce(
              `Cannot use <${el.tag}> as component root element because it may ` +
              'contain multiple nodes.'
            )
          }
          if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            )
          }
        }
      }

      // tree management
      if (!root) {
        root = element
        checkRootConstraints(root)
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        } else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }
      if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
          processIfConditions(element, currentParent)
        } else if (element.slotScope) { // scoped slot
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }
      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        endPre(element)
      }
      // apply post-transforms
      for (let i = 0; i < postTransforms.length; i++) {
        postTransforms[i](element, options)
      }
    },

    end () {
      // remove trailing whitespace
      const element = stack[stack.length - 1]
      const lastNode = element.children[element.children.length - 1]
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      endPre(element)
    },

    chars (text: string) {
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.'
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      text = inPre || text.trim()
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        : preserveWhitespace && children.length ? ' ' : ''
      if (text) {
        let expression
        if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
          children.push({
            type: 2,
            expression,
            text
          })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    },
    comment (text: string) {
      currentParent.children.push({
        type: 3,
        text,
        isComment: true
      })
    }
  })

  return root
}

// 如果 el 元素的 v-pre 属性存在，那么将 el.pre 标记为 true
function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

/*
    添加 el.attrs 属性
    el.attrs : [
        { 
            name : name1,
            value : value1
        },
        { 
            name : name1,
            value : value1
        },
        ...
    ]
*/
function processRawAttrs (el) {
  const l = el.attrsList.length
  // ① el 元素有属性
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  // ② 标记为纯洁元素
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

// 标记 el.key
function processKey (el) {
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    // 若 <template> 元素有 key 属性，发出警告
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    el.key = exp
  }
}

// 标记 el.ref、el.refInFor、el.iterator1 等属性
function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    // 只要某个祖先元素中存在 v-for 指令，那就返回 true，表示在 v-for 里面
    el.refInFor = checkInFor(el)
  }
}

// 添加 el.for、el.alias、el.iterator1
function processFor (el) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    /*
        forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/
        如 v-for="item in items" 或 v-for="(value, key) in items"
     */
    const inMatch = exp.match(forAliasRE)

    // 匹配失败，那就不是有效的 v-for，发出警告并返回
    if (!inMatch) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid v-for expression: ${exp}`
      )
      return
    }

    // 数据源，如 'items'
    el.for = inMatch[2].trim()
    // 数据项，如 'item' 或 '(value, key)'
    const alias = inMatch[1].trim()
    /*
        forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/

        (( group #1 ),( group #2 ),( group #3 ))
   
        group #1 : (\{[^}]*\}|[^,]*)  { 非} 0次或多次 } 或 非, 0次或多次
        group #2 : ([^,]*)            非, 0次或多次
        group #3 : (?:,([^,]*))       , 后跟 0次或多次非 ,

        ① 对于 v-for="(value, key) in object" 这种形式，alias = '(value, key)'
        于是：'(value, key)'.match(forIteratorRE) -> ["(value, key)", "value", " key", undefined, index: 0, input: "(value, key)"]
        
        el.alias = "value"
        el.iterator1 = "key"
     */
    const iteratorMatch = alias.match(forIteratorRE)
    if (iteratorMatch) {
      // 数据值，如 'value'
      el.alias = iteratorMatch[1].trim()
      // 数据键/索引，如 'key'
      el.iterator1 = iteratorMatch[2].trim()
      if (iteratorMatch[3]) {
        el.iterator2 = iteratorMatch[3].trim()
      }
    /*
        ② 对于 v-for="item in items" 这种形式
        el.alias = 'item'
     */
    } else {
      el.alias = alias
    }
  }
}

/*
    例如：
    <h1 v-if="a">AAAAA</h1>
    <h1 v-else-if="b">BBBBB<h1>
    <h1 v-else>CCCCC</h1>
 */
function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    /*
        ① el 为第一个 <h1> 元素 <h1 v-if="a">AAAAA</h1>
        el.ifConditions = [
            {
              exp: 'a',
              block: el
            }
        ]
     */
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    // ② 例如 el 为：<h1 v-else>CCCCC</h1>
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    // ③ 例如 el 为：<h1 v-else-if="b">BBBBB<h1>
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

/*
    看看这个函数实际怎么调用：
    if (element.elseif || element.else) {
      processIfConditions(element, currentParent);
    }
 */
function processIfConditions (el, parent) {
  /*
      ① 在数组 children 中从后向前找到第一个 ASTElement 节点
      ② 在查找过程中遇到的 ASTText、ASTExpression 类型节点都丢掉
   */
  const prev = findPrevElement(parent.children)
  /*
      例如：
      <h1 v-if="a">AAAAA</h1>
      hhhhhhhh
      <h1 v-else-if="b">BBBBB<h1>
      <h1 v-else>CCCCC<h1>

      ① 若条件 v-else-if="b" 为真
      prev 就是第一个 <h1> 元素
      el 就是第二个 <h1> 元素

      于是把 el 这个条件块合并到 prev 中：
      prev.ifConditions = [
          {
            exp: 'a',
            block: prev
          },
          {
            exp: 'b',
            block: el
          }
      ]

      ② 若条件 v-else-if="b" 为假，那就走到第三个 <h1> 元素
      prev 就是第一个 <h1> 元素
      el 就是第三个 <h1> 元素

      于是把 el 这个条件块合并到 prev 中：
      prev.ifConditions = [
          {
            exp: 'a',
            block: prev
          },
          {
            exp: undefined,  // 注意这里应该是 undefined
            block: el
          }
      ]

      总之 v-else-if  和 v-else 只有一个能成立
   */
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  // 否则，发出警告，v-else(-if) 找不到对应的 v-if
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}

/*
    ① 在数组 children 中从后向前找到第一个 ASTElement 节点
    ② 在查找过程中遇到的 ASTText、ASTExpression 类型节点都丢掉
 */ 
function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  /*
    生成节点有 3 种类型：
    ASTNode = ASTElement | ASTText | ASTExpression，其中：
    
    ASTElement 的 type 类型为 1
    ASTText 的 type 类型为 3
    ASTExpression 的 type 类型为 2

    从 children 后面向前遍历，找到第一个 ASTElement 节点。
 */ 
  while (i--) {
    // ① 找到一个 ASTElement 节点就返回
    if (children[i].type === 1) {
      return children[i]
    // ② 遇到 ASTText、ASTExpression 类型就出栈
    } else {
      // ASTText、ASTExpression 类型都有 text 属性
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`
        )
      }
      // 出栈
      children.pop()
    }
  }
}

// 添加 if 条件块
function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

// 标记 el.once
function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

// 添加 el.slotName、el.slotTarget、el.slotScope
function processSlot (el) {
  /*
      例如 app-layout 组件，它的模板为：
      <div class="container">
        <header>
          <slot name="header"></slot>
        </header>
      </div>
   */
  // ① 子组件模板中的 <slot> 元素
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    // 警告：slot 元素不需要 key 属性
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`
      )
    }
  /*
      例如父组件模板为：
      <app-layout>
        <h1 slot="header">这里可能是一个页面标题</h1>
      </app-layout>
   */
  // ② 父组件模板中的 slot 属性
  } else {
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
    }
    /*
        参考官网作用域插槽描述：
        在父级中，具有特殊特性 slot-scope 的 <template> 元素必须存在，表示它是作用域插槽的模板。slot-scope 的值将被用作一个临时变量名，此变量接收从子组件传递过来的 prop 对象
       
        经验证：
        2.4.0 版本（当前版本）应该是 scope 属性而不是 slot-scope 属性
        2.5.0+ 版本才改成 slot-scope 属性

        例如：
        <child>
          <template scope="props">
            <span>hello from parent</span>
            <span>{{ props.text }}</span>
          </template>
        </child>
     */
    if (el.tag === 'template') {
      el.slotScope = getAndRemoveAttr(el, 'scope')
    }
  }
}

// 添加 el.component、el.inlineTemplate
function processComponent (el) {
  let binding
  /*
      通过使用保留的 <component> 元素，并对其 is 特性进行动态绑定，你可以在同一个挂载点动态切换多个组件：
      var vm = new Vue({
        el: '#example',
        data: {
          currentView: 'home'
        },
        components: {
          home: { ... },
          posts: { ... },
          archive: { ... }
        }
      })

      <component v-bind:is="currentView">
        <!-- 组件在 vm.currentview 变化时改变！-->
      </component>
   */
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  /*
      内联模板：
      如果子组件有 inline-template 特性，组件将把它的内容当作它的模板，而不是把它当作分发内容
      <my-component inline-template>
        <div>
          <p>这些将作为组件自身的模板。</p>
          <p>而非父组件透传进来的内容。</p>
        </div>
      </my-component>
   */
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

function processAttrs (el) {
  /*
    el.attrsList 是一个数组，结构大概是：
    [
      { name : name1, value : value1 },
      { name : name2, value : value2 }
      ...
    ]
   */
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp

  // 遍历 el.attrsList 数组
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value

    // 1. name 为指令，其中 dirRE = /^v-|^@|^:/
    if (dirRE.test(name)) {
      // mark element as dynamic
      // 标记该 el 元素拥有动态属性
      el.hasBindings = true

      /*
          例如：parseModifiers('v-on:click.capture')
          -> {
              click : true,
              capture : true
          }
       */ 
      modifiers = parseModifiers(name)
      if (modifiers) {
        // 将修饰符从 name 中去掉，其中 modifierRE = /\.[^.]+/g
        name = name.replace(modifierRE, '')
      }

      // ① 匹配 v-bind，其中 bindRE = /^:|^v-bind:/
      if (bindRE.test(name)) { 
        // 例如 'v-bind:src'.replace(bindRE, '') -> 'src'
        name = name.replace(bindRE, '')

        // 例如 parseFilters("message | filterA") -> '_f("filterA")(message)'
        value = parseFilters(value)
        isProp = false

        /*
            关于 v-bind 的修饰符：
            .prop  被用于绑定 DOM 属性 (property)
            .camel 将 kebab-case 特性名转换为 camelCase (2.1.0+ 支持)
            .sync  语法糖，会扩展成一个更新父组件绑定值的 v-on 侦听器 (2.3.0+ 支持) 
         */
        if (modifiers) {
          // 例如 v-bind:innerHtml.prop 绑定 DOM 属性 innerHTML 
          if (modifiers.prop) {
            isProp = true
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          // 属性名驼峰化
          if (modifiers.camel) {
            name = camelize(name)
          }
          /*
              <comp :foo.sync="bar"></comp>
              会被扩展为：
              <comp :foo="bar" @update:foo="val => bar = val"></comp>
              当子组件需要更新 foo 的值时，它需要显式地触发一个更新事件：
              this.$emit('update:foo', newValue)
              
              addHandler 函数的大致作用为：
              addHandler (el,name,value,modifiers,important,warn) 
              -> el.events[name] = el.events[name].push({ value: value, modifiers: modifiers })

              genAssignmentCode(value, "$event") 返回一个字符串形式的执行语句，其实就是一个 set 操作
           */
          if (modifiers.sync) {
            addHandler(
              el,
              `update:${camelize(name)}`,
              genAssignmentCode(value, `$event`)
            )
          }
        }

        if (isProp || (
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          // (el.props || (el.props = [])).push({ name: name, value: value });
          addProp(el, name, value)
        } else {
          // (el.attrs || (el.attrs = [])).push({ name: name, value: value });
          addAttr(el, name, value)
        }
      // ② 匹配 v-on，其中 onRE = /^@|^v-on:/
      } else if (onRE.test(name)) {
        name = name.replace(onRE, '')
        addHandler(el, name, value, modifiers, false, warn)
      // ③ 一般指令，如 v-if、v-for
      } else {
        // 其中 dirRE = /^v-|^@|^:/
        name = name.replace(dirRE, '')
        
        /*
          argRE = /:(.*)$/ 匹配参数 

          一些指令能够接收一个“参数”，在指令名称之后以冒号表示。
          例如，v-bind 指令可以用于响应式地更新 HTML 属性：

          <a v-bind:href="url">...</a>
          在这里 href 是参数，告知 v-bind 指令将该元素的 href 属性与表达式 url 的值绑定。
         
          'v-bind:href'.slice(0, -(4 + 1))
          -> "v-bind"
         */ 
        const argMatch = name.match(argRE)
        const arg = argMatch && argMatch[1]
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        // (el.directives || (el.directives = [])).push({name: name, rawName: rawName, value: value, arg: arg, modifiers: modifiers });
        addDirective(el, name, rawName, value, arg, modifiers)
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    // 2. name 为普通属性
    } else {
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const expression = parseText(value, delimiters)
        if (expression) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      addAttr(el, name, JSON.stringify(value))
    }
  }
}

// 只要某个祖先元素中存在 v-for 指令，那就返回 true，表示在 v-for 里面
function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}

function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    _el = _el.parent
  }
}
