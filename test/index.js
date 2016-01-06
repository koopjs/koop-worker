/* @flow */
'use strict'
const test = require('tape')
const NR = require('node-resque')
const config = require('config')
const rimraf = require('rimraf')
const connection = config.queue.connection

const queue = new NR.queue({connection}) // eslint-disable-line
const Redis = require('ioredis')
const redis = new Redis(connection)

const worker = require('../src')

test('Set up', t => {
  queue.connect(() => {
    t.end()
  })
})

test('Run an xport job that succeeds', t => {
  t.plan(4)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    key: 'test',
    format: 'csv',
    name: 'test',
    path: './test/output',
    job_id: 'job_id'
  }
  redis.subscribe('jobs', () => {
    queue.enqueue('koop', 'xport', options)
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

test('Run an xport job that fails', t => {
  t.plan(4)
  const options = {
    id: 'foo',
    layer: 0,
    key: 'test',
    format: 'csv',
    name: 'test',
    path: './test/output',
    job_id: 'job_id2'
  }
  redis.subscribe('jobs', () => {
    queue.enqueue('koop', 'xport', options)
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

test('Teardown', t => {
  worker.end()
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/test_0')
  queue.end()
  redis.disconnect()
  t.end()
})
