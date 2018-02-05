/* @flow */

import on from './on'
import bind from './bind'
import { noop } from 'shared/util'

// 默认指令
export default {
  on,
  bind,
  cloak: noop
}
