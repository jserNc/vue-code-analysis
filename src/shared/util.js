/* @flow */

// these helpers produces better vm code in JS engines due to their
// explicitness and function inlining
// ȫ�� undefined | null
export function isUndef (v: any): boolean %checks {
  return v === undefined || v === null
}

// �Ȳ�ȫ�� undefined Ҳ��ȫ�� null
export function isDef (v: any): boolean %checks {
  return v !== undefined && v !== null
}

// ȫ�� true
export function isTrue (v: any): boolean %checks {
  return v === true
}

// ȫ�� false
export function isFalse (v: any): boolean %checks {
  return v === false
}

/**
 * Check if value is primitive
 */
// ����Ϊ string | number | boolean
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
// ����Ϊ object���������� null
export function isObject (obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object'
}

const _toString = Object.prototype.toString

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
// ��ͨ����
export function isPlainObject (obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

// �������
export function isRegExp (v: any): boolean {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
// ��Ч������������������ 0 �������޵�������val Ϊ�ַ��� '123' Ҳ�ǿ��Եģ�
export function isValidArrayIndex (val: any): boolean {
  const n = parseFloat(val)
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

/**
 * Convert a value to a string that is actually rendered.
 */
// �������͵�ֵתΪ�ַ�������ת������ַ�����ʵ����Ⱦʱ���õ�
export function toString (val: any): string {
  return val == null
    ? ''
    : typeof val === 'object'
		/*
		 ���� JSON.stringify(value [, replacer] [, space]) ������
		 �� 1 ������Ϊ value ��Ҫ���л���һ�� JSON �ַ�����ֵ
		 �� 2 ������Ϊ null ʱ��ʾ������������Զ��ᱻ���л�
		 �� 3 ������ space �ı���ÿ����������ָ����Ŀ�Ŀո�
		*/
      ? JSON.stringify(val, null, 2)
      : String(val)
}

/**
 * Convert a input value to a number for persistence.
 * If the conversion fails, return original string.
 */
// �ַ���תΪ��ֵ����תΪ���ֺ�Ƿ����Ǿͷ����ַ�������
export function toNumber (val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
/*
	1. makeMap ����������
	str : string ����
	expectsLowerCase �� ����ʡ�ԣ�boolean ����

	2. makeMap ��������ֵΪһ��������
	(key: string) => true | void
	�ú�������Ϊ string ���ͣ�����ֵΪ true �� undefined

	�����ַ����ǲ����� str �У�����Ϊ true ��ʾ������תΪСд���ٱȽϣ�eg:
	makeMap('aaa,bbb,ccc',true)('aa')  -> undefined
	makeMap('aaa,bbb,ccc',true)('aaa') -> true
	makeMap('aaa,bbb,ccc',true)('AAA') -> true
*/
export function makeMap (
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | void {
  const map = Object.create(null)
  // list Ϊ���飬����Ԫ���� string ����
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
// ����Ƿ�Ϊ���ñ�ǩ isBuiltInTag('slot') -> true
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if a attribute is a reserved attribute.
 */
 // ����Ƿ�Ϊ��������
export const isReservedAttribute = makeMap('key,ref,slot,is')

/**
 * Remove an item from an array
 */
// ��������ɾ��ָ����һ��
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
// �ж������Ƿ�Ϊ�������������
export function hasOwn (obj: Object | Array<*>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 */
// �Ժ��� fn ��ִ�н�����л��棬ÿ��ִ�� fn ʱ���ȴӻ����ȡ
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
// �����ַ��ָ����ַ����շ廯�����磺a-b-c -> aBC
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 * Capitalize a string.
 */
// ����ĸ��д
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 */
// ���շ�д��תΪ���ַ�д������ hyphenate('aaBbCc') -> "aa-bb-cc"
const hyphenateRE = /([^-])([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str
    .replace(hyphenateRE, '$1-$2')
    .replace(hyphenateRE, '$1-$2')
    .toLowerCase()
	/*
		ΪʲôҪ���� 2 �� replace �أ������������� 3 ����д��ĸ�������֪����
		�� ��ֻ���� 1 �� replace��
       'ABCD'.replace(hyphenateRE, '$1-$2') -> "A-BC-D"
       ���ԣ�hyphenate ('ABCD') -> "a-bc-d"
		�� ������ 2 �� replace��
       hyphenate ('ABCD') -> "a-b-c-d"
	*/
})

/**
 * Simple bind, faster than native
 */
// �󶨺��� fn �ڲ��� this �� ctx
export function bind (fn: Function, ctx: Object): Function {
  function boundFn (a) {
    const l: number = arguments.length
    return l
      ? l > 1
		    // ���� 1 ������
        ? fn.apply(ctx, arguments)
		    // 1 ������
        : fn.call(ctx, a)
	    // û�в���
      : fn.call(ctx)
  }
  // record original fn length���βθ���
  boundFn._length = fn.length
  return boundFn
}

/**
 * Convert an Array-like object to a real Array.
 */
// ��������ת���������飬����ָ��������ȡ�����飬����toArray([0, 1, 2, 3, 4, 5, 6], 2) -> [2, 3, 4, 5, 6]
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
// �� _from ��������Ը��� to ���������
export function extend (to: Object, _from: ?Object): Object {
  // in �������ȡһ������Ŀ�ö�����ԣ���������ĺͼ̳еĿ�ö������
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
/*
 ��һ�����ϲ���һ������eg:
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
// �պ���
export function noop (a?: any, b?: any, c?: any) {}

/**
 * Always return false.
 */
// ʼ�շ��� false
export const no = (a?: any, b?: any, c?: any) => false

/**
 * Return same value
 */
// ���ز�������
export const identity = (_: any) => _

/**
 * Generate a static keys string from compiler modules.
 */
/*
	��һ������ staticKeys ����ϲ���һ���ַ������ٸ����ӣ�
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
  ���� arr.reduce([callback, initialValue]) ������
  �� callback �����ĵ�һ������Ϊ�ϴε��� callback �ķ���ֵ�����߳�ʼֵ initialValue
     callback �����ĵڶ�������Ϊ��ǰ�������Ԫ��
  �� initialValue Ϊ��һ�ε��� callback �ĵ�һ������
  */
  return modules.reduce((keys, m) => {
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
// �� a �� b תΪ�ַ����󣬱Ƚ��Ƿ���� 
export function looseEqual (a: mixed, b: mixed): boolean {
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  // a �� b ���Ƕ���
  if (isObjectA && isObjectB) {
    try {
	    // ������ַ�����ʽ��Ⱦ���
      return JSON.stringify(a) === JSON.stringify(b)
    } catch (e) {
      // possible circular reference��ѭ������
      return a === b
    }
  // a �� b �����Ƕ���
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

// ���� val Ԫ�أ���ʵ�Ǻ� val ��ʽ����ȵ�Ԫ�أ� �� arr �е�����
export function looseIndexOf (arr: Array<mixed>, val: mixed): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
// ���� fn ִֻ��һ��
export function once (fn: Function): Function {
  let called = false
  return function () {
    if (!called) {
      // ִ�й�һ�α�����
      called = true
      fn.apply(this, arguments)
    }
  }
}
