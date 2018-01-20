import directives from './directives'
import ref from './ref'

/*
	// 对子组件实例的引用
	var ref = {
	  // 添加引用 ref
	  create: function create (_, vnode) {
	    registerRef(vnode);
	  },
	  // 更新引用 ref
	  update: function update (oldVnode, vnode) {
	    // oldVnode 和 vnode 的 ref 不一样，则删除旧的，添加新的
	    if (oldVnode.data.ref !== vnode.data.ref) {
	      registerRef(oldVnode, true);
	      registerRef(vnode);
	    }
	  },
	  // 删除引用 ref
	  destroy: function destroy (vnode) {
	    registerRef(vnode, true);
	  }
	};

	// 指令
	var directives = {
	  create: updateDirectives,
	  update: updateDirectives,
	  destroy: function unbindDirectives (vnode) {
	    updateDirectives(vnode, emptyNode);
	  }
	};
 */
export default [
  ref,
  directives
]
