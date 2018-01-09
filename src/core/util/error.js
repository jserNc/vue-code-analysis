/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser } from './env'

export function handleError (err: Error, vm: any, info: string) {
  // 首选自定义的错误处理函数
  if (config.errorHandler) {
    config.errorHandler.call(null, err, vm, info)
  // 其次用控制台打印出错信息
  } else {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Error in ${info}: "${err.toString()}"`, vm)
    }
    if (inBrowser && typeof console !== 'undefined') {
      console.error(err)
    } else {
      throw err
    }
  }
}
