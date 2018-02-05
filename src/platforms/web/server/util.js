/* @flow */

import { makeMap, cached } from 'shared/util'

// 保留属性名
const isAttr = makeMap(
  'accept,accept-charset,accesskey,action,align,alt,async,autocomplete,' +
  'autofocus,autoplay,autosave,bgcolor,border,buffered,challenge,charset,' +
  'checked,cite,class,code,codebase,color,cols,colspan,content,http-equiv,' +
  'name,contenteditable,contextmenu,controls,coords,data,datetime,default,' +
  'defer,dir,dirname,disabled,download,draggable,dropzone,enctype,method,for,' +
  'form,formaction,headers,height,hidden,high,href,hreflang,http-equiv,' +
  'icon,id,ismap,itemprop,keytype,kind,label,lang,language,list,loop,low,' +
  'manifest,max,maxlength,media,method,GET,POST,min,multiple,email,file,' +
  'muted,name,novalidate,open,optimum,pattern,ping,placeholder,poster,' +
  'preload,radiogroup,readonly,rel,required,reversed,rows,rowspan,sandbox,' +
  'scope,scoped,seamless,selected,shape,size,type,text,password,sizes,span,' +
  'spellcheck,src,srcdoc,srclang,srcset,start,step,style,summary,tabindex,' +
  'target,title,type,usemap,value,width,wrap'
)

// 可渲染的属性，除了保留属性，还包括 'data-' 或 'aria-' 开头的属性名
const isRenderableAttr = (name: string): boolean => {
  return (
    isAttr(name) ||
    name.indexOf('data-') === 0 ||
    name.indexOf('aria-') === 0
  )
}
export { isRenderableAttr }

// “props - attr” 映射表
export const propsToAttrMap = {
  acceptCharset: 'accept-charset',
  className: 'class',
  htmlFor: 'for',
  httpEquiv: 'http-equiv'
}

// “字符 - 实体” 映射表
const ESC = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '&': '&amp;'
}

// 将字符串 s 中的 < > " & 等四个字符转为实体
export function escape (s: string) {
  return s.replace(/[<>"&]/g, escapeChar)
}

// cachedEscape 就是 escape 方法，只不过 cachedEscape 会将计算结果缓存
export const cachedEscape = cached(escape)

// 将 < > " & 等四个字符转为实体，其他的字符返回自身
function escapeChar (a) {
  return ESC[a] || a
}
