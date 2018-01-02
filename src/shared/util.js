/* @flow */

// these helpers produces better vm code in JS engines due to their
// explicitness and function inlining
// 全等 undefined | null
export function isUndef (v: any): boolean %checks {
  return v === undefined || v === null
}

// 既不全等 undefined 也不全等 null
export function isDef (v: any): boolean %checks {
  return v !== undefined && v !== null
}

// 全等 true
export function isTrue (v: any): boolean %checks {
  return v === true
}

// 全等 false
export function isFalse (v: any): boolean %checks {
  return v === false
}

/**
 * Check if value is primitive
 */
// 类型为 string | number | boolean
export function isPrimitive (value: any): boolean %checks {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
// 类型为 object，但不能是 null
export function isObject (obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object'
}

const _toString = Object.prototype.toString

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
// 普通对象
export function isPlainObject (obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

// 正则对象
export function isRegExp (v: any): boolean {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
// 有效的数组索引，即大于 0 并且有限的整数（val 为字符串 '123' 也是可以的）
export function isValidArrayIndex (val: any): boolean {
  const n = parseFloat(val)
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

/**
 * Convert a value to a string that is actually rendered.
 */
// 任意类型的值转为字符串，被转换后的字符串在实际渲染时会用到
export function toString (val: any): string {
  return val == null
    ? ''
    : typeof val === 'object'
		/*
		 对于 JSON.stringify(value [, replacer] [, space]) 函数：
		 第 1 个参数为 value 将要序列化成一个 JSON 字符串的值
		 第 2 个参数为 null 时表示对象的所有属性都会被序列化
		 第 3 个参数 space 文本在每个级别缩进指定数目的空格
		*/
      ? JSON.stringify(val, null, 2)
      : String(val)
}

/**
 * Convert a input value to a number for persistence.
 * If the conversion fails, return original string.
 */
// 字符串转为数值，若转为数字后非法，那就返回字符串本身
export function toNumber (val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
/*
	1. makeMap 函数参数：
	str : string 类型
	expectsLowerCase ： 可以省略，boolean 类型

	2. makeMap 函数返回值为一个函数：
	(key: string) => true | void
	该函数参数为 string 类型，返回值为 true 或 undefined

	检验字符串是不是在 str 中，参数为 true 表示将参数转为小写后再比较，eg:
	makeMap('aaa,bbb,ccc',true)('aa')  -> undefined
	makeMap('aaa,bbb,ccc',true)('aaa') -> true
	makeMap('aaa,bbb,ccc',true)('AAA') -> true
*/
export function makeMap (
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | void {
  const map = Object.create(null)
  // list 为数组，数组元素是 string 类型
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}

/**
 * Check if a tag is a built-in tag.
 */
// 检测是否为内置标签 isBuiltInTag('slot') -> true
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if a attribute is a reserved attribute.
 */
 // 检测是否为保留属性
export const isReservedAttribute = makeMap('key,ref,slot,is')

/**
 * Remove an item from an array
 */
// 从数组中删除指定的一项
export function remove (arr: Array<any>, item: any): Array<any> | void {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * Check whether the object has the property.
 */
const hasOwnProperty = Object.prototype.hasOwnProperty
// 判断属性是否为对象的自有属性
export function hasOwn (obj: Object | Array<*>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 */
// 对函数 fn 的执行结果进行缓存，每次执行 fn 时优先从缓存读取
export function cached<F: Function> (fn: F): F {
  const cache = Object.create(null)
  return (function cachedFn (str: string) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }: any)
}

/**
 * Camelize a hyphen-delimited string.
 */
const camelizeRE = /-(\w)/g
// 将连字符分隔的字符串驼峰化，例如：a-b-c -> aBC
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 * Capitalize a string.
 */
// 首字母大写
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 */
// 将驼峰写法转为连字符写法，如 hyphenate('aaBbCc') -> "aa-bb-cc"
const hyphenateRE = /([^-])([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str
    .replace(hyphenateRE, '$1-$2')
    .replace(hyphenateRE, '$1-$2')
    .toLowerCase()
	/*
		为什么要调用 2 次 replace 呢，看看连续出现 3 个大写字母的情况就知道了
		① 若只调用 1 次 replace：
       'ABCD'.replace(hyphenateRE, '$1-$2') -> "A-BC-D"
       所以：hyphenate ('ABCD') -> "a-bc-d"
		② 若调用 2 次 replace：
       hyphenate ('ABCD') -> "a-b-c-d"
	*/
})

/**
 * Simple bind, faster than native
 */
// 绑定函数 fn 内部的 this 到 ctx
export function bind (fn: Function, ctx: Object): Function {
  function boundFn (a) {
    const l: number = arguments.length
    return l
      ? l > 1
		    // 多余 1 个参数
        ? fn.apply(ctx, arguments)
		    // 1 个参数
        : fn.call(ctx, a)
	    // 没有参数
      : fn.call(ctx)
  }
  // record original fn length，形参个数
  boundFn._length = fn.length
  return boundFn
}

/**
 * Convert an Array-like object to a real Array.
 */
// 将类数组转成真正数组，并从指定索引截取该数组，例：toArray([0, 1, 2, 3, 4, 5, 6], 2) -> [2, 3, 4, 5, 6]
export function toArray (list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * Mix properties into target object.
 */
// 用 _from 对象的属性覆盖 to 对象的属性
export function extend (to: Object, _from: ?Object): Object {
  // in 运算符获取一个对象的可枚举属性，包括自身的和继承的可枚举属性
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
/*
 将一组对象合并成一个对象，eg:
 arr = [
	{ book : 'js' },
	{ edition : 3 },
	{ author : 'nanc' }
 ];
 toObject(arr) 
 -> { book: "js", edition: 3, author: "nanc" }
*/
export function toObject (arr: Array<any>): Object {
  const res = {}
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/)
 */
// 空函数
export function noop (a?: any, b?: any, c?: any) {}

/**
 * Always return false.
 */
// 始终返回 false
export const no = (a?: any, b?: any, c?: any) => false

/**
 * Return same value
 */
// 返回参数自身
export const identity = (_: any) => _

/**
 * Generate a static keys string from compiler modules.
 */
/*
	将一组对象的 staticKeys 数组合并成一个字符串，举个例子：
	modules = [
		{ staticKeys : ['mod11','mod12'] },
		{ staticKeys : ['mod21','mod22'] },
		{ staticKeys : ['mod31','mod32'] }
	];
	genStaticKeys(modules)
	-> "mod11,mod12,mod21,mod22,mod31,mod32"
*/
export function genStaticKeys (modules: Array<ModuleOptions>): string {
  /*
  对于 arr.reduce([callback, initialValue]) 函数：
  ① callback 函数的第一个参数为上次调用 callback 的返回值，或者初始值 initialValue
     callback 函数的第二个参数为当前被处理的元素
  ② initialValue 为第一次调用 callback 的第一个参数
  */
  return modules.reduce((keys, m) => {
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
// 将 a 和 b 转为字符串后，比较是否相等 
export function looseEqual (a: mixed, b: mixed): boolean {
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  // a 和 b 都是对象
  if (isObjectA && isObjectB) {
    try {
	    // 对象的字符串形式相等就行
      return JSON.stringify(a) === JSON.stringify(b)
    } catch (e) {
      // possible circular reference，循环引用
      return a === b
    }
  // a 和 b 都不是对象
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

// 返回 val 元素（其实是和 val 形式上相等的元素） 在 arr 中的索引
export function looseIndexOf (arr: Array<mixed>, val: mixed): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
// 函数 fn 只执行一次
export function once (fn: Function): Function {
  let called = false
  return function () {
    if (!called) {
      // 执行过一次便上锁
      called = true
      fn.apply(this, arguments)
    }
  }
}
