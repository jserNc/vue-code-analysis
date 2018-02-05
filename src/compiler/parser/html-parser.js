/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
/*
    isNonPhrasingTag = makeMap('address,article,aside,base,blockquote,body,caption,col,colgroup,dd,details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,title,tr,track');
    这个函数的作用是匹配 address,article,aside 等段落元素

    函数名为什么叫 isNonPhrasingTag 呢？
    其实，后面会看到，是因为 p 标签里不允许出现这些段落元素，而不是这些元素本身是非段落元素
 */
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes

// 匹配属性名
const singleAttrIdentifier = /([^\s"'<>/=]+)/
// 匹配 =
const singleAttrAssign = /(?:=)/
// 匹配属性值
const singleAttrValues = [
  /"([^"]*)"+/.source,      // 双引号包起来的属性值
  /'([^']*)'+/.source,      // 单引号包起来的属性值
  /([^\s"'=<>`]+)/.source   // 属性值，没引号
]

// 匹配属性表达式，比如 class = "red"
const attribute = new RegExp(
  '^\\s*' + singleAttrIdentifier.source +         // 属性名
  '(?:\\s*(' + singleAttrAssign.source + ')' +    // =
  '\\s*(?:' + singleAttrValues.join('|') + '))?'  // 属性值
)

// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
// 标签名
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = '((?:' + ncname + '\\:)?' + ncname + ')'
// 开始标签开头
const startTagOpen = new RegExp('^<' + qnameCapture)
// 开始标签结尾
const startTagClose = /^\s*(\/?)>/
// 结束标签
const endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>')
// 文档类型
const doctype = /^<!DOCTYPE [^>]+>/i
// 注释
const comment = /^<!--/
// 条件注释
const conditionalComment = /^<!\[/


let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  /*
      一般情况下，是不会捕获这个分组的，也就是说 g 为 undefined
      但是，某些浏览器会捕获这个分组，g 为空字符串 ''

      若 g === ''，我们认为这是不正常的
      于是，标记 IS_REGEX_CAPTURING_BROKEN 为 true
   */
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
// 纯文本元素（不能包含其他元素）
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

// 解码时候会用到这个映射表
const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n'
}

// 匹配 < > " & 四者之一
const encodedAttr = /&(?:lt|gt|quot|amp);/g
// 匹配 < > " & \n 五者之一
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10);/g

// #5992
// 匹配 pre、textarea 标签（这俩标签本身不会忽略换行，只是配合下面的 shouldIgnoreFirstNewline 函数才起这么个函数名，不要误会）
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
// tag 是 pre、textarea 标签，并且 html 首字符是换行符（后面会忽略这个换行）
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

// 字符实体解码，如 decodeAttr('&lt;') -> '<'
function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

/*
    简化一下 parseHTML 函数：
    function parseHTML (html, options) {
        while (html) {
          ...
        }
        parseEndTag()
        function advance (n) {...}
        function parseStartTag () {...}
        function handleStartTag (match) {...}
        function parseEndTag (tagName, start, end) {...}
    }
    
    实际调用时：
    parseHTML(template, {
        warn: warn$2,             // 报警函数
        expectHTML: expectHTML,   // 是否为 html，布尔值
        isUnaryTag: isUnaryTag,   // 是否为自闭合标签 'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr'
        canBeLeftOpenTag: canBeLeftOpenTag,   // 可以省略闭合标签 'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
        shouldDecodeNewlines: shouldDecodeNewlines, // 如果属性值中有换行符，ie 会将换行符替换为转义字符，这就涉及到是否将这个转义字符解码的问题
        shouldKeepComment: comments, // 是否保留注释
        start: function start (tag, attrs, unary) {...}, // 解析开始标签时调用的钩子函数
        end: function end () {...},  // 解析结束标签时调用的钩子函数
        chars: function chars (text) {...},    // 添加 Attr/Text 子节点
        comment: function comment (text) {...} // 添加注释节点
    });
 */
