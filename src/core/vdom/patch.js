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
  */
  function createRmCb (childElm, listeners) {
    function remove () {
      if (--remove.listeners === 0) {
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
        // 将 vnode.elm 插入到父元素 parentElm 中
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
        // 重新激活 vnode 这棵树
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

  function reactivateComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    let innerNode = vnode
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode
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
      单独为 scoped CSS 设置 scope id 属性。
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

  function removeAndInvokeRemoveHook (vnode, rm) {
    if (isDef(rm) || isDef(vnode.data)) {
      let i
      const listeners = cbs.remove.length + 1
      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners
      } else {
        // directly removing
        rm = createRmCb(vnode.elm, listeners)
      }
      // recursively invoke hooks on child component root node
      if (isDef(i = vnode.componentInstance) && isDef(i = i._vnode) && isDef(i.data)) {
        removeAndInvokeRemoveHook(i, rm)
      }
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm)
      }
      if (isDef(i = vnode.data.hook) && isDef(i = i.remove)) {
        i(vnode, rm)
      } else {
        rm()
      }
    } else {
      removeNode(vnode.elm)
    }
  }

  function updateChildren (parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {
    let oldStartIdx = 0
    let newStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]
    let oldKeyToIdx, idxInOld, elmToMove, refElm

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    const canMove = !removeOnly

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx]
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue)
        oldStartVnode = oldCh[++oldStartIdx]
        newStartVnode = newCh[++newStartIdx]
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue)
        oldEndVnode = oldCh[--oldEndIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue)
        canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm))
        oldStartVnode = oldCh[++oldStartIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue)
        canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
        oldEndVnode = oldCh[--oldEndIdx]
        newStartVnode = newCh[++newStartIdx]
      } else {
        if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
        idxInOld = isDef(newStartVnode.key) ? oldKeyToIdx[newStartVnode.key] : null
        if (isUndef(idxInOld)) { // New element
          createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
          newStartVnode = newCh[++newStartIdx]
        } else {
          elmToMove = oldCh[idxInOld]
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !elmToMove) {
            warn(
              'It seems there are duplicate keys that is causing an update error. ' +
              'Make sure each v-for item has a unique key.'
            )
          }
          if (sameVnode(elmToMove, newStartVnode)) {
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue)
            oldCh[idxInOld] = undefined
            canMove && nodeOps.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm)
            newStartVnode = newCh[++newStartIdx]
          } else {
            // same key but different element. treat as new element
            createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
            newStartVnode = newCh[++newStartIdx]
          }
        }
      }
    }
    if (oldStartIdx > oldEndIdx) {
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
      addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
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
      // a. 新树和旧树都有子元素，更新子元素
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

  return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    if (isUndef(vnode)) {
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
      return
    }

    let isInitialPatch = false
    const insertedVnodeQueue = []

    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      isInitialPatch = true
      createElm(vnode, insertedVnodeQueue, parentElm, refElm)
    } else {
      const isRealElement = isDef(oldVnode.nodeType)
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node
        patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly)
      } else {
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR)
            hydrating = true
          }
          if (isTrue(hydrating)) {
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              // 第三个参数 isInitialPatch 为 true 表示初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
              invokeInsertHook(vnode, insertedVnodeQueue, true)
              return oldVnode
            } else if (process.env.NODE_ENV !== 'production') {
              warn(
                'The client-side rendered virtual DOM tree is not matching ' +
                'server-rendered content. This is likely caused by incorrect ' +
                'HTML markup, for example nesting block-level elements inside ' +
                '<p>, or missing <tbody>. Bailing hydration and performing ' +
                'full client-side render.'
              )
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it
          oldVnode = emptyNodeAt(oldVnode)
        }
        // replacing existing element
        const oldElm = oldVnode.elm
        const parentElm = nodeOps.parentNode(oldElm)
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        )

        if (isDef(vnode.parent)) {
          // component root element replaced.
          // update parent placeholder node element, recursively
          let ancestor = vnode.parent
          while (ancestor) {
            ancestor.elm = vnode.elm
            ancestor = ancestor.parent
          }
          if (isPatchable(vnode)) {
            for (let i = 0; i < cbs.create.length; ++i) {
              cbs.create[i](emptyNode, vnode.parent)
            }
          }
        }

        if (isDef(parentElm)) {
          removeVnodes(parentElm, [oldVnode], 0, 0)
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode)
        }
      }
    }

    /*
        ① isInitialPatch 为 true 表示初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
        ② isInitialPatch 为 false 表示非初次渲染，可以直接执行 insert 钩子函数了
     */
    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
    return vnode.elm
  }
}
