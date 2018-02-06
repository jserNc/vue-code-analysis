/* @flow */

/*
		① parseComponent(content, options) 将一个 .vue 文件转为一个 sfc 对象。

		② compile(template, options) 将模板 template 编译成 ast，返回值为：
			 {
          ast: ast,
          render: code.render,
          staticRenderFns: code.staticRenderFns
          errors: errors,
          tips: tips
       }

    ③ compileToFunctions(template, options, vm) 会根据模板 template 返回一个 json：
    	 { 
    	 		render: fn, 
    	 		staticRenderFns: [...]
    	 }

   	④ ssrCompile、ssrCompileToFunctions 分别和 compile、compileToFunctions 类似
 */ 
export { parseComponent } from 'sfc/parser'
export { compile, compileToFunctions } from './compiler/index'
export { ssrCompile, ssrCompileToFunctions } from './server/compiler'
