/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

// 生成一个闭包函数
export function createCompilerCreator (baseCompile: Function): Function {
  /*
    var baseOptions = {
      expectHTML: true,
      modules: modules$1,                    // class、style 模块
      directives: directives$1,              // model、text、html 指令
      isPreTag: isPreTag,                    // 是否为 pre 标签
      isUnaryTag: isUnaryTag,                // 是否为自闭合标签
      mustUseProp: mustUseProp,
      canBeLeftOpenTag: canBeLeftOpenTag,    // 可以省略闭合标签
      isReservedTag: isReservedTag,
      getTagNamespace: getTagNamespace,
      staticKeys: genStaticKeys(modules$1)
    };
  */
  return function createCompiler (baseOptions: CompilerOptions) {
    
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions)

      const errors = []
      const tips = []

      // 向 errors/tips 数组里添加 msg
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // 根据 options 修正 finalOptions 对象
      if (options) {
        // 合并自定义模块
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // 合并自定义指令
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives),
            options.directives
          )
        }
        // 复制其他选项
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      /*
        compiled 结构为：
        {
            ast: ast,
            render: `with(this){return someCode}`,
            staticRenderFns: [stringCode1, stringCode2, ...]
         }
      */
      const compiled = baseCompile(template, finalOptions)
      
      if (process.env.NODE_ENV !== 'production') {
        // detectErrors() 返回一个 error 数组
        errors.push.apply(errors, detectErrors(compiled.ast))
      }


      compiled.errors = errors
      compiled.tips = tips

      /*
        到这里 compiled 结构为：
        {
            ast: ast,
            render: `with(this){return someCode}`,
            staticRenderFns: [stringCode1, stringCode2, ...],
            errors: [err1, err2,...],
            tips: [tip1, tip2,...]
         }
      */
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
