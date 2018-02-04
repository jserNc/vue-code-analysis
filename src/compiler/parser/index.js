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
    /*
        生成 ASTElement 节点，其中：
        declare type ASTElement = {
          type: 1;
          tag: string;
          attrsList: Array<{ name: string; value: string }>;
          attrsMap: { [key: string]: string | null };
          parent: ASTElement | void;
          children: Array<ASTNode>;

          static?: boolean;
          staticRoot?: boolean;
          staticInFor?: boolean;
          staticProcessed?: boolean;
          hasBindings?: boolean;

          text?: string;
          attrs?: Array<{ name: string; value: string }>;
          props?: Array<{ name: string; value: string }>;
          plain?: boolean;
          pre?: true;
          ns?: string;

          component?: string;
          inlineTemplate?: true;
          transitionMode?: string | null;
          slotName?: ?string;
          slotTarget?: ?string;
          slotScope?: ?string;
          scopedSlots?: { [name: string]: ASTElement };

          ref?: string;
          refInFor?: boolean;

          if?: string;
          ifProcessed?: boolean;
          elseif?: string;
          else?: true;
          ifConditions?: ASTIfConditions;

          for?: string;
          forProcessed?: boolean;
          key?: string;
          alias?: string;
          iterator1?: string;
          iterator2?: string;

          staticClass?: string;
          classBinding?: string;
          staticStyle?: string;
          styleBinding?: string;
          events?: ASTElementHandlers;
          nativeEvents?: ASTElementHandlers;

          transition?: string | true;
          transitionOnAppear?: boolean;

          model?: {
            value: string;
            callback: string;
            expression: string;
          };

          directives?: Array<ASTDirective>;

          forbidden?: true;
          once?: true;
          onceProcessed?: boolean;
          wrapData?: (code: string) => string;
          wrapListeners?: (code: string) => string;

          // 2.4 ssr optimization
          ssrOptimizability?: number;

          // weex specific
          appendAsTree?: boolean;
        };
     */
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      // 获取命名空间
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /*
          guardIESVGBug(attrs) 相当于对原数组某些项做一下修正，并返回这些修正过的项
          这里的意思是：在 ie 下，对 attrs 数组进行修正
       */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      const element: ASTElement = {
        type: 1,
        tag,
        attrsList: attrs,
        attrsMap: makeAttrsMap(attrs), // 将数组类型的 attrs 转为 json
        parent: currentParent,
        children: []
      }

      if (ns) {
        element.ns = ns
      }

      /*
          对 style/script 等标签发出警告：
          模板的作用仅仅是状态和 UI 之间的一个映射作用。
          不要在其中放置一些有副作用的标签，比如 style/script 等，因为它们是不会被解析的。
       */
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.'
        )
      }

      /*
          preTransforms = [ module1.preTransformNode,  module2.preTransformNode,  module2.preTransformNode, ...];
          依次调用各个模块的 preTransformNode 函数
       */
      for (let i = 0; i < preTransforms.length; i++) {
        preTransforms[i](element, options)
      }


      if (!inVPre) {
        // 如果 element 元素的 v-pre 属性存在，那么将 element.pre 标记为 true
        processPre(element)
        if (element.pre) {
          inVPre = true  // element 元素带 v-pre 属性
        }
      }

      // 如果 element.tag 是 pre 标签，那就将 inPre 置为 true
      if (platformIsPreTag(element.tag)) {
        inPre = true    // element 元素标签是 pre
      }

      /*
          ① element 元素带 v-pre 属性，直接把按照所有属性字面意思解析
          processRawAttrs(element) 的作用是添加 el.attrs 属性
          el.attrs : [
              { name : name1, value : value1 },
              { name : name2, value : value2 },
              ...
          ]
       */
      if (inVPre) {
        processRawAttrs(element)
      // ② 否则，就各个属性分别解析
      } else {
        processFor(element)   // 添加 element.for、element.alias、element.iterator1
        processIf(element)    // 添加 element.if、element.else、element.elseif、element.ifConditions 等
        processOnce(element)  // 添加 element.once
        processKey(element)   // 添加 element.key

        // determine whether this is a plain element after removing structural attributes
        // 若 element 元素没有属性，那就认为它是“纯净”的
        element.plain = !element.key && !attrs.length

        processRef(element)   // 添加 element.ref、element.refInFor 等属性
        processSlot(element)  // 添加 element.slotName、element.slotTarget、element.slotScope
        processComponent(element)  // 添加 element.component、element.inlineTemplate
        /*
            transforms = [ module1.transformNode,  module2.transformNode,  module2.transformNode, ...];
            依次调用各模块的 transformNode 方法
         */
        for (let i = 0; i < transforms.length; i++) {
          transforms[i](element, options)
        }
        /*
          首先，取出 el.attrsList 数组，结构大概是：
          [
            { name : name1, value : value1 },
            { name : name2, value : value2 }
            ...
          ]

          然后，遍历 el.attrsList 数组，按每一项的 name 类型，分为两类：
          1. name 为指令类型属性名
             ① name 为 v-bind 类型指令，如 'v-bind:src'
                根据修饰符的不同，该属性既可能是添加事件绑定 addHandler()，也是可能是添加 addProp()，也可能是添加 addAttr()
             ② name 为 v-on 类型指令，如 'v-on:click'
                调用 addHandler() 添加事件绑定
             ③ name 为 一般指令，如 v-show、v-for
                调用 addDirective() 添加指令
          2. name 为一般类型属性名（字面量属性名）
             直接调用 addAttr() 添加 attr
       */
        processAttrs(element)
      }


      // 检查根元素约束条件，发出警告
      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          // ① 不能将 slot/template 标签作为组件根元素，因为它可能包含多个节点
          if (el.tag === 'slot' || el.tag === 'template') {
            warnOnce(
              `Cannot use <${el.tag}> as component root element because it may ` +
              'contain multiple nodes.'
            )
          }
          // ② 不能在状态组件根节点上使用 v-for，因为它会渲染多元素
          if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            )
          }
        }
      }

      // 组织 ast 树

      // 1. 若 root 不存在，那么当前 element 就是 root 根节点
      if (!root) {
        root = element
        checkRootConstraints(root)
      // 2. root 存在，element 是和 root 并列的同级元素
      } else if (!stack.length) {
        /*
          ① element 是和 root 配套的 if-else 结构，如：
          <h1 v-if="a">AAAAA</h1>
          <h1 v-else-if="b">BBBBB<h1>
          <h1 v-else>CCCCC</h1>

          root 是这里的第一个 <h1>，element 可能是第二/三个 <h1>
       */
        // allow root elements with v-if, v-else-if and v-else
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          
          /*
            相当于：
            root.ifConditions.push({
              exp: element.elseif,
              block: element
            })
          */
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        /*
          ② element 是和 root 并列的元素，如：
          <h1>AAAAA</h1>
          <h1>BBBBB<h1>

          root 是这里的第一个 <h1>，element 是第二个 <h1>
          这是不允许的，因为组件模板必须包含一个根元素。
          如果非要多个元素，那就用上面的 if-else 结构
       */
        } else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }

      // element 为 style 或 script 标签时，可能有 element.forbidden = true
      if (currentParent && !element.forbidden) {
        // ① v-elseif 或 v-else
        if (element.elseif || element.else) {
          /*
              实际相当于执行：
              addIfCondition(prev, {
                exp: element.elseif,
                block: element
              })
              其中 prev 是和 element 配套的 v-if 元素
           */
          processIfConditions(element, currentParent)
        // ② 作用域插槽
        } else if (element.slotScope) {
          /*
              例如这里的 <template> 元素：
              <child>
                <template scope="props">
                  <span>hello from parent</span>
                  <span>{{ props.text }}</span>
                </template>
              </child>
           */
          currentParent.plain = false
          const name = element.slotTarget || '"default"';
          (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        // ③ 普通子元素添加进 currentParent.children 数组
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }

      // 不是单标签
      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        endPre(element) // 将 inVPre 和 inPre 值置为 false
      }
      
      /*
          postTransforms = [ module1.postTransformNode,  module2.postTransformNode,  module2.postTransformNode, ...];
          依次调用各模块的 postTransformNode 方法
       */
      for (let i = 0; i < postTransforms.length; i++) {
        postTransforms[i](element, options)
      }
    },

    // 简单的认为该函数作用是更新 currentParent
    end () {
      // ① 去除最后一个元素中最后的空白
      const element = stack[stack.length - 1]
      const lastNode = element.children[element.children.length - 1]
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }

      // ② 最后一个元素出栈，currentParent 为倒数第二个元素
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      endPre(element) // 将 inVPre 和 inPre 值置为 false
    },

    // 将该文本作为 ASTExpression|ASTText 节点加入 currentParent.children 数组
    chars (text: string) {
      // 1. currentParent 不存在，发警告，然后直接返回
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          /*
              template 是原始模板字符串
              text 是从该模板中提取的文本块
              text === templat 说明整个模板都是文本
           */
          // ① 警告：组件模板需要有一个根元素，而不能仅仅是文本
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.'
            )
          // ② 警告：根元素之外的文本会被忽略，如 'abc<div>efg</div>'，text 为 'abc'，这里会提示根元素 <p> 标签之外的 'abc' 会被忽略的
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`
            )
          }
        }
        return
      }

      
      // IE textarea placeholder bug
      // 2. IE 下 `<textarea placeholder=${text}></textarea>` 直接返回
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }

      // 3. currentParent 存在，那就将该文本作为 ASTExpression|ASTText 节点加入 currentParent.children 数组
      
      const children = currentParent.children

      // 对 text 进行转码修正
      text = inPre || text.trim()
        /*
            ① script 和 style 标签为文本标签，不需要解码，其他的标签需要解码
            ② decodeHTMLCached(html) 将 html 赋值给一个 div 的 innerHTML，然后返回这个 div 的 textContent 属性
        */
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        // 只有不是开始标签后（children.length > 0）的空白文本可以保留
        : preserveWhitespace && children.length ? ' ' : ''


      if (text) {
        let expression
        /*
            ① 如果不是 pre 标签内，并且 text 不为 ' '，那就将模板字符串 text 转为浏览器可以解析的字符串 expression
            那就将该文本作为 ASTExpression 节点加入 currentParent.children 数组
         */
        if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
          children.push({
            type: 2,
            expression,
            text
          })
        // ② 将该文本作为 ASTText 节点加入 currentParent.children 数组
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    },
    /*
        declare type ASTText = {
          type: 3;
          text: string;
          static?: boolean;
          isComment?: boolean;
          // 2.4 ssr optimization
          ssrOptimizability?: number;
        };

        将 ASTText 类型节点加入 currentParent.children 数组
     */
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
            name : name2,
            value : value2
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

// 标记 el.ref、el.refInFor 等属性
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

    添加 el.if、el.else、el.elseif、el.ifConditions 等
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


/*
    首先，取出 el.attrsList 数组，结构大概是：
    [
      { name : name1, value : value1 },
      { name : name2, value : value2 }
      ...
    ]

    然后，遍历 el.attrsList 数组，按每一项的 name 类型，分为两类：
    1. name 为指令类型属性名
       ① name 为 v-bind 类型指令，如 'v-bind:src'
          根据修饰符的不同，该属性既可能是添加事件绑定 addHandler()，也是可能是添加 addProp()，也可能是添加 addAttr()
       ② name 为 v-on 类型指令，如 'v-on:click'
          调用 addHandler() 添加事件绑定
       ③ name 为 一般指令，如 v-show、v-for
          调用 addDirective() 添加指令
    2. name 为一般类型属性名（字面量属性名）
       直接调用 addAttr() 添加 attr
 */
function processAttrs (el) {
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
          parseModifiers 函数解析修饰符，返回一个 json，键名是各修饰符，键值是 true
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
      // ③ 一般指令，如 v-show、v-for
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
    // 2. name 为普通属性，也就是字面量属性
    } else {
      if (process.env.NODE_ENV !== 'production') {
        /*
          parseText 函数将模板字符串转为浏览器可以解析的字符串。

          text 可分为 3 个部分，{{ 之前的，{{}} 中间包裹的，}} 之后的。
          函数分别将三者抽离出来，push 进 tokens，最后用 + 连接并返回一个字符串
       
          例如：
          parseText('abc{{msg | fn}}efg')
          -> 'abc' + '_s(_f("fn")(msg))' + 'efg'

          总之，该函数将模板字符串转为浏览器可以识别的常规字符串

          另外，当 value 里没有使用 id="{{ val }}" 这种插值写法时，parseText(value, delimiters) 返回值为 undefined
       */
        const expression = parseText(value, delimiters)
        if (expression) {
          // <div id="{{ val }}"> 这种插值写法不再支持了，推荐使用 <div :id="val">
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      // (el.attrs || (el.attrs = [])).push({ name: name, value: JSON.stringify(value) });
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

// 解析修饰符，返回一个 json，键名是各修饰符，键值都是 true
function parseModifiers (name: string): Object | void {
  // 匹配修饰符 modifierRE = /\.[^.]+/g;
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    /*
      ret : {
        modifier1 : true,
        modifier2 : true,
        ...
      }
    */
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}

//  将数组转成一个 json 对象，键名是属性名，键值是属性值
function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  /*
      遍历 attrs，attrs 结构如下：
      attrs : [
        {name: "id", value: app"},
        {name: "class", value: "red"},
        ...
      ]
   */ 
  for (let i = 0, l = attrs.length; i < l; i++) {
    // 对于重复的属性，发出警告
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    // 逐项添加到 map 
    map[attrs[i].name] = attrs[i].value
  }

  /*
      返回的结构为：
      map = {
        id : "app",
        class : "red",
        ...
      }
   */
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
// script 和 style 标签认为是纯文本标签，不会对其内容解码
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

/*
    以下 3 种情况返回 true：
    ① <style></style>
    ② <script src=".js"></script>
    ③ <script type="text/javascript" src=".js"></script>
 */
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

/*
    原数组和返回结果都是数组，大致结构为：
    [
        {name: "id", value: app"},
        {name: "class", value: "red"},
        ...
    ]
    相当于对原数组某些项做一下修正，并返回这些修正过的项
 */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    /*
        如果 attr.name 没能通过正则 ieNSBug 匹配
        ① 那就将 attr.name 中 ieNSPrefix 匹配出的部分替换为 ''
        ② 将该项 attr 加入数组 res
     */
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

// 遍历 el 的祖先元素，对于 <li v-for="item in items" v-model="item"> 这种形式发出警告
function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      /*
          对于 v-for="item in items" 这种形式
          el.alias = 'item'

          例如： <li v-for="item in items" v-model="item">
          这样把 v-model 直接绑定到 v-for 的 alias 来改变 items 数组是行不通的。

          因为改变 alias 相当于改变一个函数的局部变量，这是不可以的。
          推荐的做法是使用对象组成的数组，然后用 v-model 绑定对象的属性
       */
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
