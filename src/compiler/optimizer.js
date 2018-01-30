/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

/*
    genStaticKeysCached 可以简单的当做 genStaticKeys 函数
    只不过，genStaticKeysCached 会缓存执行结果

    例如 
    第一次执行 genStaticKeys('abc') 经计算，返回 makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs,abc')
    第二次执行 genStaticKeys('abc') 经计算，返回 makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs,abc')
    
    第一次执行 genStaticKeysCached('abc') 经计算，返回 makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs,abc')
    第二次执行 genStaticKeysCached('abc') 直接取缓存，返回 makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs,abc')
 */
const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */

/*
    AST - Abstract syntax tree，抽象语法树

    优化器的目标：遍历模板的 AST 树，并检测出纯静态的子树（也就是从来不需要改变的 dom 块）

    一旦检测到了纯静态的子树，做如下处理：
    1. 把它们提升到常量里。这样我们就不必为每一个 re-render 创建一批新的节点了。
    2. 在打补丁的过程中跳过它们

    该函数其实就是给 root 添加 root.static、root.staticInFor、root.staticRoot 等属性，属性值为 true | false
 */
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  /*
      isStaticKey 相当于：
      isStaticKey = function(){
          // 这些属性都是静态属性
          return makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs' + "mod11,mod12,mod21,mod22,mod31,mod32")
      }
   */
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  
  // first pass: mark all non-static nodes.
  // ① 标记所有的非静态节点
  markStatic(root)

  // second pass: mark static roots.
  // ② 标记静态根节点
  markStaticRoots(root, false)
}

/*
    makeMap() 会返回一个函数，如：
    makeMap('aaa,bbb,ccc',true)('aaa') -> true

    genStaticKeys('abc') -> makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs,abc')
    genStaticKeys('abc')('abc') -> true
    genStaticKeys('abc')('type') -> true
*/
function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
    (keys ? ',' + keys : '')
  )
}

// 标记 node.static 属性，并遍历其子节点
function markStatic (node: ASTNode) {
  /*
       添加 node.stati 属性，标记是否为静态节点
       当一个节点被标记为静态节点，之后的虚拟 DOM 在通过 diff 算法比较差异时会跳过该节点以提升效率，这就是 AST 的优化。
   */
  node.static = isStatic(node)


  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    
    /*
        理解一下这里的判断条件，3 个条件同时满足就 return
        也就是说，只要有 1 个条件不满足就往下走
        ① isPlatformReservedTag(node.tag) 为 true，往下走
        ② node.tag === 'slot，往下走
        ③ node.attrsMap['inline-template'] != null，往下走
     */
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }

    // 遍历 node 的所有子节点
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      // 只要有一个子元素不是静态的，那么 node.static 置为 false 
      if (!child.static) {
        node.static = false
      }
    }

    // 遍历 node.ifConditions
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        // 只要有一个 block 不是静态的，那么 node.static 置为 false 
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

// 标记 node.staticInFor、node.staticRoot 等属性
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  // 前提条件是 node 是元素
  if (node.type === 1) {
    if (node.static || node.once) {
      // 1. 添加 node.staticInFor 属性
      node.staticInFor = isInFor
    }

    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    
    // 2. 添加 node.staticRoot 属性
    /*
        静态节点 && 有子元素 && 不是只有一个纯文本子元素
        -> node.staticRoot = true

        作为静态节点，必须保证有子节点并且不为纯文本。如果只是纯文本，那么重新渲染的成本更小。
     */
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }

    // 递归标记子元素
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }

    // 递归标记 if block 块
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

// 判断节点 node 是否为静态节点，返回布尔值
function isStatic (node: ASTNode): boolean {
  // 1. 表达式 -> 非静态
  if (node.type === 2) { // expression
    return false
  }

  // 2. 文本 -> 静态
  if (node.type === 3) { // text
    return true
  }

  // 3. 元素
  /*
      ① node.pre -> 静态
      ② 以下条件同时满足才为静态
        a. 没有动态的 v-bind
        b. 没有 v-if/v-for/v-else
        c. 不是 built-in 标签
        d. 不是组件
        e. 不是 template 标签（并且有 v-for 属性）的直接子元素
        f. node 的每一个属性都是静态的
   */
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}

// node 为 template 标签（并且有 v-for 属性）的直接子元素才返回 true
function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    // ① node.tag 不是 'template'，直接返回 false
    if (node.tag !== 'template') {
      return false
    }

    // ② node.tag === 'template' && node.for，返回 true
    if (node.for) {
      return true
    }
  }

  // ③ 以上都不满足，默认返回 false
  return false
}
