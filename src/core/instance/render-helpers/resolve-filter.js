/* @flow */

import { identity, resolveAsset } from 'core/util/index'

/**
 * Runtime helper for resolving filters
 */
// Vue.prototype._f = resolveFilter;
export function resolveFilter (id: string): Function {
	// 返回 this.$options['filters'][id] 这个过滤器（若找不到，将 id 驼峰化，连字符化吗，再找）
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
