/* @flow */

import { dirRE, onRE } from './parser/index'

// these keywords should not appear inside expressions, but operators like
// typeof, instanceof and in are allowed
/*
    以下关键词是不能出现在表达式当中的，不过，typeof、instanceof、in 等运算符是可以的
    prohibitedKeywordRE = /\bdo\b|\bif\b|\bfor\b|\blet\b|\bnew\b|\btry\b|\bvar\b|\bcase\b|\belse\b|\bwith\b|\bawait\b|\bbreak\b|\bcatch\b|\bclass\b|\bconst\b|\bsuper\b|\bthrow\b|\bwhile\b|\byield\b|\bdelete\b|\bexport\b|\bimport\b|\breturn\b|\bswitch\b|\bdefault\b|\bextends\b|\bfinally\b|\bcontinue\b|\bdebugger\b|\bfunction\b|\barguments\b/
 */
const prohibitedKeywordRE = new RegExp('\\b' + (
  'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
  'super,throw,while,yield,delete,export,import,return,switch,default,' +
  'extends,finally,continue,debugger,function,arguments'
).split(',').join('\\b|\\b') + '\\b')

// these unary operators should not be used as property/method names
/*
    以下一元运算符不能被用作属性/方法名
    unaryOperatorsRE = /\bdelete\s*\([^\)]*\)|\btypeof\s*\([^\)]*\)|\bvoid\s*\([^\)]*\)/
 */
const unaryOperatorsRE = new RegExp('\\b' + (
  'delete,typeof,void'
).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)')

// check valid identifier for v-for
// v-for 中有效的标识符，A-Za-z_$ 开头，后跟若干个 \w 或 $
const identRE = /[A-Za-z_$][\w$]*/

// strip strings in expressions
/*
    在表达式中剥去字符串
    ① 'someString'
    ② "someString"
    ③ `someString${
    ④ }someString`
    ⑤ `someString`
*/
const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

// detect problematic expressions in a template
// 检查 ast，返回一个错误数组
export function detectErrors (ast: ?ASTNode): Array<string> {
  const errors: Array<string> = []
  if (ast) {
    checkNode(ast, errors)
  }
  return errors
}

function checkNode (node: ASTNode, errors: Array<string>) {
  /*
      ASTNode = ASTElement | ASTText | ASTExpression，其中：
      ASTElement 的 type 类型为 1
      ASTText 的 type 类型为 3
      ASTExpression 的 type 类型为 2
   */ 
  
  // 1. ASTElement 的 type 类型为 1
  if (node.type === 1) {
    for (const name in node.attrsMap) {
      // dirRE = /^v-|^@|^:/
      if (dirRE.test(name)) {
        const value = node.attrsMap[name]
        if (value) {
          // ① 检查 v-for
          if (name === 'v-for') {
            checkFor(node, `v-for="${value}"`, errors)
          // ② 检查 v-on，其中 onRE = /^@|^v-on:/
          } else if (onRE.test(name)) {
            checkEvent(value, `${name}="${value}"`, errors)
          // ③ 检查其他类型表达式
          } else {
            checkExpression(value, `${name}="${value}"`, errors)
          }
        }
      }
    }
    // 递归检查子元素
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        checkNode(node.children[i], errors)
      }
    }
  // 2. ASTExpression 的 type 类型为 2
  } else if (node.type === 2) {
    checkExpression(node.expression, node.text, errors)
  }
}

// 检查 v-on
function checkEvent (exp: string, text: string, errors: Array<string>) {
  // ① 剔除 exp 中的字符串
  const stipped = exp.replace(stripStringRE, '')
  // ② 剩下的 exp 中匹配 delete,typeof,void 等一元运算符
  const keywordMatch: any = stipped.match(unaryOperatorsRE)
  /*
      'abcd'.match(/c/)
      -> ["c", index: 2, input: "abcd"]

      正则中没有全局标志 g，它将返回一个数组，其中存放了与它找到的匹配文本有关的信息。
      该数组的第 0 个元素存放的是匹配文本，而其余的元素存放的是与正则表达式的子表达式匹配的文本。
      除了这些常规的数组元素之外，返回的数组还含有两个对象属性。index 属性声明的是匹配文本的起始字符在 stringObject 中的位置，input 属性声明的是对 stringObject 的引用
   */
  if (keywordMatch && stipped.charAt(keywordMatch.index - 1) !== '$') {
    // 一元运算符不能被用作属性/方法名
    errors.push(
      `avoid using JavaScript unary operator as property name: ` +
      `"${keywordMatch[0]}" in expression ${text.trim()}`
    )
  }
  // 执行表达式 exp，若出现错误，将该错误加入数组 errors
  checkExpression(exp, text, errors)
}

// 检查 v-for 各字段
function checkFor (node: ASTElement, text: string, errors: Array<string>) {
  /*
      v-for = "(value, key) in items"
      数据源 el.for = 'items'
      数据项 el.alias = 'value'
      数据子项 el.iterator1 = "key"
      数据子项 el.iterator2 = ""
  */
  checkExpression(node.for || '', text, errors)
  checkIdentifier(node.alias, 'v-for alias', text, errors)
  checkIdentifier(node.iterator1, 'v-for iterator', text, errors)
  checkIdentifier(node.iterator2, 'v-for iterator', text, errors)
}

// 检查标识符
function checkIdentifier (ident: ?string, type: string, text: string, errors: Array<string>) {
  // identRE = /[A-Za-z_$][\w$]*/
  if (typeof ident === 'string' && !identRE.test(ident)) {
    // 错误信息加到 errors 数组里
    errors.push(`invalid ${type} "${ident}" in expression: ${text.trim()}`)
  }
}

// 执行表达式 exp，若出现错误，将该错误加入数组 errors
function checkExpression (exp: string, text: string, errors: Array<string>) {
  try {
    // 用 exp 表达式作为函数体，若报错，说明这个函数体有问题
    new Function(`return ${exp}`)
  } catch (e) {
    /*
        ① 把 exp 中的字符串剔除
        ② 检测是否有 do if for let 等关键词
    */
    const keywordMatch = exp.replace(stripStringRE, '').match(prohibitedKeywordRE)
    // 错误类型1：关键词作为属性名
    if (keywordMatch) {
      errors.push(
        `avoid using JavaScript keyword as property name: ` +
        `"${keywordMatch[0]}" in expression ${text.trim()}`
      )
    // 错误类型2：无效的表达式
    } else {
      errors.push(`invalid expression: ${text.trim()}`)
    }
  }
}
