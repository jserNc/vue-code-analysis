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
  const keyCodes = config.keyCodes[key] || builtInAlias
  if (Array.isArray(keyCodes)) {
    return keyCodes.indexOf(eventKeyCode) === -1
  } else {
    return keyCodes !== eventKeyCode
  }
}
