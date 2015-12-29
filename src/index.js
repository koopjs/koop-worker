const config = require('config')
const NR = require('node-resque')
const lodash = require('lodash')
const Redis = require('ioredis')
const connection = {
  package: 'ioredis',
  host: config.redis.host,
  port: config.redis.port,
  prefix: config.redis.prefix,
  database: config.redis.database || 0
}
const redis = new Redis(connection)

const xform = require('./jobs/xform')
const copy = require('./jobs/copy')

const jobs = {
  xform: {
    perform: (job, done) => {
      const options = lodash.cloneDeep(job)
      xform(options, done)
    }
  },
  copy: {
    perform: (job, done) => {
      const options = lodash.cloneDeep(job)
      copy(options, done)
    }
  }
}

const queues = config.queues || ['koop']

const worker = new NR.worker({connection, queues}, jobs) // eslint-disable-line
worker.connect(() => {
  worker.workerCleanup()
  worker.start()
})

let heartbeat

worker.on('job', (queue, job) => {
  publish('started', job)
  heartbeat = setInterval(() => publish('progress', job), 5000)
})

worker.on('success', (queue, job) => {
  clearInterval(heartbeat)
  publish('success', job)
})

worker.on('failure', (queue, job, error) => {
  clearInterval(heartbeat)
  publish('failure', job, error)
})

worker.on('error', (queue, job, error) => {
  clearInterval(heartbeat)
  publish('failure', job, error)
  // if we've landed here an error was caught in domain
  // rather than potentially leak resources we just shut down
  worker.end(() => process.exit())
})

worker.on('end', () => {
  redis.end()
  clearInterval(heartbeat)
})

function publish (status, job, error) {
  const info = JSON.stringify({status, job, error})
  redis.publish('jobs', info)
}

process.on('SIGINT', () => {
  worker.end(() => process.exit())
})

process.on('SIGTERM', () => {
  worker.end(() => process.exit())
})

module.exports = worker
