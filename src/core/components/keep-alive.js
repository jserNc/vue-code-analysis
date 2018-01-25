/* @flow */

import { isRegExp } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

const patternTypes: Array<Function> = [String, RegExp, Array]

// 获取组件名称
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

// 判断 pattern 和 name 是否匹配
function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  // 1. pattern 是字符串数组，name 是其中之一
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  // 2. pattern 是逗号分隔的字符串，按逗号分隔成数组后，name 是其中之一
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  // 3. pattern 是正则表达式，name 通过匹配
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  // 4. 以上都没匹配成功，那就返回 false
  return false
}

// 裁剪缓存
function pruneCache (cache: VNodeCache, current: VNode, filter: Function) {
  // 遍历 cache 里的所有 VNode 实例
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      // 组件名
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        // 1. 如果 cachedNode 对应的组件名不能通过过滤器，并且不是 current，那就销毁其对应的组件实例
        if (cachedNode !== current) {
          pruneCacheEntry(cachedNode)
        }
        // 2. 如果只是 cachedNode 对应的组件名不能通过过滤器，删除该缓存
        cache[key] = null
      }
    }
  }
}

// 销毁组件
function pruneCacheEntry (vnode: ?VNode) {
  if (vnode) {
    vnode.componentInstance.$destroy()
  }
}

export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    // patternTypes = [String, RegExp, Array]
    include: patternTypes,  // matches(this.include, name)，只有匹配的组件会被缓存
    exclude: patternTypes   // !matches(this.exclude, name)，任何匹配的组件都不会被缓存
  },

  created () {
    this.cache = Object.create(null)
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache[key])
    }
  },

  watch: {
    /*
        include 属性变化时执行该函数，函数作用为：
        遍历 this.cache 这个对象里的 vnode 实例，若某个 vnode 实例对应的组件实例（若该组件实例不是 this._vnode，则销毁该组件）的名字没通过 matches(val, name) 匹配，则将该 vnode 从 this.cache 中移除
        
        留下通过匹配的 
    */
    include (val: string | RegExp | Array<string>) {
      pruneCache(this.cache, this._vnode, name => matches(val, name))
    },
    /*
        include 属性变化时执行该函数，函数作用为：
        遍历 this.cache 这个对象里的 vnode 实例，若某个 vnode 实例对应的组件实例（若该组件实例不是 this._vnode，则销毁该组件）的名字通过了 matches(val, name) 匹配，则将该 vnode 从 this.cache 中移除
        
        留下没通过匹配的
     */
    exclude (val: string | RegExp | Array<string>) {
      pruneCache(this.cache, this._vnode, name => !matches(val, name))
    }
  },

  render () {
    // ① 获取第一个子组件 vnode
    const vnode: VNode = getFirstComponentChild(this.$slots.default)
    // ② 获取 vnode 对应的组件选项
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    
    if (componentOptions) {
      // ③ 获取对应的组件名
      const name: ?string = getComponentName(componentOptions)
      
      // ④ ”不包含“，或”排除“，那就不缓存，直接在这里返回 vnode
      if (name && (
        // 不包含
        (this.include && !matches(this.include, name)) ||
        // 排除
        (this.exclude && matches(this.exclude, name))
      )) {
        return vnode
      }

      /*
        a. 若 vnode.key 为 null，那么 key 为 componentOptions.Ctor.cid + "::" + componentOptions.tag 或 componentOptions.Ctor.cid
        b. 否则，key 为 vnode.key
      */
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        // // 相同的构造函数可能会被注册成不同的局部组件，所以仅仅判断 cid 是不够的
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key

      // a. 若已经缓存过该 vnode，那就获取缓存中的 vnode 对应的组件实例
      if (this.cache[key]) {
        vnode.componentInstance = this.cache[key].componentInstance
      // b. 若没有缓存过，那就缓存该 vnode
      } else {
        this.cache[key] = vnode
      }

      // 添加 keepAlive 属性
      vnode.data.keepAlive = true
    }

    // 最后返回 vnode
    return vnode
  }
}
