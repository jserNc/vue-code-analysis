/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

/*
    简单地看：
    function createCompilerCreator (baseCompile) {
        return function createCompiler (baseOptions) {
            function compile (template, options) {
                ...
                var compiled = baseCompile(template, finalOptions);
                ...
                return compiled;
            }

            return {
              compile: compile,
              compileToFunctions: createCompileToFunctionFn(compile)
            }
        }
    }

    所以：
    createCompilerCreator 函数生成 createCompiler 函数
    实参 baseCompile 不一样，生成的 createCompiler 函数也不一样（createCompiler 函数内部会用到 baseCompile 函数）

    createCompiler (baseOptions)
    -> {
      compile: compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
 */
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
