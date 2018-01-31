/* @flow */

// 匹配 ).+-_$] word 之一，有效的分隔符
const validDivisionCharRE = /[\w).+\-_$\]]/

/*
    解析过滤器，例如：
    parseFilters("message | filterA('arg1', arg2)")
    -> "_f("filterA")(message,'arg1', arg2)"

    parseFilters("message | filterA | filterB")
    -> "_f("filterB")(_f("filterA")(message))"
 */
export function parseFilters (exp: string): string {
  let inSingle = false            // '单引号'
  let inDouble = false            // "双引号"
  let inTemplateString = false    // `模板字符串`
  let inRegex = false             // /正则表达式/
  let curly = 0                   // {花括号}
  let square = 0                  // [方括号]
  let paren = 0                   // (括号)
  let lastFilterIndex = 0
  let c, prev, i, expression, filters

  for (i = 0; i < exp.length; i++) {
    prev = c
    /*
        charCodeAt() 方法可返回指定位置的字符的 Unicode 编码。这个返回值是 0 - 65535 之间的整数。
        charCodeAt() 与 charAt() 方法执行的操作相似，只不过前者返回的是位于指定位置的字符的编码，而后者返回的是字符子串。
     */
    c = exp.charCodeAt(i)

    // ① 如果已经有一个 ' 就会走这个分支，来闭合 ''
    if (inSingle) {
      // 0x27 -> '  0x5C -> \
      if (c === 0x27 && prev !== 0x5C) inSingle = false
    // ② 如果已经有一个 " 就会走这个分支，来闭合 ""
    } else if (inDouble) {
      // 0x22 -> "
      if (c === 0x22 && prev !== 0x5C) inDouble = false
    // ③ 如果已经有一个 ` 就会走这个分支，来闭合 ``    
    } else if (inTemplateString) {
      // 0x60 -> `
      if (c === 0x60 && prev !== 0x5C) inTemplateString = false
    // ④ 如果已经有一个 / 就会走这个分支，来闭合 //
    } else if (inRegex) {
      // 0x2f -> /
      if (c === 0x2f && prev !== 0x5C) inRegex = false
    // ⑤ 取出第一个管道符 | 之前的“待处理参数”
    } else if (
      // 0x7C -> |
      c === 0x7C && // pipe
      exp.charCodeAt(i + 1) !== 0x7C &&
      exp.charCodeAt(i - 1) !== 0x7C &&
      // curly、square、paren 必须同时为 0，表示花括号、方括号、括号都是闭合的
      !curly && !square && !paren
    ) {
      /*
          第一个管道符 | 之前的是"待处理的参数"，之后的才是 filter

          以 parseFilters("message | filterA | filterB") 为例：
          即，message 是"待处理的参数"，filterA 和 filterB 才是 filter
       */
      // a. 第一个管道符之前的部分是“参数”
      if (expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1
        expression = exp.slice(0, i).trim()
      // b. 其他才是“过滤函数”
      } else {
        pushFilter()
      }
    } else {
      switch (c) {
        case 0x22: inDouble = true; break         // "
        case 0x27: inSingle = true; break         // '
        case 0x60: inTemplateString = true; break // `
        case 0x28: paren++; break                 // (
        case 0x29: paren--; break                 // )
        case 0x5B: square++; break                // [
        case 0x5D: square--; break                // ]
        case 0x7B: curly++; break                 // {
        case 0x7D: curly--; break                 // }
      }
      if (c === 0x2f) { // /
        let j = i - 1
        let p
        // find first non-whitespace prev char
        // 找到 / 之前的第一个非空格字符
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        /*
              validDivisionCharRE = /[\w).+\-_$\]]/
              匹配 ).+-_$] word 之一，有效的分隔符
         */
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }

  if (expression === undefined) {
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    pushFilter()
  }

  // 从 exp 中取出 filter，并加入到数组 filters
  function pushFilter () {
    (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    // filter 直接用 | 隔开，所以下一个 filter 起始字符为 i + 1，而不是 i
    lastFilterIndex = i + 1
  }

  /*
      执行到这里，看着变量 filters 和 expression 分别是什么：
      ① parseFilters("message | filterA('arg1', arg2)")

         filters -> ["filterA('arg1', arg2)"]
         expression -> message

      ② parseFilters("message | filterA | filterB")

         filters -> ["filterA", "filterB"]
         expression -> message
   */

  if (filters) {
    for (i = 0; i < filters.length; i++) {
      /*
        对于 parseFilters("message | filterA | filterB")

        i = 0, expression -> _f("filterA")(message)
        i = 1, expression -> _f("filterB")(_f("filterA")(message))
       */
      expression = wrapFilter(expression, filters[i])
    }
  }

  return expression
}

/*
    Vue.prototype._f = resolveFilter
    function resolveFilter (id) {
      // 根据 id 返回某个指定的过滤器
      return resolveAsset(this.$options, 'filters', id, true) || identity
    }

    所以 
    ① _f("filterA") 会返回一个函数
    ② _f("filterA")(message) 会返回一个执行结果
 */
function wrapFilter (exp: string, filter: string): string {
  const i = filter.indexOf('(')
  /*
      ① filter 中不带括号 ()
      如 wrapFilter('message','filterA') -> "_f("filterA")(message)"
   */
  if (i < 0) {
    // _f: resolveFilter
    return `_f("${filter}")(${exp})`
  /*
      ① filter 中带括号 ()
      例如： wrapFilter("message | filterA('arg1', arg2)")
            filter 为 "filterA('arg1', arg2)"
            name 为 "filterA"，
            args 为 "'arg1', arg2)"


      于是，wrapFilter('message',"filterA('arg1', arg2)") -> "_f("filterA")(message,'arg1', arg2)"
   */
  } else {
    const name = filter.slice(0, i)
    const args = filter.slice(i + 1)
    return `_f("${name}")(${exp},${args}`
  }
}
