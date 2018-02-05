/* @flow */

import { inBrowser } from 'core/util/env'
import { makeMap } from 'shared/util'

// 命名空间映射表
export const namespaceMap = {
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML'
}

// html 保留标签名
export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
)

// this map is intentionally selective, only covering SVG elements that may contain child elements.
// svg 保留标签名。这里只是挑选了部分可能包含子元素的 svg 元素
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)

// 是否为 pre 标签
export const isPreTag = (tag: ?string): boolean => tag === 'pre'

// 是否为 html/svg 保留标签名
export const isReservedTag = (tag: string): ?boolean => {
  return isHTMLTag(tag) || isSVG(tag)
}

// 获取标签的命名空间
export function getTagNamespace (tag: string): ?string {
  if (isSVG(tag)) {
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === 'math') {
    return 'math'
  }
}

const unknownElementCache = Object.create(null)

// 判断是否为未知元素标签名，返回值为布尔值
export function isUnknownElement (tag: string): boolean {

  // 1. 不是浏览器环境，直接返回 true
  if (!inBrowser) {
    return true
  }

  // 2. 若 tag 为 html/svg 保留标签名，直接返回 false
  if (isReservedTag(tag)) {
    return false
  }

  tag = tag.toLowerCase()

  // 3. 从缓存中取值
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }

  // 4. 计算 tag 是否为未知元素，并缓存结果

  const el = document.createElement(tag)

  // ① tag 中包含 - 那就通过构造函数来判断
  if (tag.indexOf('-') > -1) {
    // http://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  // ② 否则，用 /HTMLUnknownElement/ 匹配元素的字符串形式来判断
  } else {
    /*
        例如：
        var div = document.createElement('div')
        div.toString() -> "[object HTMLDivElement]"
        div.constructor === HTMLDivElement -> true

        var nc = document.createElement('nc')
        nc.toString() -> "[object HTMLUnknownElement]"
        nc.constructor === HTMLUnknownElement -> true
     */
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}
