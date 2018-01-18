/* @flow */

import {
  tip,
  hasOwn,
  isDef,
  isUndef,
  hyphenate,
  formatComponentName
} from 'core/util/index'


/*
  ① 遍历 Ctor.options.props 对象的键名 key
  ② 从 data.props 和 data.attrs 提取值
  ③ 若找到 (data.props | data.attrs)[key]，就复制到 res 对象中
  ④ 最后返回 json 对象 res
 */
export function extractPropsFromVNodeData (
  data: VNodeData,
  Ctor: Class<Component>,
  tag?: string
): ?Object {
  // 这里只提取原始值，验证和默认值的处理由子组件自己完成

  // we are only extracting raw values here.
  // validation and default values are handled in the child
  // component itself.
  
  // 若不存在 Ctor.options.props，直接返回
  const propOptions = Ctor.options.props
  if (isUndef(propOptions)) {
    return
  }

  const res = {}
  /*
    es6 语法，相当于：
    var attrs = data.attrs;
    var props = data.props;
   */
  const { attrs, props } = data
  if (isDef(attrs) || isDef(props)) {
    for (const key in propOptions) {
      // 将驼峰写法转为连字符写法，如 hyphenate('aaBbCc') -> "aa-bb-cc"
      const altKey = hyphenate(key)
      if (process.env.NODE_ENV !== 'production') {
        const keyInLowerCase = key.toLowerCase()
        if (
          key !== keyInLowerCase &&
          attrs && hasOwn(attrs, keyInLowerCase)
        ) {
          /*
            ① tip 函数的作用是：调用 console.warn 函数发出警告，例如："[Vue tip]: some tip"

            ② formatComponentName 函数的作用是格式化组件名：
               a. 组件名'aaa-bbb' -> "<AaaBbb>"
               b. 如果没有组件名，就用匿名，"<Anonymous>"
               c. 如果需要，还可以跟上文件名 "<AaaBbb> at aaa-bbb.vue"

            ③ 翻译一下以下的提示信息：
               这里把全小写字母组成的属性名传给了某组件，但是声明的属性名并不全是小写字母。
               需要注意的是：html 属性对大小写是不敏感的（都解析为小写）。camelCased 驼峰化的属性名需要转换为相应的 kebab-case (短横线隔开式) 命名。
          */
          tip(
            `Prop "${keyInLowerCase}" is passed to component ` +
            `${formatComponentName(tag || Ctor)}, but the declared prop name is` +
            ` "${key}". ` +
            `Note that HTML attributes are case-insensitive and camelCased ` +
            `props need to use their kebab-case equivalents when using in-DOM ` +
            `templates. You should probably use "${altKey}" instead of "${key}".`
          )
        }
      }
      /*
        ① 优先从 props 中提取 props[key | altKey] 属性，找到了就复制给 res 对象
        ② 前者没找到，再从 attrs 中提取 props[key | altKey] 属性，找到了复制给 res 对象，任何删除属性 props[key | altKey]
       */
      checkProp(res, props, key, altKey, true) ||
      checkProp(res, attrs, key, altKey, false)
    }
  }
  return res
}

/*
  以下两种情况返回 true，其他所有情况都返回 false
  1. key 是 hash 对象的自有属性，复制给 res 对象，并返回 true
  2. altKey 是 hash 对象的自有属性，复制给 res 对象，并返回 true
 */
function checkProp (
  res: Object,
  hash: ?Object,
  key: string,
  altKey: string,
  preserve: boolean
): boolean {
  // ① hash 不为 undefined/null 
  if (isDef(hash)) {
    // a. key 是 hash 对象的自有属性，复制给 res 对象，并返回 true
    if (hasOwn(hash, key)) {
      res[key] = hash[key]
      if (!preserve) {
        delete hash[key]
      }
      return true
    // b. altKey 是 hash 对象的自有属性，复制给 res 对象，并返回 true
    } else if (hasOwn(hash, altKey)) {
      res[key] = hash[altKey]
      if (!preserve) {
        delete hash[altKey]
      }
      return true
    }
  }
  // ② hash 为 undefined/null，直接返回 false
  return false
}
