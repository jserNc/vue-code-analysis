/* @flow */

import { baseOptions } from '../compiler/options'
import { createCompiler } from 'server/optimizing-compiler/index'

/*
		函数 createCompiler 返回一个 json 对象：
		function createCompiler (baseOptions) {
			function compile (template, options) {...}

			return {
	      compile: compile,
	      compileToFunctions: createCompileToFunctionFn(compile)
	    }
		}
 */
const { compile, compileToFunctions } = createCompiler(baseOptions)

/*
		通常情况下，export 输出的变量就是本来的名字，但是可以使用 as 关键字重命名
		例如：
		function v1() { ... }
		function v2() { ... }

		export {
		  v1 as streamV1,
		  v2 as streamV2,
		  v2 as streamLatestVersion
		};
 */
export {
  compile as ssrCompile,
  compileToFunctions as ssrCompileToFunctions
}
