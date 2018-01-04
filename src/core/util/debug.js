/* @flow */

import config from '../config'
import { noop } from 'shared/util'

export let warn = noop
export let tip = noop
export let formatComponentName: Function = (null: any) // work around flow check

// 非生产环境下
if (process.env.NODE_ENV !== 'production') {
  const hasConsole = typeof console !== 'undefined'
  const classifyRE = /(?:^|[-_])(\w)/g
  // 将首字母或-或_后的字母转为大写，如 classify('aaa-bbb_ccc') -> "AaaBbbCcc"
  const classify = str => str
    .replace(classifyRE, c => c.toUpperCase())
    .replace(/[-_]/g, '')

  // 打印警告信息
  warn = (msg, vm) => {
    // 组件栈文本
    const trace = vm ? generateComponentTrace(vm) : ''

    if (config.warnHandler) {
      config.warnHandler.call(null, msg, vm, trace)
    } else if (hasConsole && (!config.silent)) {
      console.error(`[Vue warn]: ${msg}${trace}`)
    }
  }

  // 打印提示信息
  tip = (msg, vm) => {
    if (hasConsole && (!config.silent)) {
      console.warn(`[Vue tip]: ${msg}` + (
        vm ? generateComponentTrace(vm) : ''
      ))
    }
  }

  // 返回格式化的字符串形式组件名
  formatComponentName = (vm, includeFile) => {
    // 如果一个 vm 的根节点就是自身，那就返回 '<Root>'
    if (vm.$root === vm) {
      return '<Root>'
    }
    /*
      ① vm 是字符串类型，那么 name 就是 vm 自身
      ② vm 是函数，并且有 options 属性，那么 name 就是 vm.options.name
      ③ vm 是 Vue 实例，那么 name 就是 vm.$options.name || vm.$options._componentTag
      ④ 其他，name 就是 vm.name
    */
    let name = typeof vm === 'string'
      ? vm
      : typeof vm === 'function' && vm.options
        ? vm.options.name
        : vm._isVue
          ? vm.$options.name || vm.$options._componentTag
          : vm.name

    /*
      若 name 不存在，那就从文件名中获取组件名

      eg:
      'myComponet.vue'.match(/([^/\\]+)\.vue$/)
      -> ["myComponet.vue", "myComponet", index: 0, input: "myComponet.vue"]

      所以，match[1] 就是组件名
    */
    const file = vm._isVue && vm.$options.__file
    if (!name && file) {
      const match = file.match(/([^/\\]+)\.vue$/)
      name = match && match[1]
    }

    /*
      ① 组件名'aaa-bbb' -> "<AaaBbb>"
      ② 如果没有组件名，就用匿名，"<Anonymous>"
      ③ 如果需要，还可以跟上文件名 "<AaaBbb> at aaa-bbb.vue"
    */
    return (
      (name ? `<${classify(name)}>` : `<Anonymous>`) +
      (file && includeFile !== false ? ` at ${file}` : '')
    )
  }

  /*
    字符串 str 重复 n 遍，我们很容易想到循环 n 次，拼接字符串，可这里没这么做

    右移 >> 运算可以模拟整除：
    21 >> 2 -> 21 / (2^2) -> 5
    21 >> 3 -> 21 / (2^3) -> 2

    1 >> 1 -> 1 / 2 -> 0
    2 >> 1 -> 2 / 2 -> 1
    3 >> 1 -> 3 / 2 -> 1
    4 >> 1 -> 4 / 2 -> 2
    5 >> 1 -> 5 / 2 -> 2

    所以，n >> 1 相当于 n / 2

    repeat('a',1) -> 'a'       因为 1 = 2^0
    repeat('a',2) -> 'aa'      因为 2 = 2^1
    repeat('a',3) -> 'aaa'     因为 3 = 2^0 + 2^1
    repeat('a',4) -> 'aaaa'    因为 4 = 2^2
    repeat('a',5) -> "aaaaa"   因为 5 = 2^0 + 2^2
    repeat('a',6) -> "aaaaaa"  因为 6 = 2^1 + 2^2
    repeat('a',7) -> "aaaaaaa" 因为 7 = 2^0 + 2^1 + 2^2

    这种写法只需要循环 Math.ceil(log(2)n) 次（以 2 为底 n 的对数），n 越大效果越明显
  */
  const repeat = (str, n) => {
    let res = ''
    while (n) {
      if (n % 2 === 1) res += str
      if (n > 1) str += str
      n >>= 1
    }
    return res
  }

  // 返回组件栈相关信息的字符串
  const generateComponentTrace = vm => {
    if (vm._isVue && vm.$parent) {
      const tree = []
      let currentRecursiveSequence = 0

      while (vm) {
        if (tree.length > 0) {
          const last = tree[tree.length - 1]
          if (last.constructor === vm.constructor) {
            currentRecursiveSequence++
            vm = vm.$parent
            continue
          } else if (currentRecursiveSequence > 0) {
            tree[tree.length - 1] = [last, currentRecursiveSequence]
            currentRecursiveSequence = 0
          }
        }
        tree.push(vm)
        vm = vm.$parent
      }
      /*
        最后得到的 tree 数组应该是这样的：
        [
          [vm1,num1],
          [vm2,num2],
          [vm3]
          ...
        ]
        
        map 函数的回调函数第一个参数为数组元素，第二个参数为元素索引
        ['a', 'b', 'c', 'd'].map(function(item,index) {
            console.log(item,index);
        });   
        打印结果如下：
        a 0
        b 1
        c 2
        d 3
       */
      return '\n\nfound in\n\n' + tree
        .map((vm, i) => `${
          i === 0 ? '---> ' : repeat(' ', 5 + i * 2)
        }${
          Array.isArray(vm)
            ? `${formatComponentName(vm[0])}... (${vm[1]} recursive calls)`
            : formatComponentName(vm)
        }`)
        .join('\n')
    } else {
      return `\n\n(found in ${formatComponentName(vm)})`
    }
  }
}
