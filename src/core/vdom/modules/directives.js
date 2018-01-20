/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

// 指令声明周期：create -> update -> destroy
export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode)
  }
}

// 更新指令
function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // 旧的 vnode 或新的 vnode 有指令就进行更新。也就是说，如果都没指令就不更新了
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

// 更新指令
function _update (oldVnode, vnode) {
  // ① 旧节点是空节点，那就是创建新的
  const isCreate = oldVnode === emptyNode
  // ② 新节点是空节点，那就是销毁旧的
  const isDestroy = vnode === emptyNode

  // 将数组 oldVnode.data.directives 转为对象 oldDirs
  const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

  // 包含有 inserted 钩子的所有指令
  const dirsWithInsert = []
  // 包含有 componentUpdated 钩子的所有指令
  const dirsWithPostpatch = []

  /*
      一个指令对象可包括以下几个钩子函数，例如：
      dir.def ：{
          bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
          inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
          update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
          componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
          unbind：只调用一次，指令与元素解绑时调用。
      }
  */
  let key, oldDir, dir
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    // ① 新的指令
    if (!oldDir) {
      // 新的指令第一次绑定到元素时，调用 bind 钩子函数
      callHook(dir, 'bind', vnode, oldVnode)
      // 若指令有 inserted 钩子函数，那就将该指令存在数组 dirsWithInsert 里
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir)
      }
    // ② 有对应的旧指令
    } else {
      // existing directive, update
      dir.oldValue = oldDir.value
      // 更新指令，调用 update 钩子
      callHook(dir, 'update', vnode, oldVnode)
      // 若指令有 componentUpdated 钩子函数，那就将该指令存在数组 dirsWithPostpatch 里
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir)
      }
    }
  }

  // 遍历所有 inserted 钩子函数的指令
  if (dirsWithInsert.length) {
    // 调用所有的 inserted 钩子函数
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    // ① 节点是新创的，将指令 inserted 钩子合并到组件的 insert 钩子中
    if (isCreate) {
      /*
          mergeVNodeHook (def, hookKey, hook) 的作用：
          将钩子方法 hook 加入到 def[hookKey] 中，也就是添加一个钩子方法，以后执行 def[hookKey] 也就会执行 hook 方法了
       
          下面这句的作用是将 callInsert 函数合并到整个组件的的 insert 钩子函数中
          从这里也可以看到指令的 inserted 钩子函数是在组件 insert 时触发（插入到父元素时触发）
       */
      mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'insert', callInsert)
    // ② 节点已存在，说明已经合并过了，那就直接执行 inserted 钩子就好
    } else {
      callInsert()
    }
  }

  // 遍历所有 componentUpdated 钩子函数的指令
  if (dirsWithPostpatch.length) {
    // 将各个组件的 componentUpdated 钩子函数合并到组件的 postpatch 钩子函数中
    mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  // 不是新创建的 vnode 才执行
  if (!isCreate) {
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // 不需要的旧指令解绑，调用 unbind 钩子函数
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

/*
      看看 VNodeDirective 类型的定义：
       declare type VNodeDirective = {
        name: string;
        rawName: string;
        value?: any;
        oldValue?: any;
        arg?: string;
        modifiers?: ASTModifiers;
        def?: Object;
      };

      参数 dirs 的结构如下：
      [
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
      ]

      返回值为对 dirs 修正后的对象 res，结构为：
      {
        dirName1 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        dirName2 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
      }
*/
function normalizeDirectives (
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)

  // ① 若 dirs 不存在，直接返回空对象
  if (!dirs) {
    return res
  }

  let i, dir
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    // 若没有 dir.modifiers，就其修改为空对象 {}
    if (!dir.modifiers) {
      // emptyModifiers = {}
      dir.modifiers = emptyModifiers
    }
    // 以指令的原名为键名，dir 对象为键值，存进 res 对象
    res[getRawDirName(dir)] = dir
    /*
      一个指令对象可包括以下几个钩子函数，例如：
      dir.def ：{
          bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
          inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
          update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
          componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
          unbind：只调用一次，指令与元素解绑时调用。
      }
     */
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
  }

  /*
      res 结构如下：
      {
        dirName1 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        dirName2 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
      }
   */
  // ② 对每个 dir 的属性进行修正，然后存进 res 对象
  return res
}

// 获取原指令名
function getRawDirName (dir: VNodeDirective): string {
  /*
    ① dir.rawName 存在，那就直接返回 dir.rawName
    ② 否则，返回 dir.name 和 dir.modifiers 对象的键值用 '.' 拼起来的字符串
       
    例如：<div id="hook-arguments-example" v-demo:foo.a.b="message"></div>
    返回值为 rawName = "v-demo:foo.a.b"
  */
  // return dir.rawName || ((dir.name) + "." + (Object.keys(dir.modifiers || {}).join('.')))
  return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

/*
  执行钩子函数
  例如：dir.def = { bind: definition, update: definition }
 */
function callHook (dir, hook, vnode, oldVnode, isDestroy) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    /*
      钩子函数参数分别如下：
      vnode.elm：指令所绑定的元素，可以用来直接操作 DOM 。
      dir：一个对象，包含以下属性：
          name：指令名，不包括 v- 前缀。
          value：指令的绑定值，例如：v-my-directive="1 + 1" 中，绑定值为 2。
          oldValue：指令绑定的前一个值，仅在 update 和 componentUpdated 钩子中可用。无论值是否改变都可用。
          expression：字符串形式的指令表达式。例如 v-my-directive="1 + 1" 中，表达式为 "1 + 1"。
          arg：传给指令的参数，可选。例如 v-my-directive:foo 中，参数为 "foo"。
          modifiers：一个包含修饰符的对象。例如：v-my-directive.foo.bar 中，修饰符对象为 { foo: true, bar: true }。
      vnode：Vue 编译生成的虚拟节点。
      oldVnode：上一个虚拟节点，仅在 update 和 componentUpdated 钩子中可用。
     */
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
