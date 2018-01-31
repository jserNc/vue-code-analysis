/* @flow */

let decoder

export default {
	// 将 html 赋值给一个 div 的 innerHTML，然后返回这个 div 的 textContent 属性
  decode (html: string): string {
  	/*
  			① 第一次，decoder 不存在，创建一个新的 div 赋给 decoder
  			② 之后，decoder 有值了，不再创建新的 div
  	 */
    decoder = decoder || document.createElement('div')
    decoder.innerHTML = html
    return decoder.textContent
  }
}
