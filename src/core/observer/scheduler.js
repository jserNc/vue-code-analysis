/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
// 重置调度器的状态（各指标都回到初始值）
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
// 执行调度队列
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  /*
      在 flush 之前，对 queue 里的所有 watcher 进行排序（watcher.id 从小到大），原因有三：
      1. 组件更新时从父组件到子组件的顺序（因为父组件会比子组件先创建）
      2. 组件的用户 watcher 会比渲染 watcher 先执行计算（因为用户 watcher 先创建）
      3. 如果某个组件在父组件的 watcher 执行期间被销毁了，那么这个组件的 watcher 就可以不执行了
   */
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed as we run existing watchers
  // 这里没有对 queue.length 进行缓存，是因为在循环过程中，可能还会有新的 watcher 加入到 queue 中
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    id = watcher.id
    has[id] = null
    
    /*
        ① 计算 watcher 最新的值，value = watcher.get() -> value = watcher.getter.call(vm, vm) 
        ② 若新值与旧值不一样，就执行回调函数 watcher.cb.call(watcher.vm, value, oldValue)
     */
    watcher.run()

    /*
      ① 前面说过，这个 queue 在循环执行过程中是可以动态更新的，也就是允许新的 watcher 入队
      ② 若执行 watcher.run() 过程中，又执行 queueWatcher() 将这个 watcher 入队了，于是 has[id] = true
      ③ 那就把 circular[id] 加 1，表示这个 watcher 又 run 了一次
      ④ 若在这个 for 循环某个 watcher run 的次数超过了 MAX_UPDATE_COUNT（这里是 100 次），那就可能出现了无限循环，立即终止循环
     */
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  /*
      在状态重置之前保存 queue 和 activatedChildren 的副本
      这个时候循环刚结束，它们的值 = 循环之前的值 + 循环之中新增的值
   */
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  // 遍历 activatedQueue 中每一个组件 vm，分别激活其子组件
  callActivatedHooks(activatedQueue)
  // 遍历 updatedQueue 中每一个订阅者 watcher，若该订阅器是渲染订阅器并且对应的组件已经渲染过，那就触发 updated 钩子
  callUpdatedHooks(updatedQueue)

  // devtool hook
  // 开发工具中触发 flush 事件
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

// 触发 updated 钩子
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    /*
        ① 若该 watcher 是渲染 watcher，即 watcher === watcher.vm._watcher
        ② watcher.vm 已经在 dom 中渲染过了

        ① 和 ② 同时满足，说明是 dom 更新，那就触发 updated 钩子
     */
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
// 入队待激活组件
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  /*
    将 vm._inactive 标志为 false，这样渲染函数就可以以此判断这个 vm 是否在失效的组件树中
   */
  vm._inactive = false
  activatedChildren.push(vm)
}

// 遍历所有组件 vm，将 vm._inactive 置为 true，并激活 vm 的子组件
function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
// 入队 watcher
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id

  // 确保队列中的 watcher 都是唯一的
  if (has[id] == null) {
    has[id] = true

    // ① 不在 flush 过程中，直接将 watcher 加入到队列末尾就好
    if (!flushing) {
      queue.push(watcher)
    // ② 在 flush 过程中，队列是按照 id 从小到大排序的，这里要插队，得找准位置
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      // 在有序队列中，找到应该插入的位置 i
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      // 在位置 i 后面插入 watcher
      queue.splice(i + 1, 0, watcher)
    }

    // queue the flush
    // 开始出队
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
