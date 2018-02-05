/* @flow */

import { makeMap } from 'shared/util'

// these are reserved for web because they are directly compiled away
// during template compilation
export const isReservedAttr = makeMap('style,class')

// attributes that should be using props for binding
// 以下几个标签有 value 属性
const acceptValue = makeMap('input,textarea,option,select')

// 以下几种情况的属性会添加进 el.props 数组，而不是 el.attrs 数组
export const mustUseProp = (tag: string, type: ?string, attr: string): boolean => {
  return (
    (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
}

// 枚举属性
export const isEnumeratedAttr = makeMap('contenteditable,draggable,spellcheck')

// 布尔属性
export const isBooleanAttr = makeMap(
  'allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,' +
  'default,defaultchecked,defaultmuted,defaultselected,defer,disabled,' +
  'enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,' +
  'muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,' +
  'required,reversed,scoped,seamless,selected,sortable,translate,' +
  'truespeed,typemustmatch,visible'
)


/*
 参考：http://www.w3school.com.cn/xlink/xlink_syntax.asp

 ① XLink 是 XML Linking language 的缩写，XLink 用于在 XML 文档中创建超级链接的标准方法，类似于 html 链接，但更强大
 ② 为了访问 XLink 的属性和特性，我们必须在文档的顶端声明 XLink 命名空间。XLink 的命名空间是："http://www.w3.org/1999/xlink"。

 eg:
    <?xml version="1.0"?>
    <homepages xmlns:xlink="http://www.w3.org/1999/xlink">
        <homepage xlink:type="simple" xlink:href="http://www.w3school.com.cn">Visit W3School</homepage>
        <homepage xlink:type="simple" xlink:href="http://www.w3.org">Visit W3C</homepage>
    </homepages>

    <homepage> 元素中的 xlink:type 和 xlink:href 属性定义了来自 XLink 命名空间的 type 和 href 属性。
    xlink:type="simple" 可创建一个简单的两端链接（意思是“从这里到哪里”）。另外，还有多端链接（多方向）。
*/
export const xlinkNS = 'http://www.w3.org/1999/xlink'

// 是否是 xlink
export const isXlink = (name: string): boolean => {
  return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink'
}

// 获取 xlink 中属性名，例如 getXlinkProp('xlink:href') -> 'href'
export const getXlinkProp = (name: string): string => {
  return isXlink(name) ? name.slice(6, name.length) : ''
}

// 是否为假值，即 null/undefined/false
export const isFalsyAttrValue = (val: any): boolean => {
  return val == null || val === false
}
