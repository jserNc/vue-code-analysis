/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *

// flow 没有对这个文件进行类型检查是因为对这个文件来说，性能是关键，花销太多来让 flow 理解这个文件不值得
/*
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

import VNode from './vnode'
import config from '../config'
import { SSR_ATTR } from 'shared/constants'
import { registerRef } from './modules/ref'
import { activeInstance } from '../instance/lifecycle'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  makeMap,
  isPrimitive
} from '../util/index'


// 创建空节点 tag -> '', data -> {}, children -> [] 其他参数都是 undefined
export const emptyNode = new VNode('', {}, [])

const hooks = ['create', 'activate', 'update', 'remove', 'destroy']

/*
    该函数判断 a 和 b 是否可以视作“同一棵树”，从而进行一对一的更新
    （注意：a 和 b 肯定不是同一个 VNode 实例，否则干嘛不直接用 a === b 判断）
    
    这里可以看出：【重要】key 值相等是判断两个 vnode 是否“相同”的首要条件

    也就是说，只有 key 值相同的节点才可能 sameVnode (a, b) === true
    进而才可能执行 patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly)
 */
function sameVnode (a, b) {
  return (
    /*
        运算符的优先级： === 高于 && 高于 ||
        这里：a.key === b.key && ((condition1) || (condition2))
        
        ① 两个 vnode 的 key 值必须一样
        ② 以下两个条件必须满足其一：
           a. 普通组件的 tag、isComment、data 状态、inputType 类型等一样
           b. 异步组件占位符的 asyncFactory、asyncFactory.error 状态等一样
     */
    a.key === b.key && (
      (
        a.tag === b.tag &&
        a.isComment === b.isComment &&
        isDef(a.data) === isDef(b.data) &&
        sameInputType(a, b)
      ) || (
        isTrue(a.isAsyncPlaceholder) &&
        a.asyncFactory === b.asyncFactory &&
        isUndef(b.asyncFactory.error)
      )
    )
  )
}

// Some browsers do not support dynamically changing type for <input>
// so they need to be treated as different nodes
/*
    有些浏览器不支持动态改变 <input> 标签的 type 类型。所以它们需要被当做不同的节点。
    下面的方法判断两个 <input> 标签的 type 类型是否一致。
 */
function sameInputType (a, b) {
  // ① 如果第一个参数不是 input 标签，那么直接返回 true
  if (a.tag !== 'input') return true
  let i
  const typeA = isDef(i = a.data) && isDef(i = i.attrs) && i.type
  const typeB = isDef(i = b.data) && isDef(i = i.attrs) && i.type
  // ② 若 a.data.attrs.type === b.data.attrs.type，那么返回 true
  return typeA === typeB
}

/*
  将 children 中每个 children[i] 的 i 和 children[i].key 对应起来
  返回值 map 结构大致为：
  {
    key0 : idx0,
    key1 : idx1,
    key2 : idx2,
    ...
  }
 */
function createKeyToOldIdx (children, beginIdx, endIdx) {
  let i, key
  const map = {}
  for (i = beginIdx; i <= endIdx; ++i) {
    // 若多个元素共用一个 key 值，在遍历 children 过程中，索引靠后的元素会的索引会覆盖前面的
    key = children[i].key
    if (isDef(key)) map[key] = i
  }
  return map
}

/*
    简化一下下面这个长达 600 行的方法：
    export function createPatchFunction (backend) {
        // 初始化 cbs = {...}

        function emptyNodeAt (elm) {...}
        function createRmCb (childElm, listeners) {...}
        function removeNode (el) {...}
        function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {...}
        function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {...}
        function initComponent (vnode, insertedVnodeQueue) {...}
        function reactivateComponent (vnode, insertedVnodeQueue, parentElm, refElm) {...}
        function insert (parent, elm, ref$$1) {...}
        function createChildren (vnode, children, insertedVnodeQueue) {...}
        function isPatchable (vnode) {...}
        function invokeCreateHooks (vnode, insertedVnodeQueue) {...}
        function setScope (vnode) {...}
        function addVnodes (parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {...}
        function invokeDestroyHook (vnode) {...}
        function removeVnodes (parentElm, vnodes, startIdx, endIdx) {...}
        function removeAndInvokeRemoveHook (vnode, rm) {...}
        function updateChildren (parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {...}
        function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {...}
        function invokeInsertHook (vnode, queue, initial) {...}
        function hydrate (elm, vnode, insertedVnodeQueue) {...}
        function assertNodeMatch (node, vnode) {...}

        return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {...}
    }

    再简化一点：
    export function createPatchFunction (backend) {
        // ...
        return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {...}
    }

    实际调用时：
    var patch = createPatchFunction({ nodeOps: nodeOps, modules: modules });
    其中：
    ① nodeOps 对象封装了 dom 操作相关方法
      nodeOps = Object.freeze({
          createElement: createElement$1,
          createElementNS: createElementNS,
          createTextNode: createTextNode,
          createComment: createComment,
          insertBefore: insertBefore,
          removeChild: removeChild,
          appendChild: appendChild,
          parentNode: parentNode,
          nextSibling: nextSibling,
          tagName: tagName,
          setTextContent: setTextContent,
          setAttribute: setAttribute
      });
    ② modules 为属性、指令等相关的生命周期方法
      modules = [
          attrs,
          klass,
          events,
          domProps,
          style,
          transition,
          ref,
          directives
      ]
      更具体点：
      modules = [
        {
            create: updateAttrs,
            update: updateAttrs
        },
        {
            create: updateClass,
            update: updateClass
        },
        {
            create: updateDOMListeners,
            update: updateDOMListeners
        },
        {
            create: updateDOMProps,
            update: updateDOMProps
        },
        {
            create: updateStyle,
            update: updateStyle
        },
        {
            create: _enter,
            activate: _enter,
            remove: function remove$$1 (vnode, rm) {}
        },
        {
            create: function create (_, vnode) {},
            update: function update (oldVnode, vnode) {},
            destroy: function destroy (vnode) {}
        },
        {
            create: updateDirectives,
            update: updateDirectives,
            destroy: function unbindDirectives (vnode) {
              updateDirectives(vnode, emptyNode);
            }
        }
      ]
 */