export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML         // true
  const isUnaryTag = options.isUnaryTag || no   // 判断是否为单标签（不需要闭合标签，如 input）
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no  // 判断是否为自动闭合标签（如 li）
  let index = 0
  let last, lastTag

  // 循环过程中，html 长度会逐渐变短
  while (html) {
    last = html

    // 1. lastTag 不存在 || lastTag 不是 script,style,textarea 等纯文本元素
    if (!lastTag || !isPlainTextElement(lastTag)) {

      // lastTag 是 pre、textarea 标签，并且 html 首字符是换行符（那就忽略这个换行）
      if (shouldIgnoreFirstNewline(lastTag, html)) {
        advance(1)
      }

      /*
        '<' 在字符串 html 中首次出现的位置

        textEnd 表示元素之前的文本的结束位置。举个例子：
        '<p>efg</p>' 文本为 ''，文本结束位置 textEnd 等于 0
        'abc<p>efg</p>' 文本为 'abc'，文本结束位置 textEnd 等于 3
      */
      let textEnd = html.indexOf('<')

      // (1) 解析元素（第一个字符就是 <）
      if (textEnd === 0) {
        /*
            ① 注释 comment = /^<!--/
            注意这里的 ^，也就是说此时 html 必须以 <!-- 开头才能匹配到
         */
        if (comment.test(html)) {
          /*
              indexOf() 方法可返回某个指定的字符串值在字符串中首次出现的位置。
              例如：'abcdabcd'.indexOf('b') -> 1
           */ 
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // 保留注释，调用 comment 钩子函数
            if (options.shouldKeepComment) {
              /*
                html.substring(4, commentEnd) 作用是把注释内容取出来。如：
                
                '<!--this id comment-->'.substring(4, '<!--this id comment-->'.indexOf('-->'))
                -> 'this id comment'

                options.comment(text) 作用是将将 ASTText 类型节点加入 currentParent.children 数组
              */
              options.comment(html.substring(4, commentEnd))
            }
            // 走过注释（3 对应 '-->' 这 3 个字符）
            advance(commentEnd + 3)
            continue
          }
        }

        // ② 条件注释。其中 conditionalComment = /^<!\[/
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          // 走过条件注释（2 对应 ']>'）
          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // ③ 文档类型。其中 doctype = /^<!DOCTYPE [^>]+>/i
        const doctypeMatch = html.match(doctype)
        // 走过文档类型节点
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // ④ 结束标签。其中 endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>')
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          // 走过结束标签
          advance(endTagMatch[0].length)
          /*
                解析结束标签 parseEndTag(tagName, start, end)
                其中 endTagMatch[1] 就是标签名
           */
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // ⑤ 开始标签。剩下的都是开始标签
        const startTagMatch = parseStartTag()
        /*
            开始标签的解析稍微麻烦点（各种属性，标签的嵌套关系需要处理），就交给 parseStartTag 和 handleStartTag 这一对函数处理吧
            a. 只要开始标签正常， parseStartTag() 都会返回一个 json 对象 startTagMatch
            b. 执行 handleStartTag(startTagMatch)，调用 start 钩子函数
         */ 
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          continue
        }
      }

      let text, rest, next
      // (2) 解析文本（第一个字符不是 < ）
      if (textEnd >= 0) {
        // html 中索引 textEnd 之后的片段
        rest = html.slice(textEnd)

        /*
            ① 一般情况下，例如：html = 'abc<p>efg</p>' 中，textEnd 为 3，所以：

            剩余片段 rest = 'abc<p>efg</p>'.slice(3) -> "<p>efg</p>"
            文本 text = 'abc<p>efg</p>'.substring(0, 3) -> 'abc'

            ② 对于非一般情况，例如 html = 'abc<123456<p>efg</p>'，textEnd 仍为 3
            但是，我们会认为 <123456 这段也是文本（两个 < 之间的部分），调整 textEnd 为 10

            也就是说文本区间不能简单的理解为最开始的 0~textEnd

            下面的循环的作用是不断检查剩余的 html 片段（rest）的内容是否为情况 ②，来修正 textEnd
            循环结束后得到的 textEnd 才作为文本的结束位置
         */
        while (
          !endTag.test(rest) &&           // rest 不是以结束标签开头，例如 </div>
          !startTagOpen.test(rest) &&     // rest 不是合法的开始标签开头，例如 <div>
          !comment.test(rest) &&          // rest 不是注释开头
          !conditionalComment.test(rest)  // rest 不是条件注释开头
        ) {
          // < in plain text, be forgiving and treat it as text
          /*
              例如 html = 'abc<123456<p>efg</p>'，textEnd 为 3
              rest = '<123456<p>efg</p>'

              首先，这个 rest 可以通过 while 循环条件吗？可以的！
              a. rest 字符串开始明显不是 endTag、comment、conditionalComment
              b. startTagOpen = new RegExp('^<' + qnameCapture)
                 qnameCapture = '((?:' + ncname + '\\:)?' + ncname + ')'
                 ncname = '[a-zA-Z_][\\w\\-\\.]*'
                 到这里可以看到，标签名必须是字母或者下划线打头，所以 <123456 通不过 startTagOpen 匹配

              然后，看看 indexOf 方法：
              '<123456<p>efg</p>'.indexOf('<') -> 0
              '<123456<p>efg</p>'.indexOf('<',1) -> 7
              所以，next = 7，于是修正 textEnd 为 3 + 7 = 10
           */
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }

        // 取出文本
        text = html.substring(0, textEnd)
        // 走过文本
        advance(textEnd)
      }

      // (3) 整个 html 中都找不到 < ，那么就把整个 html 当做文本
      if (textEnd < 0) {
        text = html
        // html 置空，终止整个循环
        html = ''
      }

      // 调用 chars 钩子函数处理文本（将该文本作为 ASTExpression|ASTText 节点加入 currentParent.children 数组）
      if (options.chars && text) {
        options.chars(text)
      }
    // 2. lastTag 是 script,style,textarea 等纯文本元素
    } else {
      let endTagLength = 0

      // 上一个待闭合标签的小写形式
      const stackedTag = lastTag.toLowerCase()
      /*
          reCache = {}，用来缓存正则表达式

          以 lastTag = 'script' 为例：
          reCache['script'] = /([\s\S]*?)(<\/script[^>]*>)/i
          匹配 'someCode</script>' 这种形式的内容
       */
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      
      /*
          ① 参数 all 表示 reStackedTag 匹配的所有内容，text 表示文本 ([\s\S]*?)，endTag 表示结束标签 (<\/script[^>]*>)
          ② 函数返回值为 ''，说明 html 会去掉 reStackedTag 匹配出的内容
       */
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          /*
              替换 text 中注释和条件注释，例如：
              ① '<!--comment text-->'.replace(/<!--([\s\S]*?)-->/g, '$1')
                 -> "comment text"
              ② '<![CDATA[conditionalComment text]]>'.replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
                 -> "conditionalComment text"
           */
          text = text
            .replace(/<!--([\s\S]*?)-->/g, '$1')
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }

        // stackedTag 是 pre、textarea 标签，并且 text 首字符是换行符，那就忽略这个换行
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }

        // 调用 chars 钩子函数处理 text（将该文本作为 ASTExpression|ASTText 节点加入 currentParent.children 数组）
        if (options.chars) {
          options.chars(text)
        }

        // 注意这个返回值
        return ''
      })

      // 既然 html 去掉了 reStackedTag 匹配出的内容，那就修正 index 和 html
      index += html.length - rest.length
      html = rest

      // 解析结束标签 stackedTag
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 若 html 和处理之前是一样的值，一个字符都没减少,也就是说 html 中没有获取到任何有用的内容
    if (html === last) {
      // html 都当做文本处理（将该文本作为 ASTExpression|ASTText 节点加入 currentParent.children 数组）
      options.chars && options.chars(html)
      // 发出警告
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      // 并终止循环
      break
    }
  }

  // Clean up any remaining tags
  // 没有实参，表示闭合 stack 中的所有标签
  parseEndTag()

  /*
      ① index 值加 n
      ② html 丢掉前 n 个字符
   */
  function advance (n) {
    index += n
    /*
        stringObject.substring(start,stop) 用于提取字符串中介于两个指定下标之间的字符
        其中，stop 参数可选，如果省略该参数，那么返回的子串会一直到字符串的结尾
        
        如 'abcdefgh'.substring(2) -> "cdefgh"
     */
    html = html.substring(n)
  }

  /*
      解析开始标签，返回 json 对象 match ：
      { 
        tagName: start[1],   // 第一个分组匹配出标签名
        attrs: [...],        // 存放属性表达式正则的匹配结果
        start: index         // 开始标签开始索引，对应 <div class="red"> 中 < 位置
        unarySlash: '/'|''   // 标志是否为单标签
        end：index           // 开始标签结束索引，对应 <div class="red"> 中 > 位置
      }
   */
  function parseStartTag () {
    // 开始标签开头 startTagOpen = new RegExp('^<' + qnameCapture)
    const start = html.match(startTagOpen)

    if (start) {
      const match = {
        tagName: start[1],  // 第一个分组匹配出标签名
        attrs: [],          // 存放属性表达式正则的匹配结果
        start: index        // 开始标签开始索引，对应 <div class="red"> 中 < 位置
      }

      /*
          正则 startTagOpen 不带全局标志 g，所以 start[0] 是匹配的整个子串
          走过“开始标签开头”
       */ 
      advance(start[0].length)


      let end, attr

      /*
          ① startTagClose = /^\s*(\/?)>/ 匹配“开始标签结尾”，注意有个 ^
          也就是说 html 必须以空白开头，随后跟一个或零个/，再跟 >

          所以，没到开始标签结束时，end = html.match(startTagClose) 一直返回 false
          
          ② attribute 匹配属性表达式，比如 class = "red"

          所以，以下语句的作用是提取开始标签里所有的属性表达式
       */
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }

      // 开始标签结束，end = html.match(startTagClose) 返回 true
      if (end) {
        /*
            ① <input /> 等自单标签 end[1] 为 '/'
            ② <div> 等标签 end[1] 空 ''
         */ 
        match.unarySlash = end[1]
        // 走过“开始标签结束”
        advance(end[0].length)
        // 开始标签结束索引，对应 <div class="red"> 中 > 位置
        match.end = index

        return match
      }
    }
  }

  /*
      实参 match 结构为：
      { 
        tagName: start[1],   // 第一个分组匹配出标签名
        attrs: [],           // 存放属性表达式正则的匹配结果
        start: index         // 开始标签开始索引，对应 <div class="red"> 中 < 位置
        unarySlash: '/'|''   // 标志是否为单标签
        end：index           // 开始标签结束索引，对应 <div class="red"> 中 > 位置
      }

      该函数作用：
      ① 往数组 stack 中压栈；
      ② 调用 start 钩子函数
   */
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    // expectHTML 默认就是 true
    if (expectHTML) {
      /*
          isNonPhrasingTag = makeMap('address,article,aside,base,blockquote,body,caption,col,colgroup,dd,details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,title,tr,track');
          
          p 标签里不能是 address,article,aside... 等块级标签
          所以，若 <p><address>  这种不合规范的，直接关闭 p 标签
       */
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }

      // 若当前标签和上一个标签都是可以自动闭合的标签，比如 li，那就关闭当前标签
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 标记当前 tagName 是否为单标签，比如 <input/>
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)

    /* 
        遍历属性表达式正则的匹配结果
        给 attrs 数组添加数据：
        attrs = [
            { name : attrName,value : attrVal },
            { name : attrName,value : attrVal }
            ...
        ]
    */
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      /*
          匹配属性的正则表达式，/^\s*([^\s"'<>\/=]+)(?:\s*((?:=))\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
          其中 args[3|5|5] 分别对应以下几个分组：
          singleAttrValues = [
            /"([^"]*)"+/.source,      // 双引号包起来的属性值
            /'([^']*)'+/.source,      // 单引号包起来的属性值
            /([^\s"'=<>`]+)/.source   // 属性值，没引号
          ]

          IS_REGEX_CAPTURING_BROKEN 为 true，说明正则表达式捕获损坏了，意味着空字符串 "" 也可以匹配出内容，这是不对的
          args[3] 匹配的是 ([^"]*) 非 "
          args[4] 匹配的是 ([^']*) 非 '
          args[5] 匹配的是 ([^\s"'=<>`]+) 非 "'=<>`以及空白
          所以可能匹配出空字符串 ''，这是不需要的
      */
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }

      // 只要有一个有值，就是我们想要的属性值
      const value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],        // 属性名
        value: decodeAttr(    // 属性值，其中 decodeAttr('&amp;') -> '&'
          value,
          options.shouldDecodeNewlines
        )
      }
    }

    /*
        若当前标签不是单标签，比如 div，那么压栈
        所以，stack 的结构为：
        stack = [
            { 
              tag: "DIV", 
              lowerCasedTag : "div", 
              attrs : [
                  { name : attrName,value : attrVal },
                  { name : attrName,value : attrVal }
                  ...
              ]
            }
            ...
        ]
     */
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    // 调用 start 钩子函数
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  /*
      该函数的作用为：
      ① 大多数情况下，调用 end 钩子函数
      ② br、p 等个别标签会调用 start 钩子函数
   */
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName

    // start/end 实参不存在时，都赋值为 index
    if (start == null) start = index
    if (end == null) end = index

    // 标签名的小写形式
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      /*
          stack 是一个数组栈，结构为：
          stack = [
              { tag: "DIV", lowerCasedTag : "div", attrs : [{ name : attrName,value : attrVal },{ name : attrName,value : attrVal }...]},
              { tag: "SPAN", lowerCasedTag : "span", attrs : [{ name : attrName,value : attrVal },{ name : attrName,value : attrVal }...]},
              { tag: "a", lowerCasedTag : "a", attrs : [{ name : attrName,value : attrVal },{ name : attrName,value : attrVal }...]},
              { tag: "img", lowerCasedTag : "img", attrs : [{ name : attrName,value : attrVal },{ name : attrName,value : attrVal }...]}
          ]
          从后往前找，找到最近的标签名为 lowerCasedTagName 的那一项
          ① 如果找到了对应项，那么 pos 就是该项的索引
      */
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    // ② 没标签名，显然没有对应项，直接将 pos 置为 0
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    /*
        1. 找到了对应项，关闭其后的所有标签
           比如：对结构 <DIV><SPAN><a><img> 关闭 span 标签，即 parseEndTag('span')
           那就需要关闭 span 标签后的所有标签，也就是说 span、a、img 标签都要关闭
     */
    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        /*
             正常情况下应该是关闭 img 标签，而这里越级关闭 span 标签导致 a、img 标签异常关闭
             所以，对 a、img 标签发出警告：tag a|img has no matching end tag.
         */
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }

        // 调用 end 钩子函数，关闭标签 stack[i].tag
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      // 将已关闭标签从 stack 中移除
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    // 2. 若是 br 标签，它不存在结束，直接调用 start 钩子函数
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    // 3. p 标签里有 address,article,aside... 等块级标签时，直接关闭，调用 start、end 钩子函数
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
