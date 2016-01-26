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

const exportFile = require('./jobs/exportFile')
const copy = require('./jobs/copyFile')

const jobs = {
  exportFile: {
    perform: (job, done) => {
      const options = lodash.cloneDeep(job)
      exportFile(options, done)
    }
  },
  copyFile: {
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
  if (!error.domainThrow) fmtLog('Job failed', job, error)
  clearInterval(heartbeat)
  publish('fail', job, error)
  // if we've landed here an error was caught in domain
  // rather than potentially leak resources we just shut down
  if (error.domainThrown) {
    fmtLog('Worker failed in unknown state, shutting down', job, error)
    worker.end(() => process.exit())
  }
})

worker.on('error', (queue, job, error) => {
  fmtLog('Worker emitted error', job, error)
})

worker.on('start', () => log.info('Worker started'))

worker.on('end', () => {
  log.info('Worker shutting down')
  redis.end()
  clearInterval(heartbeat)
})

function publish (status, job, error) {
  let id
  if (job && job.args && job.args.length) {
    job = job.args[0]
    id = job.job_id
  }
  let errorReport
  if (error) {
    errorReport = {
      message: error.message,
      code: error.code,
      time: error.time
    }
  }
  const info = JSON.stringify({id, status, job, errorReport})
  redis.publish('jobs', info)
}

function fmtLog (msg, job, error) {
  if (error) log.error(msg, fmtJob(job), fmtError(error))
  else log.info(msg, fmtJob(job))
}

function fmtJob (job) {
  if (job && job.args && job.args.length) return job.args[0]
  else return job
}

function fmtError (error) {
  if (!error || !error.stack) return ''
  return error.stack.match(/.+\n.+[^\n]/)[0]
}

process.on('SIGINT', () => {
  worker.end(() => process.exit())
})

process.on('SIGTERM', () => {
  worker.end(() => process.exit())
})

module.exports = worker
