/* @flow */

/**
 * Cross-platform code generation for component v-model
 */
// 针对 v-model 生成 el.model 这个 json 对象
export function genComponentModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
): ?boolean {
  const { number, trim } = modifiers || {}

  // $$v 是一个变量名，在该函数外定义的，$$v = number ? _n(valueBinding): valueBinding
  const baseValueExpression = '$$v'
  let valueExpression = baseValueExpression

  // ① 有 trim 修饰符，那就去掉 valueExpression 两端空格
  if (trim) {
    valueExpression =
      `(typeof ${baseValueExpression} === 'string'` +
        `? ${baseValueExpression}.trim()` +
        `: ${baseValueExpression})`
  }

  // ② 有 number 修饰符，那就将 valueExpression 转为数值
  if (number) {
    valueExpression = `_n(${valueExpression})`
  }

  /*
    1. 例如 value = 'varA', assignment = '123'，那么 assignment = 'varA = 123'
    2. 例如 value = 'obj[a]', assignment = '123' 那么 assignment = '$set(obj, a, 123)'
 */
  const assignment = genAssignmentCode(value, valueExpression)

  el.model = {
    value: `(${value})`,
    expression: `"${value}"`,
    callback: `function (${baseValueExpression}) {${assignment}}`
  }
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
/*
    1. 例如 value = 'varA', assignment = '123' 返回 'varA = 123'
    2. 例如 value = 'obj[a]', assignment = '123' 返回 '$set(obj, a, 123)'
 */
export function genAssignmentCode (
  value: string,
  assignment: string
): string {
  /*
      例如：
      parseModel('test[idx]')
      -> {
          exp: "test", 
          idx: "idx"
      }
   */
  const modelRs = parseModel(value)
  // ① 普通的赋值，parseModel 函数走的是流程1 
  if (modelRs.idx === null) {
    return `${value}=${assignment}`
  // ② 给对象/数组赋值，需要通知变化
  } else {
    /*
        set (target, key, val) 给 target 添加 key 属性（值为 val）。若该属性之前不存在，发出变化通知。
        Vue.prototype.$set = set;

        这里虽然没有用 vm.$set() 写法，但是最后它是以 with(this){$set()} 这种写法绑定到 vm 上的
     */
    return `$set(${modelRs.exp}, ${modelRs.idx}, ${assignment})`
  }
}

/**
 * parse directive model to do the array update transform. a[idx] = val => $$a.splice($$idx, 1, val)
 *
 * for loop possible cases:
 *
 * - test
 * - test[idx]
 * - test[test1[idx]]
 * - test["a"][idx]
 * - xxx.test[a[a].test1[idx]]
 * - test.xxx.a["asa"][test1[idx]]
 *
 */

let len, str, chr, index, expressionPos, expressionEndPos

/*
    解析字符串 val，返回 json 对象 
    例如：
    parseModel('test[idx]')
    -> {
        exp: "test", 
        idx: "idx"
    }

    parseModel('test[test1[idx]]')
    -> {
        exp: "test", 
        idx: "test1[idx]"
    }

    parseModel('test["a"][idx]')
    -> {
        exp: 'test["a"]', 
        idx: "idx"
    }
    这个执行结果不应感到意外，因为每次遇到 [ 都会执行 parseBracket 方法
    这个方法会重置 expressionPos 和 expressionEndPos 的值
 */
export function parseModel (val: string): Object {
  str = val
  len = str.length
  index = expressionPos = expressionEndPos = 0

  /*
    lastIndexOf() 方法可返回一个指定的字符串值最后出现的位置

    若没有方括号，或方括号完整关闭，直接返回一个 json
  */
  // 流程1：没做处理，直接返回 json，注意这里的 idx 为 null
  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    return {
      exp: val,
      idx: null
    }
  }

  // 流程2 ：遍历 val 字符串，最后返回计算过的 json

  // 循环结束条件：整个 val 字符串遍历完
  while (!eof()) {
    chr = next()

    // 遇到引号就一直向前走，直到引号关闭
    if (isStringStart(chr)) {
      parseString(chr)
    // '\x5B' -> "["，遇到左括号，就一直向前走，直至关闭该括号
    } else if (chr === 0x5B) {
      // 这个操作会给 expressionPos 和 expressionEndPos 赋值
      parseBracket(chr)
    }
  }

  /*
      ① expressionPos 是方括号开始的位置，expressionEndPos 是方括号结束的位置
      ② substring() 方法用于提取字符串中介于两个指定下标之间的字符

      例如：'abc[0]':
      exp 就是表达式 'abc'，idx 就是索引 '0'
   */
  return {
    // [] 之前的内容
    exp: val.substring(0, expressionPos),
    // [] 里的内容
    idx: val.substring(expressionPos + 1, expressionEndPos)
  }
}

/*
    charCodeAt() 方法可返回指定位置的字符的 Unicode 编码。这个返回值是 0 - 65535 之间的整数。
    charCodeAt() 与 charAt() 方法执行的操作相似，只不过前者返回的是位于指定位置的字符的编码，而后者返回的是字符子串。

    'abc'.charCodeAt(1) -> 98
    'abc'.charAt(1) -> 'b'

    next 函数的作用是返回下一个字符的 Unicode 编码，index 加 1
*/
function next (): number {
  return str.charCodeAt(++index)
}

// eof -> end of file，代表结束位置？
function eof (): boolean {
  return index >= len
}

// 是否是字符串开始
function isStringStart (chr: number): boolean {
  // '\x22' -> "  '\x27' -> '
  return chr === 0x22 || chr === 0x27
}

// 解析括弧，若遇到括弧开始符 [，那就一直往前走，直到括弧结束符 ]
function parseBracket (chr: number): void {
  let inBracket = 1
  // ① 括弧开始 [
  expressionPos = index
  // 循环结束条件为：字符串结束
  while (!eof()) {
    chr = next()

    // 如果遇到引号（单引号或双引号），就一直向后走，直到引号关闭
    if (isStringStart(chr)) {
      parseString(chr)
      // 引号结束，肯定就不是 [ 或 ] 了，本次循环后面就不执行了。这个小小的优化有心了。
      continue
    }

    // '\x5B' -> [
    if (chr === 0x5B) inBracket++
    // '\x5B' -> ]
    if (chr === 0x5D) inBracket--

    // ② 找到配对的结束括弧 ]
    if (inBracket === 0) {
      expressionEndPos = index
      break
    }
  }
}

// 解析引号，若遇到引号开始 " 或 '，那就一直往前走，直到引号结束 " 或 '
function parseString (chr: number): void {
  // ① 单引号/双引号开始
  const stringQuote = chr
  while (!eof()) {
    chr = next()
    // ② 找到配对的单引号/双引号结束
    if (chr === stringQuote) {
      break
    }
  }
}
