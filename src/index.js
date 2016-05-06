/* @flow */
'use strict'
const config = require('config')
const NR = require('node-resque')
const lodash = require('lodash')
const Redis = require('redis')
const connection = config.queue.connection || {}
connection.pkg = 'redis'
const redis = Redis.createClient(connection)
const Logger = require('koop-logger')
const log = new Logger(config)
const Queue = require('koop-queue')
const queue = new Queue()

const exportFile = require('./jobs/exportFile')
const copy = require('./jobs/copyFile')

let running

const jobs = {
  exportFile: {
    perform: (job, finish) => {
      const options = lodash.cloneDeep(job)
      running = exportFile(options, (err, result) => {
        finishJob(job, err, result, finish)
      })
    }
  },
  copyFile: {
    perform: (job, finish) => {
      const options = lodash.cloneDeep(job)
      copy(options, (err, result) => {
        finishJob(job, err, result, finish)
      })
    }
  }
}

function finishJob (job, error, result, callback) {
  if (error && shouldRetry(job, error)) {
    callback(null, {retried: true, error})
  } else {
    callback(error, result)
  }
}

function shouldRetry (job, err) {
  const retries = job.retries ? job.retries : 0
  // coerce maxRetries to integer
  const maxRetries = parseInt(job.maxRetries, 10)
  return retries < maxRetries && err.recommendRetry
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

// we have to force failures that need to be retried through this so we can override
// node-resque's success fail logic
worker.on('success', (queue, job, result) => {
  if (result && result.retried) {
    fmtLog('Job failed, retrying', job, result.error)
    worker.emit('retry', job)
  } else {
    fmtLog('Job finished', job)
    publish('finish', job)
  }
  clearInterval(heartbeat)
})

worker.on('retry', job => {
  fmtLog('Reenqueing:', job)
  publish('retry', job)
  // unfreeze the job object
  job = JSON.parse(JSON.stringify(job))
  if (!job.args[0].retries) {
    job.args[0].retries = 1
  } else {
    job.args[0].retries++
  }
  queue.enqueue(job.class, job.args)
})

worker.on('failure', (queue, job, error) => {
  if (!error.domainThrow) fmtLog('Job failed', job, error)
  clearInterval(heartbeat)
  publish('fail', job, error)
  // if we've landed here an error was caught in domain
  // rather than potentially leak resources we just shut down
  if (error.domainThrown) {
    fmtLog('Worker failed in unknown state, shutting down in 5 seconds', job, error)
    worker.end()
    setTimeout(() => process.exit(1), 5000)
  }
})

worker.on('error', (queue, job, error) => {
  fmtLog('Worker emitted error', job, error)
})

worker.on('start', () => log.info('Worker started'))

worker.on('end', () => {
  log.info('Worker shutting down')
  redis.quit()
  queue.shutdown()
  clearInterval(heartbeat)
  clearInterval(checker)
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
  var logable
  if (job && job.args && job.args.length) logable = job.args[0]
  else logable = job
  return lodash.omit(logable, 'metadata')
}

function fmtError (error) {
  if (!error || !error.stack) return ''
  return error.stack.match(/.+\n.+[^\n]/)[0]
}

process
.on('SIGINT', () => {
  if (running) running.abort('SIGTERM')
  worker.end(() => process.exit())
})
.on('SIGTERM', () => {
  if (running) running.abort('SIGTERM')
  worker.end(() => process.exit())
})
.on('unhandledRejection', (error, p) => {
  log.error('Worker failed with unhandled rejection, shutting down in 5 seconds', error)
  worker.end()
  setTimeout(() => process.exit(1), 5000)
})

const checker = setInterval(() => {
  if (running && running.abort) {
    const tooLong = 60 * 60 * 1000
    if (Date.now() - running.start > tooLong) running.abort('Job aborted, took too long')
  }
}, 5 * 60 * 1000)

module.exports = worker
