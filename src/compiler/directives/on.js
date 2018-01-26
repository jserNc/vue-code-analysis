/* @flow */

import { warn } from 'core/util/index'

export default function on (el: ASTElement, dir: ASTDirective) {
	// v-on 使用修饰符时必须带有参数
  if (process.env.NODE_ENV !== 'production' && dir.modifiers) {
    warn(`v-on without argument does not support modifiers.`)
  }
  /*
 		转成 es5 语法来看：
 		el.wrapListeners = function (code) { return ("_g(" + code + "," + (dir.value) + ")"); };
 		
 		Vue.prototype._g = bindObjectListeners;
    该函数作用是将 v-on="object" 转换成 VNode 的 data，简单的说：
    v-on 指令的值 object 对象就是参数 value，然后根据 value 对象的值对 data.on 进行修正，最后返回 data 对象
 */
  el.wrapListeners = (code: string) => `_g(${code},${dir.value})`
}
