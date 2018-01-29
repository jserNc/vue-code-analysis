/* @flow */

import { noop } from 'shared/util'
import { warn, tip } from 'core/util/debug'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

// 创建一个方法，以 code 为执行代码块，若出错，则返回一个空方法
function createFunction (code, errors) {
  try {
    // ① 正常情况返回一个匿名函数
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    // ② 出错则返回一个空方法
    return noop
  }
}

// 返回一个闭包函数
export function createCompileToFunctionFn (compile: Function): Function {
  // template 和 options 可以唯一确定一个渲染函数，所以可以缓存计算结果
  const cache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  /* 
    将 compile 函数转为 json：
    {
        render : Function,
        staticRenderFns : Array<Function>;
    }
 */
  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = options || {}


    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      // CSP 是由单词 Content Security Policy 的首字母组成，CSP 旨在减少跨站脚本攻击
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          /*
            您正在使用独立版本的 Vue.js。当前环境的“内容安全政策”禁止不安全的 eval。
            模板编译器在这样的环境里是不能生效的。可以考虑解除“内容安全政策”以支持不安全的 eval。
            或者将您的模板预编译进渲染函数也是可以的。
          */
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template

    // 优先从缓存取，若取到了就此返回
    if (cache[key]) {
      return cache[key]
    }

    // 第 1 步：编译
    const compiled = compile(template, options)
    /*
       compiled 结构:
       {
          ast: ast,
          render: code.render,
          staticRenderFns: code.staticRenderFns
          errors: [...],
          tips: [...]
       }
     */

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      // 编译出错
      if (compiled.errors && compiled.errors.length) {
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      // 编译提示
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // 第 2 步，将代码文本转为真正的函数

    // turn code into functions
    const res = {}
    const fnGenErrors = []

    // 文本（compiled.render）-> 函数（res.render），发生的错误加入到数组 fnGenErrors 中
    res.render = createFunction(compiled.render, fnGenErrors)
    
    // 文本数组（compiled.staticRenderFns）-> 函数数组（res.staticRenderFns），发生的错误加入到数组 fnGenErrors 中
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    
    // 代码文本转化为渲染函数过程中出现了错误
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    // 缓存结果，并返回
    return (cache[key] = res)
  }
}
