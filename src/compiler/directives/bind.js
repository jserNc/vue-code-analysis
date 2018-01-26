/* @flow */

export default function bind (el: ASTElement, dir: ASTDirective) {
	/*
    转成 es5 语法来看：
	  el.wrapData = function (code) {
	    return ("_b(" + code + ",'" + (el.tag) + "'," + (dir.value) + "," + (dir.modifiers && dir.modifiers.prop ? 'true' : 'false') + (dir.modifiers && dir.modifiers.sync ? ',true' : '') + ")")
	  };

    Vue.prototype._b = bindObjectProps;
    该函数作用是将 v-bind="object" 转换成 VNode 的 data，简单的说：
    v-bind 指令的值 object 对象就是参数 value，根据这个 value 对象的值对 data 对象进行修正，最后返回 data 对象  		
 */
  el.wrapData = (code: string) => {
    return `_b(${code},'${el.tag}',${dir.value},${
      dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
    }${
      dir.modifiers && dir.modifiers.sync ? ',true' : ''
    })`
  }
}
