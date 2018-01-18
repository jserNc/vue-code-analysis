/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  /*
    以上方法的共同点是：都会改变原数组
    于是，拦截这些方法，重新定义 arrayMethods['push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'sort' | 'reverse']
   
    def(arrayMethods, method, mutator) 第四个参数为空，意味着属性 method 是不可枚举的
   */
  def(arrayMethods, method, function mutator (...args) {
    /*
      es6 语法，这里自动将实参解构为数组 args
      先按照方法的原定义执行，然后发出通知，告诉对这个数组感兴趣的 watcher
     */
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    // 只有这 3 种方法会插入新元素
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        /*
          arrayObject.splice(index,howmany,item1,.....,itemX)，其中：
          index 整数，规定添加/删除项目的位置，使用负数可从数组结尾处规定位置.
          howmany 要删除的项目数量。如果设置为 0，则不会删除项目。
          item1, ..., itemX 向数组添加的新元素。

          这里把 [item1, ..., itemX] 等新元素赋给 inserted
        */
        inserted = args.slice(2)
        break
    }
    // 若添加了新元素，观察之（遍历数组 inserted，对每一项 item 执行 observe(item)）
    if (inserted) ob.observeArray(inserted)
    // 数组变化了，发出通知
    ob.dep.notify()
    return result
  })
})