export function createPatchFunction (backend) {
  let i, j
  const cbs = {}

  const { modules, nodeOps } = backend

  /*
    hooks = ['create', 'activate', 'update', 'remove', 'destroy']
    于是，cbs 结构如下：
    {
        create : [
            updateAttrs(oldVnode, vnode){}
            updateClass(oldVnode, vnode){}
            updateDOMListeners(oldVnode, vnode){}
            updateDOMProps(oldVnode, vnode){}
            updateStyle(oldVnode, vnode){}
            _enter(_, vnode){}
            create(_, vnode){}
            updateDirectives(oldVnode, vnode){}
        ],
        activate : [
            _enter(_, vnode){}
        ],
        update : [
            updateAttrs(oldVnode, vnode){}
            updateClass(oldVnode, vnode){}
            updateDOMListeners(oldVnode, vnode){}
            updateDOMProps(oldVnode, vnode){}
            updateStyle(oldVnode, vnode){}
            update(oldVnode, vnode){}
            updateDirectives(oldVnode, vnode){}
        ],
        remove : [
            remove$$1(vnode, rm){}
        ],
        destroy : [
            destroy(vnode){}
            unbindDirectives(vnode){}
        ]
    }
   */
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }

  /*
      ① nodeOps.tagName(elm) 方法获取 dom 元素 elm 的 tagName 属性（大写字母构成）
      ② emptyNodeAt (elm) 的作用是以 elm 元素创建一个空的 vnode 实例
   */
  function emptyNodeAt (elm) {
    // 第 5 个参数 elm 表示 vnode.elm = elm
    return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
  }

  /* 
      创建 remove listeners 的回调
      ① 执行 createRmCb (childElm, listeners) 返回一个闭包 remove
      ② 执行 remove() -> --remove.listeners
      ③ 若 remove.listeners === 0，执行 removeNode(childElm)

      例如 var rm = createRmCb (childElm, 3)
      那么，执行 3 次 rm 函数才会移除元素 childElm
  */
  function createRmCb (childElm, listeners) {
    function remove () {
      if (--remove.listeners === 0) {
        // 删除子元素 childElm
        removeNode(childElm)
      }
    }
    remove.listeners = listeners
    return remove
  }

  /*
      ① 找到 dom 元素 el 的父元素 parent
      ② 从父元素 parent 中移除元素 el
   */
  function removeNode (el) {
    const parent = nodeOps.parentNode(el)
    // element may have already been removed due to v-html / v-text
    if (isDef(parent)) {
      nodeOps.removeChild(parent, el)
    }
  }

  let inPre = 0

  // 根据 vnode 新的生成 dom 元素
  function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {
    vnode.isRootInsert = !nested // for transition enter check

    /*
        ① 只有 vnode.data && vnode.componentInstance 都存在，才会返回 true
        ② createComponent 函数生成 dom 元素，但是暂时不挂载
     */ 
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }


    // 为什么不直接定义 const { data, children, tag } = vnode
    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag

    // 1. 生成元素
    if (isDef(tag)) {

      if (process.env.NODE_ENV !== 'production') {
        /*
            v-pre 指令表示跳过这个元素和它的子元素的编译过程。可以用来显示原始 Mustache 标签，例如：
            <span v-pre>{{ this will not be compiled }}</span>

            ① processPre (el) 中：
            if (getAndRemoveAttr(el, 'v-pre') != null) {
                el.pre = true;
            }
            ② genData$2(el, state) 中：
            if (el.pre) {
                data += "pre:true,";
            }
         */
        if (data && data.pre) {
          inPre++
        }
        if (
          !inPre &&
          !vnode.ns &&
          !(config.ignoredElements.length && config.ignoredElements.indexOf(tag) > -1) &&
          config.isUnknownElement(tag)
        ) {
          // 警告：未知类型的自定义元素 <tag> - 你有正确注册这个组件吗？对于递归组件，确保提供了 name 选项
          warn(
            'Unknown custom element: <' + tag + '> - did you ' +
            'register the component correctly? For recursive components, ' +
            'make sure to provide the "name" option.',
            vnode.context
          )
        }
      }


      /*
          namespaceMap = {
            svg: 'http://www.w3.org/2000/svg',
            math: 'http://www.w3.org/1998/Math/MathML'
          }

          ① vnode.ns 存在，调用原生 document.createElementNS(namespaceMap[vnode.ns], tag) 方法创建命名空间
          ② 否则，调用原生 document.createElement(tag) 方法创建 dom 元素
       */
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode)

      // 有可能的话将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
      setScope(vnode)


      if (__WEEX__) {
        // in Weex, the default insertion order is parent-first.
        // List items can be optimized to use children-first insertion
        // with append="tree".
        
        /*
            在 Weex 中，默认的插入顺序是，父元素 -> 子元素
            若存在，append="tree"，可以将顺序改为为：子元素 -> 父元素

            下面的代码执行流程是：
            1. appendAsTree === false（默认顺序）
               插入父元素 -> 插入子元素
            2. appendAsTree === true（优化顺序）
               插入子元素 -> 插入父元素
         */
        const appendAsTree = isDef(data) && isTrue(data.appendAsTree)
        if (!appendAsTree) {
          /* 插入父元素 */
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue)
          }
          insert(parentElm, vnode.elm, refElm)
        }

        /* 插入子元素 */
        createChildren(vnode, children, insertedVnodeQueue)

        if (appendAsTree) {
          /* 插入父元素 */
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue)
          }
          insert(parentElm, vnode.elm, refElm)
        }
      /*
          不在 Weex 中，采用的顺序为：插入子元素 -> 插入父元素
          a. 一组子元素插入到 vnode.elm 这个父元素中
          b. vnode.elm 插入到父元素 parentElm 中
       */
      } else {
        // 生成一组子元素，分别插入到 vnode.elm 这个元素中
        createChildren(vnode, children, insertedVnodeQueue)
        if (isDef(data)) {
          /*
            ① 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
            ② 执行 vnode.data.hook.create(emptyNode, vnode)
            ③ 将 vnode 加入队列到 insertedVnodeQueue 中
         */
          invokeCreateHooks(vnode, insertedVnodeQueue)
        }
        // 将 vnode.elm 插入到父元素 parentElm 中（参考节点 refElm 之前）
        insert(parentElm, vnode.elm, refElm)
      }

      if (process.env.NODE_ENV !== 'production' && data && data.pre) {
        inPre--
      }
    // 2. 生成注释
    } else if (isTrue(vnode.isComment)) {
      // 原生方法 document.createComment(vnode.text) 创建注释元素
      vnode.elm = nodeOps.createComment(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    // 3. 生成文本
    } else {
      // 调用原生 document.createTextNode(vnode.text) 方法创建文本元素
      vnode.elm = nodeOps.createTextNode(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    }
  }

  /*
      简单地认为做了 3 件事：
      ① 调用 vnode.data.hook.init() 方法，也就是说若该 vnode 没有对应的组件实例，那就创建一个新的，并渲染，但暂时不挂载
      ② 将 vnode 和 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
      ③ 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
   
      再简单点说，该函数根据 vnode，创建 vnode.componentInstance 组件，并渲染，不挂载。
      
      只有 vnode.data && vnode.componentInstance 都存在，才会返回 true
   */
  function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
      /*
          i = componentVNodeHooks.init，该钩子方法的作用是：
          ① 若该 vnode 没有对应的组件实例，那就创建一个新的，并渲染，但暂时不挂载该组件
          ② vnode 有对应的组件实例，那就更新这个组件
       */
      if (isDef(i = i.hook) && isDef(i = i.init)) {
        /*
            init 函数的第二个参数为 false，执行的是 vnode.componentInstance(undefined,false)
            这意味着只渲染该组件，但是不挂载，例如：

            var component = new MyComponent().$mount()
            document.getElementById('app').appendChild(component.$el)
            $mount() 函数参数为空/undefined，在文档之外渲染，随后再挂载
            
            -> vnode.data.hook.init(vnode, false, parentElm, refElm)
            -> vnode.componentInstance.$mount(undefined, false)

            说明：这里只生成了真实的 dom 元素，但暂时不挂载
         */
        i(vnode, false /* hydrating */, parentElm, refElm)
      }
      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      if (isDef(vnode.componentInstance)) {
        /*
            ① 将 vnode 和 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
            ② 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
         */
        initComponent(vnode, insertedVnodeQueue)
        // 激活 <keep-alive> 内部的组件
        if (isTrue(isReactivated)) {
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
        }
        return true
      }
    }
  }

  /*
      简单地认为做了 3 件事：
      ① 将 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
      ② 将 vnode 加入队列到 insertedVnodeQueue 中
      ③ 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
   */
  function initComponent (vnode, insertedVnodeQueue) {
    /*
        ① 若 vnode.data.pendingInsert 存在（数组，数组元素是 vnode 的每个子实例对应的根 vnode）
        ② 那就将数组 vnode.data.pendingInsert 合并到数组 insertedVnodeQueue 里
        ③ vnode.data.pendingInsert 置为 null（不能直接清空该数组，空数组也是 true）
        
        这样下来，vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
     */
    if (isDef(vnode.data.pendingInsert)) {
      insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
      vnode.data.pendingInsert = null
    }

    /* 
        ① 将 vnode.data.hook.init() 方法生成的 vnode.componentInstance.$el 赋给 vnode.elm ？
        ② vnode.componentInstance.$el 是真实的 dom 元素
    */
    vnode.elm = vnode.componentInstance.$el

    // 1. vnode 是有实在内容的 vnode
    if (isPatchable(vnode)) {
       /*
          ① 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
          ② 执行 vnode.data.hook.create(emptyNode, vnode)
          ③ 将 vnode 加入队列到 insertedVnodeQueue 中
       */
      invokeCreateHooks(vnode, insertedVnodeQueue)
      // 有可能的话将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
      setScope(vnode)
    // 2. 没有实在内容的 vnode，除了 ref，其他的都不要
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      // 添加引用，这样就可以通过 vnode.context.$refs[vnode.data.ref] 找到 vnode.componentInstance 这个组件实例了
      registerRef(vnode)
      // 将 vnode 加入队列到 insertedVnodeQueue 中
      insertedVnodeQueue.push(vnode)
    }
  }

  // 激活 <keep-alive> 内部的组件
  function reactivateComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
   
    /*
        一个内部有 transition 的 reactivated 组件不会触发，因为内部节点的 created 钩子没再触发。
        在这里执行特殊的逻辑并不是很理想的办法，但是貌似也没更好的办法了
     */ 

    let innerNode = vnode

    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode
      // 只要有一个子树有 transition，那就停止循环
      if (isDef(i = innerNode.data) && isDef(i = i.transition)) {
        for (i = 0; i < cbs.activate.length; ++i) {
          cbs.activate[i](emptyNode, innerNode)
        }
        insertedVnodeQueue.push(innerNode)
        break
      }
    }
    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    insert(parentElm, vnode.elm, refElm)
  }

  // 插入 dom 元素 elm
  function insert (parent, elm, ref) {
    if (isDef(parent)) {
      if (isDef(ref)) {
        // ① 存在参考元素 ref，将 elm 插入 ref 之前
        if (ref.parentNode === parent) {
          nodeOps.insertBefore(parent, elm, ref)
        }
      } else {
        // ② 否则，在 parent 末尾插入元素 elm
        nodeOps.appendChild(parent, elm)
      }
    }
  }

  // 生成一组 dom 元素（vnode 节点的子元素）
  function createChildren (vnode, children, insertedVnodeQueue) {
    // ① 子元素是一组节点
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; ++i) {
        /*
            对比一下形参 createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested)
            vnode.elm 对应 parentElm
         */ 
        createElm(children[i], insertedVnodeQueue, vnode.elm, null, true)
      }
    // ② 子元素是文本
    } else if (isPrimitive(vnode.text)) {
      nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(vnode.text))
    }
  }

  // vnode 是否可修补（是否有实实在在的内容），返回布尔值
  function isPatchable (vnode) {
    // 一层一层往下找，找到最深的 vnode 的 tag，只要定义了 tag 说明这个 vnode 是有实在内容的，那就值得修补
    while (vnode.componentInstance) {
      // vm._vnode  保存的是 vm 对应的 vnode，子树的根
      vnode = vnode.componentInstance._vnode
    }
    return isDef(vnode.tag)
  }

  /*
      ① 依次调用 cbs.create[i] 钩子函数来更新 attr、class、listeners 等等
      ② 执行 vnode.data.hook.create(emptyNode, vnode)
      ③ 将 vnode 加入队列到 insertedVnodeQueue 中
   */
  function invokeCreateHooks (vnode, insertedVnodeQueue) {
    for (let i = 0; i < cbs.create.length; ++i) {
      cbs.create[i](emptyNode, vnode)
    }
    /*
      cbs.create : [
          updateAttrs(oldVnode, vnode)
          updateClass(oldVnode, vnode)
          updateDOMListeners(oldVnode, vnode)
          updateDOMProps(oldVnode, vnode)
          updateStyle(oldVnode, vnode)
          _enter(_, vnode)
          create(_, vnode)
          updateDirectives(oldVnode, vnode)
      ]

      vnode.data.hook 即包括 ["init", "prepatch", "insert", "destroy"] 等 4 个钩子方法
      还包括其他自定义的钩子方法，比如 create
     */
    i = vnode.data.hook // Reuse variable
    if (isDef(i)) {
      if (isDef(i.create)) i.create(emptyNode, vnode)
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
    }
  }

  // set scope id attribute for scoped CSS.
  // this is implemented as a special case to avoid the overhead
  // of going through the normal attribute patching process.
  /*
      该函数目的是给元素添加一个特殊的 id，避免 css 样式影响其他模块
      这么做是为了避免正常属性更新过程中的开销
   */
  function setScope (vnode) {
    let i
    let ancestor = vnode

    // ① 遍历祖先实例，有可能的话将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
    while (ancestor) {
      /*
          ① ancestor.context 是父组件实例
          ② ancestor.context.$options._scopeId 属性存在

          只要有一个祖先实例有 i 属性，那就将 vnode.el 的 i 属性值置为空，这里难道不应该 break 吗？
          
          循环下来，就给 vnode.elm 添加了很多值为 '' 的属性，如：
          <div scopeId1 scopeId2 scopeId3>
       */ 
      if (isDef(i = ancestor.context) && isDef(i = i.$options._scopeId)) {
        // 将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
        nodeOps.setAttribute(vnode.elm, i, '')
      }
      ancestor = ancestor.parent
    }

    // for slot content they should also get the scopeId from the host instance.
    // ② 检查当期激活实例，也可能将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
    if (isDef(i = activeInstance) &&
      i !== vnode.context &&
      isDef(i = i.$options._scopeId)
    ) {
      nodeOps.setAttribute(vnode.elm, i, '')
    }
  }

  // 在父元素 parentElm 中添加一组子元素 vnodes（索引范围 startIdx-endIdx）
  function addVnodes (parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(vnodes[startIdx], insertedVnodeQueue, parentElm, refElm)
    }
  }

  // 触发所有的 destroy 钩子函数
  function invokeDestroyHook (vnode) {
    let i, j
    const data = vnode.data
    /*
        ① 执行 vnode.data.hook.destroy(vnode) 钩子函数
        
        ② 遍历以下数组，依次执行每一个钩子方法
        cbs.destroy : [
            destroy(vnode)
            unbindDirectives(vnode)
        ]
    */
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode)
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
    }
    // 若 vnode.children 存在，遍历每一个子 vnode，递归调用 invokeDestroyHook() 方法
    if (isDef(i = vnode.children)) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j])
      }
    }
  }

  // 从父元素 parentElm 中删除一组子元素 vnodes（索引范围 startIdx-endIdx）
  function removeVnodes (parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx]
      if (isDef(ch)) {
        // ① 移除元素
        if (isDef(ch.tag)) {
          removeAndInvokeRemoveHook(ch)
          // 触发所有的 destroy 钩子函数
          invokeDestroyHook(ch)
        // ② 移除文本节点
        } else { // Text node
          removeNode(ch.elm)
        }
      }
    }
  }

  /*
      ① 在 removeVnodes 函数中 removeAndInvokeRemoveHook(ch) 没有参数 rm
      ② 自身递归时，removeAndInvokeRemoveHook(i, rm) 有参数 rm
   */
  function removeAndInvokeRemoveHook (vnode, rm) {
    // 1. rm 或 vnode.data 存在，那就说明说了移除元素，还有钩子函数要执行
    if (isDef(rm) || isDef(vnode.data)) {
      let i
      const listeners = cbs.remove.length + 1

      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners
      } else {
        /*
            例如 var rm = createRmCb (childElm, 3)，每次调用 rm 函数第二个参数减 1
            执行 3 次 rm 函数才会移除元素 childElm

            这个 rm 函数会在 cbs.remove、vnode.data.hook.remove 等钩子函数中触发
         */
        // directly removing
        rm = createRmCb(vnode.elm, listeners)
      }

      // recursively invoke hooks on child component root node
      if (isDef(i = vnode.componentInstance) && isDef(i = i._vnode) && isDef(i.data)) {
        /*
            这里 i = vnode.componentInstance._vnode
            并且 i.data 存在，rm 也存在

            在子组件的根节点上递归调用 removeAndInvokeRemoveHook(i, rm)
            这样 rm.listeners 就不断增加
         */ 
        removeAndInvokeRemoveHook(i, rm)
      }

      // 依次执行 cbs.remove 数组中的钩子，会触发 rm 函数
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm)
      }

      // 执行 vnode.data.hook.remove(vnode, rm) 钩子函数，会触发 rm 函数
      if (isDef(i = vnode.data.hook) && isDef(i = i.remove)) {
        i(vnode, rm)
      } else {
        // 触发 rm 函数
        rm()
      }
    // 2. rm 和 vnode.data 都不存在，那就直接从 dom 中移除元素 vnode.elm
    } else {
      removeNode(vnode.elm)
    }
  }

   /*
      实际调用时：
      oldCh = oldVnode.children
      ch = vnode.children
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
      }
   */
  function updateChildren (parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {
    var oldStartIdx = 0;
    var newStartIdx = 0;

    /* 旧的开始节点和结束节点*/
    var oldEndIdx = oldCh.length - 1;
    var oldStartVnode = oldCh[0];
    var oldEndVnode = oldCh[oldEndIdx];

    /* 新的开始节点和结束节点*/
    var newEndIdx = newCh.length - 1;
    var newStartVnode = newCh[0];
    var newEndVnode = newCh[newEndIdx];

    var oldKeyToIdx, idxInOld, elmToMove, refElm;

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    /*
        removeOnly 是一个只在 <transition-group> 中用的特殊标志。
        以确保被删除的元素在离开 transitions 过程中保持正确的相对位置。

        其他情况下，removeOnly 都是假，canMove 是 true，意思就是可以移动
    */
    var canMove = !removeOnly;

    
    /*
        注意几点：
        1. 循环结束条件为：新旧数组有一个已经遍历完
        2. 循环过程中始终关注的是旧的节点（对其更新，移位）
        3. 每个执行过 patchVnode() 的节点就“丢弃”，不再关注
        4. oldStartVnode、oldEndVnode、newStartVnode、newEndVnode 在循环过程中动态更新，它们的值是下一次循环中的参考值
     */
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {

      // 1.【旧的开始节点】不存在，那么取下一个节点作为开始节点
      // 优先级第 1，这样保证了 oldStartVnode 不是 undefined
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left

      // 2.【旧的结束节点】不存在，那么取前一个节点作为结束节点
      // 优先级第 2，这样保证了 oldEndVnode 也不是 undefined
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx];

      // 3.【旧的开始节点】和【新的开始节点】是同一个节点
      // 优先级第 3，新旧开始节点一样，那就更新这个节点
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        // 更新后，旧的开始节点 -> 新的开始节点，不用移位置
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        // 更新新旧开始节点，并更新新旧开始索引
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];

      // 4.【旧的结束节点】和【新的结束节点】是同一个节点
      // 优先级第 4，新旧结束节点一样，那就更新这个节点
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        // 更新后，旧的结束节点 -> 新的结束节点，不用移位置
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        // 更新新旧结束节点，并更新新旧结束索引
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];

      // 5.【旧的开始节点】和【新的结束节点】是同一个节点
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        // 更新后，旧的开始节点 -> 新的结束节点，那么这个节点应该移到最右边
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        
        /*
            将节点 oldStartVnode.elm 插入到 oldEndVnode.elm 的下一个节点之前
            也就是说，将节点 oldStartVnode.elm 插入到节点 oldEndVnode.elm 之后。

            由于只有 insertBefore 方法，没有 insertAfter 方法，这里相当于实现了 insertAfter 方法，所以这里看起来有点绕
        */
        canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];

      // 6.【旧的结束节点】和【新的开始节点】是同一个节点
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        // 更新后，旧的结束节点 -> 新的开始节点，那么这个节点应该移到最左边
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);

        // 将节点 oldEndVnode.elm 插入到 oldStartVnode.elm 节点之前
        canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];

      // 3-6 是 4 种简单的对应关系，优先处理这些简单对应关系是为了避免查找对应关系，提高了效率
      // 7. 其他，对应关系不明了，需要通过 key 值来确定
      } else {
        /*
            createKeyToOldIdx (children, beginIdx, endIdx)
            将数组 children 中每个 children[i] 的 i 和 children[i].key 对应起来
            返回值 map 结构大致为：
            {
                key0 : idx0,
                key1 : idx1,
                key2 : idx2,
                ...
            }

           【重要】key 值是确定节点对应关系的关键
        */
        if (isUndef(oldKeyToIdx)) { 
            oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx); 
        }

        // 获取新的开始节点在旧的节点数组里对应的索引
        idxInOld = isDef(newStartVnode.key) ? oldKeyToIdx[newStartVnode.key] : null;

        // ① 新的开始节点不存在于旧的节点数组里，也就是说这是全新的元素，那就把这个新的节点插入旧的开始节点之前就好了
        if (isUndef(idxInOld)) { // New element
          createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        // ②【新的开始节点】存在于旧的节点数组里，也就是说新的【新的开始节点】的 key 和某个旧的节点的 key 是相等的
        } else {
          // 待移动节点
          elmToMove = oldCh[idxInOld];

          /*
              elmToMove 找不到了，说明之前有 key 值匹配到这个节点，然后下面将 oldCh[idxInOld] 置为 undefined 了
              所以，若新的节点数组 newCh 里有多个节点的 key 值相同，除了第一个来匹配的以外，后面的都匹配不到了
           */ 
          if ("development" !== 'production' && !elmToMove) {
            // v-for 列表的每一个列表项应该有唯一的 key 值。否则在更新的时候会出现错误。
            warn(
              'It seems there are duplicate keys that is causing an update error. ' +
              'Make sure each v-for item has a unique key.'
            );
          }

          // a. 待移动节点和新的开始节点是同一个节点
          if (sameVnode(elmToMove, newStartVnode)) {
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);

            // 这个节点已经更新过了，那就置空吧
            oldCh[idxInOld] = undefined;

            // 更新后，旧的节点 -> 新的开始节点，那么这个节点应该移到最左边
            canMove && nodeOps.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
            newStartVnode = newCh[++newStartIdx];
          // b. 毕竟 key 值相同只是判断两个节点相同的条件之一，当其他条件不满足时，它们还是不同节点，那就还是当做一个新的节点
          } else {
            // 根据 newStartVnode 创建一个新的 dom 节点，插入到 oldStartVnode.elm 之前
            createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm);
            newStartVnode = newCh[++newStartIdx];
          }
        }
      }
    }

    /*
        看一下 while 循环的条件：
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {...}
        于是，循环结束条件为：新旧数组 oldCh/newCh 其中有一个已经遍历完

        1. oldStartIdx > oldEndIdx 说明旧的数组 oldCh 先遍历完
           那么意味着新的数组 newCh 剩余的都是新元素，那就都插入 dom 中
           新的元素应该插入到哪里呢，这就由参考节点 refElm 来决定了
            
           a. 若 newCh[newEndIdx + 1] 不存在，那就不需要参考元素，直接在 parentElm 最末尾插入就行了
           b. 若 newCh[newEndIdx + 1] 存在，那就以 newCh[newEndIdx + 1].elm 为参考节点，新元素插在其之前（也就是 newCh[newEndIdx].elm 之后）
            
           总之，新元素紧跟在元素 newCh[newEndIdx].elm 后面插入
     */
    if (oldStartIdx > oldEndIdx) {
      /*
          ① refElm 节点的作用，在 insert (parentElm, elm, refElm) 函数中体现：
             a. 若存在参考元素 ref，将 elm 插入 ref 之前；
             b. 否则，在 parent 末尾插入元素 elm 

          ② 再看看 addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue) 函数的作用：
             在父元素 parentElm 中添加一组子元素 newCh（索引范围 newStartIdx ~ newEndIdx）
          
          所以以上 while 循环是为了修正 newStartIdx 和 newEndIdx 的值
       */
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm;
      // 创建 newEndIdx - newStartIdx + 1 个元素
      addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
    /*
        2. newStartIdx > newEndIdx 说明新的数组 newCh 先遍历完
           那么意味着旧的数组 newCh 剩余的都是多余的元素，那就删删删，从 dom 中移除它们
     */
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
    }
  }

  /*
      【重要】执行该方法的前提是 sameVnode(oldVnode, vnode) === true
   */
  function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {
    // 1. oldVnode 和 vnode 是同一个 VNode 实例，完全一样，那就没什么好更新的，直接返回
    if (oldVnode === vnode) {
      return
    }

    // 根元素（真实 dom 元素）
    const elm = vnode.elm = oldVnode.elm

    // 2. 如果 oldVnode 是异步组件占位符，那就检查一下可否替换成真正元素，返回
    if (isTrue(oldVnode.isAsyncPlaceholder)) {
      // ① 异步工厂函数成功得到组件构造函数，那就水化，是的占位符变成真正元素
      if (isDef(vnode.asyncFactory.resolved)) {
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue)
      // ② 否则，继续等着吧
      } else {
        vnode.isAsyncPlaceholder = true
      }
      /*
          这里不管走 if 分支执行 hydrate() 函数，还是走 else 分支
          都会执行 vnode.isAsyncPlaceholder = true 
       */
      return
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    
    // 3. vnode 是 oldVnode 的克隆节点，并且是静态的，复用这棵静态树。返回。
    if (isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      vnode.componentInstance = oldVnode.componentInstance
      return
    }

    // 4. 其他情况，更新这棵树
    let i
    const data = vnode.data
    // ① 执行钩子函数 vnode.data.hook.prepatch(oldVnode,vnode)
    if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
      /*
          vnode.data.hook.prepatch(oldVnode,vnode) 的作用是更新组件：
          首先，从 oldVnode 中获取对应的组件实例 child
          然后，对实例 child 的 props、listeners、parent vnode、children 等进行更新
       */
      i(oldVnode, vnode)
    }

    const oldCh = oldVnode.children
    const ch = vnode.children

    // ② 依次执行 cb.update 钩子函数，执行 vnode.data.hook.update(oldVnode, vnode) 钩子函数
    if (isDef(data) && isPatchable(vnode)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
      if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
    }

    // ③ 更新子元素
    // ③-1 子元素是元素节点，更新/添加/删除元素
    if (isUndef(vnode.text)) {
      // a. 新树和旧树都有子元素，更新子元素（递归）
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
      // b. 旧树没有子元素，添加新的子元素
      } else if (isDef(ch)) {
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
      // c. 新树没有子元素，删除旧的子元素
      } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1)
      // d. 新树旧树都没有子元素
      } else if (isDef(oldVnode.text)) {
        // 若旧树有文本，文本清空
        nodeOps.setTextContent(elm, '')
      }
    // ③-2 子元素是文本，更新文本
    } else if (oldVnode.text !== vnode.text) {
      nodeOps.setTextContent(elm, vnode.text)
    }

    // ④ 执行钩子函数 vnode.data.hooke.postpatch(oldVnode, vnode)
    /*
        一个指令对象可包括以下几个钩子函数，例如：
        dir.def ：{
            bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
            inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
            update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
            componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
            unbind：只调用一次，指令与元素解绑时调用。
        }

        执行 vnode.data.hooke.postpatch(oldVnode, vnode)
        -> 即依次执行各个指令的 componentUpdated 钩子函数
     */
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
    }
  }

  function invokeInsertHook (vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the element is really inserted
    // ① 初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue
    // ② 非初次渲染，可以直接执行 insert 钩子函数了
    } else {
      /*
          ① 参数 queue 就是数组 insertedVnodeQueue，每一个 queue[i] 就是一个组件的根节点
          ② 执行每个 insert 钩子函数（标记每个组件实例的 _isMounted、_directInactive 等状态）
          
          insert 钩子函数可不只是更新 _isMounted、_directInactive 等状态
         
          一个指令对象可包括以下几个钩子函数，例如：
          dir.def ：{
              bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
              inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
              update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
              componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
              unbind：只调用一次，指令与元素解绑时调用。
          }
          所以当 vnode.data.hook.insert 钩子执行时，还会依次触发所有指令的 inserted 钩子函数
       */
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i])
      }
    }
  }

  let bailed = false

  // list of modules that can skip create hook during hydration because they
  // are already rendered on the client or has no need for initialization
  // 以下模块在“注水”过程中可以跳过，不执行其 create 钩子函数。因为它们在客户端已经渲染，或者根本没有初始化的必要。
  const isRenderedModule = makeMap('attrs,style,class,staticClass,staticStyle,key')

  /*
    说一下 hydrate 这个概念。其字面意思是“水合物，注水”。

    服务器端渲染时，服务器输出的是字符串，而浏览器端需要根据这些字符串完成初始化工作，
    比如创建组件实例，这样才能响应用户操作。这个过程就叫 hydrate，有时候也会说 re-hydrate

    可以把 hydrate 理解成给干瘪的字符串“注水”。一个完整的网页可以看成是干货掺了水的结果，纯数据只是干巴巴的干货，不是给人看的，
    但是“注水”之后，变成可以展示的 html，就变成浏览器可以解释用户能看的东西了，这过程就是 hydrate。
  */

  // Note: this is a browser-only function so we can assume elms are DOM nodes.
  // 这个函数只是在浏览器上执行，所以 elm 我们可以认为就是 dom 节点
  function hydrate (elm, vnode, insertedVnodeQueue) {
    /*
        看函数 
        function isAsyncPlaceholder (node) {
          return node.isComment && node.asyncFactory
        }
        可见，vnode.isComment 和 vnode.asyncFactory 需同时满足才能判定为异步组件占位符
     */
    // 1. 异步组件，就此返回 true，也算是“注水”成功
    if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
      vnode.elm = elm
      vnode.isAsyncPlaceholder = true
      return true
    }

    // 2. elm 和 vnode 类型不匹配，返回 false，“注水”失败
    if (process.env.NODE_ENV !== 'production') {
      if (!assertNodeMatch(elm, vnode)) {
        return false
      }
    }


    // 把 vnode 和 elm 元素绑定起来
    vnode.elm = elm

    const { tag, data, children } = vnode


    // 执行 vnode.data.hook.init(vnode,true) 生成组件实例，并渲染挂载
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.init)) i(vnode, true /* hydrating */)
      
      // 3. 如果组件实例 vnode.componentInstance 存在，在此返回 true，“注水”成功
      if (isDef(i = vnode.componentInstance)) {
        // child component. it should have hydrated its own tree.
        /*
            ① 将 vnode 和 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
            ② 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
         */
        initComponent(vnode, insertedVnodeQueue)
        return true
      }
    }

    // ① vnode.tag 存在，目标是元素节点
    if (isDef(tag)) {
      if (isDef(children)) {
        // empty element, allow client to pick up and populate children
        // a. elm 元素没有子元素，那就添加子元素
        if (!elm.hasChildNodes()) {
          createChildren(vnode, children, insertedVnodeQueue)
        // b. elm 有子元素
        } else {
          let childrenMatch = true

          let childNode = elm.firstChild

          // 只要有一个子元素“注水”失败，那就标记 childrenMatch 为 false
          for (let i = 0; i < children.length; i++) {
            if (!childNode || !hydrate(childNode, children[i], insertedVnodeQueue)) {
              childrenMatch = false
              break
            }
            childNode = childNode.nextSibling
          }


          // if childNode is not null, it means the actual childNodes list is
          // longer than the virtual children list.
          /*
              走到这里，childNode 还存在，那说明真实的 childNodes 列表比虚拟的 children 列表长
              也就是说，elm.children 的长度大于 vnode.children 的长度
           */
          // 4. 至少有一个子元素“注水”失败，或者实际子元素的个数大于虚拟节点个数，这里返回，“注水”失败
          if (!childrenMatch || childNode) {
            // 将 bailed 标记为 true（保释？）
            if (process.env.NODE_ENV !== 'production' &&
              typeof console !== 'undefined' &&
              !bailed
            ) {
              bailed = true
              console.warn('Parent: ', elm)
              console.warn('Mismatching childNodes vs. VNodes: ', elm.childNodes, children)
            }
            return false
          }
        }
      }

      if (isDef(data)) {
        for (const key in data) {
          /*
                以下模块在“注水”过程中可以跳过，不执行其 create 钩子函数。因为它们在客户端已经渲染，或者根本没有初始化的必要。
                isRenderedModule = makeMap('attrs,style,class,staticClass,staticStyle,key')
           
                也就是说，只要有一个 key 不是 'attrs,style,class,staticClass,staticStyle,key'
                那就执行 invokeCreateHooks(vnode, insertedVnodeQueue)
           */
          if (!isRenderedModule(key)) {
            /*
                ① 依次调用 cbs.create[i] 钩子函数来更新 attr、class、listeners 等等
                ② 执行 vnode.data.hook.create(emptyNode, vnode)
                ③ 将 vnode 加入队列到 insertedVnodeQueue 中
             */
            invokeCreateHooks(vnode, insertedVnodeQueue)
            break
          }
        }
      }
    // ② 否则，目标是文本节点
    } else if (elm.data !== vnode.text) {
      // 修改文本元素的 data 属性就是修改该文本
      elm.data = vnode.text
    }

    // 5. 走到这里了，“注水”成功
    return true
  }

  // node 和 vnode 类型是否匹配，只有匹配上了，才可能用 vnode 对元素 node 进行“注水“
  function assertNodeMatch (node, vnode) {
    if (isDef(vnode.tag)) {
      /*
          createComponent 函数创建的一般组件的 tag 为：
          "vue-component-" + (Ctor.cid) + (name ? ("-" + name) : '')

          ① vnode.tag 是以 'vue-component' 开头
          ② vnode.tag 和 node.tagName 是同一个标签名
       */
      return (
        vnode.tag.indexOf('vue-component') === 0 ||
        vnode.tag.toLowerCase() === (node.tagName && node.tagName.toLowerCase())
      )
    } else {
      /*
          ① node.nodeType === 3 为 Text 类型，代表元素或属性中的文本内容
          ② node.nodeType === 8 为 Comment 类型，代表注释
       */
      return node.nodeType === (vnode.isComment ? 8 : 3)
    }
  }

  // createPatchFunction 函数最终返回的就是这个打补丁函数
  /*
      其中：
      ① oldVnode 可能是 VNode 实例，也可能是 dom 元素
      ② vnode 为新的 VNode 实例
      ③ hydrating 为 true 才执行 hydrate(oldVnode, vnode, insertedVnodeQueue) 函数“注水”，这里的 oldVnode 就是 dom 元素
      ④ removeOnly 该参数只用于 <transition-group> 中，用来确保被移除的元素在 leaving transitions 中保持相对正确的位置
      ⑤ parentElm 为 dom 元素，它将作为虚拟 vnode 生成的 dom 元素的父元素
      ⑥ refElm 作为 vnode 生成的 dom 元素插入父元素 parentElm 时的参考节点（插入 refElm 元素之前）
   */
  return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    // 1. 如果 vnode 不存在，直接在这里返回（如果 oldVnode 存在，那就销毁 oldVnode 吧）
    if (isUndef(vnode)) {
      // 触发所有的 destroy 钩子函数
      if (isDef(oldVnode)) { invokeDestroyHook(oldVnode); }
      return
    }

    var isInitialPatch = false;
    var insertedVnodeQueue = [];

    // 2. oldVnode 不存在，说明新的节点，那就创建新的节点（初始化）
    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      isInitialPatch = true;
      // 根据 vnode 生成新的 dom 元素
      createElm(vnode, insertedVnodeQueue, parentElm, refElm);
    // 3. vnode、oldVnode 都存在，那就打补丁吧（更新）
    } else {
      /*
          如果 oldVnode.nodeType 存在，那就说明它是真实 dom 节点
          也就是说这里的参数 oldVnode 是真实的 dom 元素，而不是 VNode 实例
       */
      var isRealElement = isDef(oldVnode.nodeType);
                                   
      /*
          sameVnode(oldVnode, vnode)
          判断 oldVnode 和 vnode 是否可以视作“同一棵树”，从而进行一对一的更新

          注意一下 sameVnode(oldVnode, vnode) 和 patchVnode() 方法
          它们俩一直是成对出现，由此可以看出：
          patchVnode() 方法执行的前提是 sameVnode(oldVnode, vnode) 为 true
       */
       // ① 如果不是真实节点，并且 sameVnode(oldVnode, vnode) 为 true
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node，打补丁，进行 update 操作
        patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly);
      // ② 其他
      } else {
        // ②-1【重要】oldVnode 是真实的 dom 元素，"注水"后返回
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          /*
            SSR_ATTR = 'data-server-rendered'，ssr 应该是 server side render 的简称
            这里强制将 hydrating 置为 true
          */
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR);
            hydrating = true;
          }

          // 需要“注水”
          if (isTrue(hydrating)) {
            // a. “注水”成功
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              // 第三个参数 isInitialPatch 为 true 表示初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
              invokeInsertHook(vnode, insertedVnodeQueue, true);
              return oldVnode
            // b. “注水”失败，发出警告
            } else {
              /*
                客户端渲染的虚拟 dom 树和服务端渲染的不匹配。这很有可能是不正确的 html 标记引起的。
                比如：在 p 标签里有块级元素，少写了 tbody 标签等。
              */
              warn(
                'The client-side rendered virtual DOM tree is not matching ' +
                'server-rendered content. This is likely caused by incorrect ' +
                'HTML markup, for example nesting block-level elements inside ' +
                '<p>, or missing <tbody>. Bailing hydration and performing ' +
                'full client-side render.'
              );
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it

          // 不在服务端渲染或“注水”失败，那就以 elm 元素创建一个空的 vnode 实例
          oldVnode = emptyNodeAt(oldVnode);
        }

        // replacing existing element
        var oldElm = oldVnode.elm;
        var parentElm$1 = nodeOps.parentNode(oldElm);

        // ②-2 重新生成 dom 元素，替换原来的元素 oldVnode.elm
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          /*
              ① oldElm._leaveCb 为 true，表示动画离开
                 那么父元素为 null，不会插入到文档中（insert 函数中规定插入的条件是父元素必须存在）
              ② 否则，父元素还是原来的 nodeOps.parentNode(oldElm)
           */
          oldElm._leaveCb ? null : parentElm$1,
          // 参考节点就是其后的兄弟节点，也就是说新生成的节点会插入到参考节点之前
          nodeOps.nextSibling(oldElm)
        );

        // vnode.parent 应该是父占位符
        if (isDef(vnode.parent)) {
          // component root element replaced.
          // update parent placeholder node element, recursively
          var ancestor = vnode.parent;
          // 每个祖先占位节点 ancestor.elm 属性都指向 vnode.elm
          while (ancestor) {
            ancestor.elm = vnode.elm;
            ancestor = ancestor.parent;
          }
          // 可修补
          if (isPatchable(vnode)) {
            /*
                cbs.create : [
                    updateAttrs(oldVnode, vnode)
                    updateClass(oldVnode, vnode)
                    updateDOMListeners(oldVnode, vnode)
                    updateDOMProps(oldVnode, vnode)
                    updateStyle(oldVnode, vnode)
                    _enter(_, vnode)
                    create(_, vnode)
                    updateDirectives(oldVnode, vnode)
                ]
            */
            for (var i = 0; i < cbs.create.length; ++i) {
              cbs.create[i](emptyNode, vnode.parent);
            }
          }
        }
        
        // 父元素存在
        if (isDef(parentElm$1)) {
          /*
              例如，dom 结构为：
              <body>
                <div id="app">
                  {{message}}
                </div>
                <div id="app">
                  Hello Vue!
                </div>
              </body>
              所以，我们需要移除模板：
              <div id="app">
                {{message}}
              </div>
              这样只是一个形象表述，事实并不是这样的
          */
          // 移除旧的元素
          removeVnodes(parentElm$1, [oldVnode], 0, 0);
        // 父元素不存在，那就调用销毁钩子
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode);
        }
      }
    }
    
    /*
        ① isInitialPatch 为 true 表示初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
        ② isInitialPatch 为 false 表示非初次渲染，可以直接执行 insert 钩子函数了
     */
    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);
    // 最终返回生成的新的 dom 元素 
    return vnode.elm
  }
}
