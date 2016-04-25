/* @flow */
'use strict'
const test = require('tape')
const NR = require('node-resque')
const config = require('config')
const rimraf = require('rimraf')
const connection = config.queue.connection || {}
connection.pkg = 'redis'

const queue = new NR.queue({connection}) // eslint-disable-line
const Redis = require('redis')
const redis = Redis.createClient(connection)

const worker = require('../src')

test('Set up', t => {
  queue.connect(() => {
    queue.connection.redis.del(`${connection.namespace}:queue:koop`, e => {
      t.end()
    })
  })
})

test('Run an exportFile job that succeeds', t => {
  t.plan(4)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    output: 'files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.csv',
    source: `files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.geojson`,
    job_id: 'job_id'
  }
  redis.subscribe('jobs', () => {
    queue.enqueue('koop', 'exportFile', options)
    redis.once('message', (channel, message) => {
      const info = JSON.parse(message)
      t.equal(info.status, 'start', 'Start emitted')
      t.equal(info.id, 'job_id', 'Job id matches')
      redis.once('message', (channel, message) => {
        const info = JSON.parse(message)
        t.equal(info.status, 'finish', 'Finish emitted')
        t.equal(info.id, 'job_id', 'Job id matches')
      })
    })
  })
})

test('Run an exportFile job that fails', t => {
  t.plan(4)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    output: 'files/f445febc447d4cb696e71ea7816d65d5_3/full_3/test.csv',
    source: `files/f445febc447d4cb696e71ea7816d65d5_3/full_3/test.geojson`,
    job_id: 'job_id2',
    maxRetries: 0
  }
  redis.subscribe('jobs', () => {
    queue.enqueue('koop', 'exportFile', options)
    redis.once('message', (channel, message) => {
      const info = JSON.parse(message)
      t.equal(info.status, 'start', 'Start emitted')
      t.equal(info.id, 'job_id2', 'Job id matches')
      redis.once('message', (channel, message) => {
        const info = JSON.parse(message)
        t.equal(info.status, 'fail', 'Fail emitted')
        t.equal(info.id, 'job_id2', 'Job id matches')
      })
    })
  })
})

test('Run an exportFile that fails, retries and fails again', t => {
  t.plan(8)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    output: 'files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.csv',
    source: `files/f445febc447d4cb696e71ea7816d65d5_0/full_0/empty.geojson`,
    job_id: 'job_id3',
    maxRetries: 1
  }
  redis.subscribe('jobs', () => {
    queue.enqueue('koop', 'exportFile', options)
    redis.once('message', (channel, message) => {
      const info = JSON.parse(message)
      t.equal(info.status, 'start', 'Start emitted')
      t.equal(info.id, 'job_id3', 'Job id matches')
      redis.once('message', (channel, message) => {
        const info = JSON.parse(message)
        t.equal(info.status, 'retry', 'Retry emitted')
        t.equal(info.id, 'job_id3', 'Job id matches')
        redis.once('message', (channel, message) => {
          const info = JSON.parse(message)
          t.equal(info.status, 'start', 'Job restarted')
          t.equal(info.id, 'job_id3', 'Job id matches')
          redis.once('message', (channel, message) => {
            const info = JSON.parse(message)
            t.equal(info.status, 'fail', 'Job failed')
            t.equal(info.id, 'job_id3', 'Job id matches')
          })
        })
      })
    })
  })
})

test('Teardown', t => {
  worker.end()
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/test_0')
  rimraf.sync('./test/data/files/foo_0')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.csv')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_3')
  queue.end()
  redis.quit()
  t.end()
})
