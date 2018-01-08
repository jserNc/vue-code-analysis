/* @flow */

/*
  关于方法 Object.freeze(obj) ：
  ① 冻结对象 obj，冻结指的是不能向这个对象添加新的属性，不能修改其已有属性的值，不能删除已有属性，以及不能修改该对象已有属性的可枚举性、可配置性、可写性。也就是说，这个对象永远是不可变的。
  ② 但是，如果一个属性的值是个对象，则这个对象中的属性是可以修改的，除非它也是个冻结对象。
  ③ 返回值，被冻结的对象 obj
*/
export const emptyObject = Object.freeze({})

// 判断一个字符串是否以 $ 或 _ 开头
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  /*
    '$'.charCodeAt(0) -> 36 -> 0x24
    '_'.charCodeAt(0) -> 95 -> 0x5F
  */
  return c === 0x24 || c === 0x5F
}

// 在一个对象上定义一个新属性，或者修改一个对象的现有属性， 并返回这个对象。
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/*
  解析简单的路径
  bailRE 匹配除 字母|数字|下划线|汉字|.|$ 以外的字符

  parsePath(path)(obj) 在对象 obj 中找到路径 path 对应的值 

  例如：path = 'aaa.bbb.ccc'
  var getter = parsePath(path);

  var o1 = {
    aaa : {
      bbb : {
        ccc : 1
      }
    }
  }

  getter(o1) -> 1 
 */
const bailRE = /[^\w.$]/
export function parsePath (path: string): any {
  // 只要 path 中有一个字符不是字母|数字|下划线|汉字|.|$，那就认为不是路径，直接返回
  if (bailRE.test(path)) {
    return
  }
  // 如 'aaa.bbb.ccc' -> ['aaa','bbb','ccc']
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
