/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

/*
  /\{\{((?:.|\n)+?)\}\}/g
  其中 . 表示任意字符，除了换行符，\n 表示换行符，合一起就表示任意字符了

  所以，这个正则的匹配的是 {{ 任意字符 1 次或多次 }}
 */
const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
// 匹配以下字符之一 - . * + ? ^ $ { } ( ) [ ] / \
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  /*
      对于 stringObject.replace(regexp|substr,replacement)，replacement 中的 $ 有特殊含义：

      $$    插入一个 "$"
      $&    插入与 regexp 匹配的子串
      $`    插入当前匹配的子串左边的内容
      $'    插入当前匹配的子串右边的内容
      $1、$2、...、$99   与 regexp 中的第 1 到第 99 个子表达式相匹配的文本

      所以 '\\$&' 表示在原字符串开头加上 \，例如：
      "Enjoy javascript".replace(/(\w+)\s(\w+)/, "\\$&")
      -> "\Enjoy javascript"

      所以这个方法的作用是将 - . * + ? ^ $ { } ( ) [ ] / \ 等字符前加一个 \，然后拼接锦字符串，再生成正则表达式

      例如 buildRegex(['{{','}}']) -> /\{\{((?:.|\n)+?)\}\}/g
  */
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

/*
    该函数将模板字符串转为浏览器可以解析的字符串。

    text 可分为 3 个部分，{{ 之前的，{{}} 中间包裹的，}} 之后的。
    函数分别将三者抽离出来，push 进 tokens，最后用 + 连接并返回一个字符串
 
    例如：
    parseText('abc{{msg | fn}}efg')
    -> 'abc' + '_s(_f("fn")(msg))' + 'efg'

    总之，该函数将模板字符串转为浏览器可以识别的常规字符串
 */
export function parseText (
  text: string,
  delimiters?: [string, string]
): string | void {
  /*
      根据分界符生成正则，例如 delimiters = ['{{','}}']
      buildRegex(delimiters) -> /\{\{((?:.|\n)+?)\}\}/g
   */ 
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  
  // 若不是模板字符串，就此返回
  if (!tagRE.test(text)) {
    return
  }

  const tokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index
  /*
    看一看：RegExpObject.exec(string)

    ① 正则 RegExpObject 不含 g 参数，也就是非全局的匹配

       如果 exec() 找到了匹配的文本，则返回一个结果数组。否则，返回 null。
       此数组的第 0 个元素是与正则表达式相匹配的文本，第 1 个元素是与 RegExpObject 的第 1 个子表达式相匹配的文本（如果有的话），
       第 2 个元素是与 RegExpObject 的第 2 个子表达式相匹配的文本（如果有的话），以此类推。
       除了数组元素和 length 属性之外，exec() 方法还返回两个属性。index 属性声明的是匹配文本的第一个字符的位置。
       input 属性则存放的是被检索的字符串 string。

       我们可以看得出，在调用非全局的 RegExp 对象的 exec() 方法时，返回的数组与调用方法 String.match() 返回的数组是相同的。

    ② 正则 RegExpObject 含有 g 参数，也就是全局匹配
       
       它会在 RegExpObject 的 lastIndex 属性指定的字符处开始检索字符串 string。
       当 exec() 找到了与表达式相匹配的文本时，在匹配后，它将把 RegExpObject 的 lastIndex 属性设置为匹配文本的最后一个字符的下一个位置。
       这就是说，您可以通过反复调用 exec() 方法来遍历字符串中的所有匹配文本。
       当 exec() 再也找不到匹配的文本时，它将返回 null，并把 lastIndex 属性重置为 0。
   */
  while ((match = tagRE.exec(text))) {
    index = match.index

    // ① text 中被 tagRE 本次匹配到的子串左边的内容，例如 'aaa{{ message1 }}abc{{ message2 }}efg' 中的 'aaa'、'abc'
    if (index > lastIndex) {
      tokens.push(JSON.stringify(text.slice(lastIndex, index)))
    }
    /*
        将分界符内的文本经过 parseFilters 函数处理，例如：
        parseFilters("message | filterA | filterB")
        -> "_f("filterB")(_f("filterA")(message))"
     */
    const exp = parseFilters(match[1].trim())

    /*
        Vue.prototype._s = toString
        ② text 中被 tagRE 本次匹配到的子串
     */ 
    tokens.push(`_s(${exp})`)
    // 移动游标（移到本次匹配结束的位置）
    lastIndex = index + match[0].length
  }
  
  // ③ text 中被 tagRE 本次匹配到的子串右边的内容，例如 '{{ message1 }}abc{{ message2 }}efg' 中的 'efg'
  if (lastIndex < text.length) {
    tokens.push(JSON.stringify(text.slice(lastIndex)))
  }

  // 最终用 '+' 连接数组元素，其实就是连接成一个字符串，例如 'abc' + '_s(message2)' + 'efg'
  return tokens.join('+')
}
