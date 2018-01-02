/* @flow */

// toArray 方法将类数组转成真正数组，并从指定索引截取该数组，例：toArray([0, 1, 2, 3, 4, 5, 6], 2) -> [2, 3, 4, 5, 6]
import { toArray } from '../util/index'

// 安装 Vue.use 方法
export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 已经安装过的插件数组
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 如果当前插件已经安装过，那就返回这个 vm 实例
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 除了第一个参数的数组
    const args = toArray(arguments, 1)
    // 将 Vue 加入到数组，作为第一个元素
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      // 执行 plugin.install 方法
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 加入到已安装插件数组中
    installedPlugins.push(plugin)
    return this
  }
}
