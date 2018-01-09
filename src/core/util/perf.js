import { inBrowser } from './env'

export let mark
export let measure

/*
  window.performance 对象是 W3C 性能小组引入的新的 API，目前 IE9 以上的浏览器都支持。
  它的作用是允许网页访问某些函数来测量网页和Web应用程序的性能。

  window.performance 对象有以下方法：

  performance.getEntries()：浏览器获取网页时，会对网页中每一个对象（脚本文件、样式表、图片文件等等）发出一个 http 请求。performance.getEntries 方法以数组形式，返回这些请求的时间统计信息，有多少个请求，返回数组就会有多少个成员。
  performance.now() 方法返回当前网页自从 performance.timing.navigationStart 到当前时间之间的微秒数（毫秒的千分之一）
  performance.mark() 给相应的视点做标记。结合 performance.measure() 使用也可以算出各个时间段的耗时
  performance.clearMarks() 方法用于清除标记，如果不加参数，就表示清除所有标记。

  另外，window.performance.timing 有以下子属性：

  navigationStart：浏览器处理当前网页的启动时间。
  fetchStart：浏览器发起 http 请求读取文档的毫秒时间戳。
  domainLookupStart：域名查询开始时的时间戳。
  domainLookupEnd：域名查询结束时的时间戳。
  connectStart：http 请求开始向服务器发送的时间戳。
  connectEnd：浏览器与服务器连接建立（握手和认证过程结束）的毫秒时间戳。
  requestStart：浏览器向服务器发出 http 请求时的时间戳。或者开始读取本地缓存时。
  responseStart：浏览器从服务器（或读取本地缓存）收到第一个字节时的时间戳。
  responseEnd：浏览器从服务器收到最后一个字节时的毫秒时间戳。
  domLoading：浏览器开始解析网页 DOM 结构的时间。
  domInteractive：网页 dom 树创建完成，开始加载内嵌资源的时间。
  domContentLoadedEventStart：网页 DOMContentLoaded 事件发生时的时间戳。
  domContentLoadedEventEnd：网页所有需要执行的脚本执行完成时的时间，domReady 的时间。
  domComplete：网页 dom 结构生成时的时间戳。
  loadEventStart：当前网页 load 事件的回调函数开始执行的时间戳。
  loadEventEnd：当前网页 load 事件的回调函数结束运行时的时间戳。
*/
if (process.env.NODE_ENV !== 'production') {
  const perf = inBrowser && window.performance
  
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    // 标识视点
    mark = tag => perf.mark(tag)
    // 计算两个视点之间的时间差
    measure = (name, startTag, endTag) => {
      perf.measure(name, startTag, endTag)
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      perf.clearMeasures(name)
    }
  }
}
