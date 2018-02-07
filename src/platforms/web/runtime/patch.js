/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

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
export const patch: Function = createPatchFunction({ nodeOps, modules })
