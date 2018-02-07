/* @flow */

/*
    namespaceMap = {
      svg: 'http://www.w3.org/2000/svg',
      math: 'http://www.w3.org/1998/Math/MathML'
    }
 */
import { namespaceMap } from 'web/util/index'

// 根据标签名新建 dom 元素
export function createElement (tagName: string, vnode: VNode): Element {
  const elm = document.createElement(tagName)
  // ① 只要不是 select 元素，创建好了直接返回这个元素
  if (tagName !== 'select') {
    return elm
  }

  // false or null will remove the attribute but undefined will not
  // ② select 元素。当 vnode.data.attrs.multiple 不为 undefined 时，给 select 元素加上 multiple 属性
  if (vnode.data && vnode.data.attrs && vnode.data.attrs.multiple !== undefined) {
    elm.setAttribute('multiple', 'multiple')
  }
  return elm
}

// 创建一个具有指定的命名空间URI和限定名称的元素
export function createElementNS (namespace: string, tagName: string): Element {
  /*
      namespaceMap = {
        svg: 'http://www.w3.org/2000/svg',
        math: 'http://www.w3.org/1998/Math/MathML'
      }

      createElementNS() 方法与 createElement() 方法相似，
      只是它创建的 Element 节点除了具有指定的名称外，还具有指定的命名空间。只有使用命名空间的 XML 文档才会使用该方法。
   */
  return document.createElementNS(namespaceMap[namespace], tagName)
}

// 创建文本节点
export function createTextNode (text: string): Text {
  return document.createTextNode(text)
}

// 创建注释节点
export function createComment (text: string): Comment {
  return document.createComment(text)
}

// 在参考节点 referenceNode 之前插入节点 newNode
export function insertBefore (parentNode: Node, newNode: Node, referenceNode: Node) {
  parentNode.insertBefore(newNode, referenceNode)
}

// 移除节点
export function removeChild (node: Node, child: Node) {
  node.removeChild(child)
}

// 在父节点末尾添加子节点
export function appendChild (node: Node, child: Node) {
  node.appendChild(child)
}

// 返回父节点
export function parentNode (node: Node): ?Node {
  return node.parentNode
}

// 返回下一个兄弟节点
export function nextSibling (node: Node): ?Node {
  return node.nextSibling
}

// 返回节点标签名（大写字母构成）
export function tagName (node: Element): string {
  return node.tagName
}

// 设置节点文本
export function setTextContent (node: Node, text: string) {
  node.textContent = text
}

// 设置属性
export function setAttribute (node: Element, key: string, val: string) {
  node.setAttribute(key, val)
}
