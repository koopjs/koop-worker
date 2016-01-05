/* @flow */
'use strict'
const config = require('config')
const NR = require('node-resque')
const lodash = require('lodash')
const Redis = require('ioredis')
const connection = config.queue.connection
const redis = new Redis(connection)
const Logger = require('koop-logger')
const log = new Logger(config)

const xport = require('./jobs/xport')
const copy = require('./jobs/copy')

const jobs = {
  xport: {
    perform: (job, done) => {
      const options = lodash.cloneDeep(job)
      xport(options, done)
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
  fmtLog('Working on', job)
  publish('start', job)
  heartbeat = setInterval(() => {
    fmtLog('Working on', job)
    publish('progress', job)
  }, 5000)
})

worker.on('success', (queue, job) => {
  fmtLog('Job finished', job)
  clearInterval(heartbeat)
  publish('finish', job)
})

worker.on('failure', (queue, job, error) => {
  fmtLog('Job failed', job, error)
  clearInterval(heartbeat)
  publish('fail', job, error)
})

worker.on('error', (queue, job, error) => {
  fmtLog('Job failed: Process shutting down', job, error)
  clearInterval(heartbeat)
  publish('fail', job, error)
  // if we've landed here an error was caught in domain
  // rather than potentially leak resources we just shut down
  worker.end(() => process.exit())
})

worker.on('start', () => log.info('Worker started'))

worker.on('end', () => {
  log.info('Worker shutting down')
  redis.end()
  clearInterval(heartbeat)
})

function publish (status, job, error) {
  let id
  if (job.args && job.args.length) {
    job = job.args[0]
    id = job.job_id
  }
  const info = JSON.stringify({id, status, job, error})
  redis.publish('jobs', info)
}

function fmtLog (msg, job, error) {
  if (error) log.error(msg, fmtJob(job), fmtError(error))
  else log.info(msg, fmtJob(job))
}

function fmtJob (job) {
  if (job.args && job.args.length) return job.args[0]
  else return job
}

function fmtError (error) {
  return error.stack.match(/.+\n.+[^\n]/)[0]
}

process.on('SIGINT', () => {
  worker.end(() => process.exit())
})

process.on('SIGTERM', () => {
  worker.end(() => process.exit())
})

module.exports = worker
