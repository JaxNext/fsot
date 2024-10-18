const kindMap = {
  'directory': '文件夹',
  'file': '文件',
}
const operationMap = {
  'create': '新增',
  'remove': '删除',
  'modify': '修改',
  'move': '移动',
  'rename': '重命名',
}

function formatTime(time) {
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
}

export class FSObserver {
  constructor(callback) {
    this.callback = callback
    this.observer = null
    this.rootHandle = null
    this.logs = []
    this.init()
  }

  init() {
    if (!'FileSystemObserver' in window) {
      console.error('FileSystemObserver is not supported in this browser')
      return
    }
    this.observer = new FileSystemObserver(async (records, observer) => {
      if (!records.length) return
      const log = await this.handleRecord(records[0])
      this.callback?.(log, records, observer)
    })
  }

  async observe(handle, options) {
    this.rootHandle = handle
    this.options = options
    this.observer.observe(handle, options)
  }

  async handleRecord(record) {
    const { changedHandle, type, relativePathComponents, relativePathMovedFrom } = record

    const path = relativePathComponents.join('/')
    const oldPath = relativePathMovedFrom?.join('/')
    let log = {}

    switch (type) {
      case 'appeared':
        log = await this.add(changedHandle, path)
        break
      case 'modified':
        log = await this.modifyFile(changedHandle, path)
        break
      case 'disappeared':
        log = await this.remove(changedHandle, path)
        break
      case 'moved':
        log = await this.move(changedHandle, path, oldPath)
        break
      default:
        break
    }
    return log
  }

  add(handle, path) {         
    return this.updateLog({
      handle,
      operation: 'create',
      to: path,
    })
  }

  remove(handle, path) {    
    return this.updateLog({
      handle,
      operation: 'remove',
      to: path,
    })
  }

  modifyFile(handle, path) {
    return this.updateLog({
      handle,
      operation: 'modify',
      to: path,
    })
  }

  async move(handle, path, oldPath) {
    const pathArr = path.split('/')
    const oldPathArr = oldPath.split('/')
    let operation = 'move'
    // 重命名
    if (pathArr.length === oldPathArr.length) {
      const len = pathArr.length
      for (let i = 0; i < len; i++) {
        if (i < len - 1) {
          if (pathArr[i] !== oldPathArr[i]) break
        } else if (pathArr[i] !== oldPathArr[i]) {
          operation = 'rename'
        }
      }
    }

    return this.updateLog({
      handle,
      operation,
      from: oldPath,
      to: path,
    })
  }

  async updateLog({ handle, operation, from, to }) {
    const { kind } = handle
    let time = Date.now()
    if (kind === 'file' && operation !== 'remove') {
      const { lastModified } = await handle.getFile()
      time = lastModified
    }

    let description = `${formatTime(time)} ${operationMap[operation]}${kindMap[kind]}`
    if (['move', 'rename'].includes(operation)) {
      description += ` ${from} -> ${to}`
    } else {
      description += ` ${to}`
    }

    const newLog = {
      kind,
      operation,
      time,
      from,
      to,
      description,
      handle,
    }
    this.logs.push(newLog)
    return newLog
  }
}