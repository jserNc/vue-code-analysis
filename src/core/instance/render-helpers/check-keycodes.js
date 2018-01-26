/* @flow */

import config from 'core/config'

/**
 * Runtime helper for checking keyCodes from config.
 */
/*
	Vue.prototype._k = checkKeyCodes;

	该函数检查键值，eventKeyCode 和配置的键值不相同返回 true，例如：
	_k($event.keyCode,"right",39) 不是点击鼠标右键返回 true
 */
export function checkKeyCodes (
  eventKeyCode: number,
  key: string,
  builtInAlias: number | Array<number> | void
): boolean {
  // keyCodes 优先获取 config.keyCodes[key]，找不到，才获取 builtInAlias
  const keyCodes = config.keyCodes[key] || builtInAlias

  // ① keyCodes 是数组，eventKeyCode 是否为其中一个
  if (Array.isArray(keyCodes)) {
    return keyCodes.indexOf(eventKeyCode) === -1
  // ② keyCodes 数字，eventKeyCode 是否和其相等
  } else {
    return keyCodes !== eventKeyCode
  }
}
