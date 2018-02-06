/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

/*
  模板
  <div>
    <header>
      <h1>I'm a template!</h1>
    </header>
    <p v-if="message">
      {{ message }}
    </p>
    <p v-else>
      No message.
    </p>
  </div>  

  编译后
  render: function anonymous() {
    with(this){return _c('div',[_m(0),(message)?_c('p',[_v(_s(message))]):_c('p',[_v("No message.")])])}
  }

  staticRenderFns:[_m(0): function anonymous() {
    with(this){return _c('header',[_c('h1',[_v("I'm a template!")])])}
  }]
*/



// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
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
 */
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
   /*
      ① 生成 ast 树，结构大致如下：
      {
          type: 1,
          tag: tag,
          attrsList: 数组形式的属性列表,
          attrsMap: json 对象形式的属性列表,
          parent: currentParent,
          children: [],
          ns : 命名空间
          forbidden : 禁用
          pre : 是否有 v-pre 属性
          plain : 是否移除结构化的 attribute 和 key 后，该元素不存在属性
       }
  */
  const ast = parse(template.trim(), options)

  // ② 优化 ast 树，其实就是给 ast 添加 ast.static、ast.staticInFor、ast.staticRoot 等属性，属性值为 true | false
  optimize(ast, options)

  /*
      ③ 返回一个 json 对象
      {
        render: `with(this){return someCode}`,
        staticRenderFns: [stringCode1, stringCode2, ...]
      }
   */
  const code = generate(ast, options)

  // ④ 返回 json 对象
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
