/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
/*
   Dep 的全称是 Dependencies，直译过来就是”依赖“的意思，可以将它理解为”主题“。
   一个 dep 实例就是一个主题，多个订阅者（watcher 实例）可以订阅这个主题。主题可以发布通知，让订阅者进行相应的更新。
 */
export default class Dep {
  // es6 语法，定义静态属性 Dep.target
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  // 构造函数，新建 dep 实例（每个 dep 的 id 是唯一的）
  constructor () {
    this.id = uid++
    this.subs = []
  }

  // 添加订阅者（订阅者一般为 watcher 实例）
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 删除订阅者
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  /*
      ① 订阅者 watcher 添加主题 dep（每个订阅者也可以订阅多个主题）
      ② 若发现 watcher.depIds 列表里没有 dep.id，那就调用 dep.addSub(watcher)，即 dep 主题添加订阅者 watcher
   
      这是一个互相添加的操作。订阅者有一个主题列表，主题也有一个订阅者列表。
   */ 
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 通知该主题的所有订阅者，执行更新
  notify () {
    // 由于订阅者列表是可变的，所以执行循环之前复制出一个稳定的副本
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.

// 标志当前正在计算的 watcher。这是全局唯一的，因为任一时刻只能有一个 watcher 正在计算。
Dep.target = null
const targetStack = []

// 旧的 Dep.target 压栈，Dep.target 指向 _target
export function pushTarget (_target: Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

// 旧的 Dep.target 出栈，即恢复旧的 Dep.target
export function popTarget () {
  Dep.target = targetStack.pop()
}
