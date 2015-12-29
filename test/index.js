const test = require('tape')
const NR = require('node-resque')
const config = require('config')
const rimraf = require('rimraf')
const connection = {
  package: 'ioredis',
  host: config.redis.host,
  port: config.redis.port,
  prefix: config.redis.prefix,
  database: config.redis.database || 0
}

const queue = new NR.queue({connection}) // eslint-disable-line
const Redis = require('ioredis')
const redis = new Redis(connection)

const worker = require('../src')

test('Run an xform job that succeeds', t => {
  t.plan(2)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    key: 'test',
    format: 'csv',
    name: 'test',
    path: './test/output'
  }
  queue.connect(() => {
    redis.subscribe('jobs', () => {
      queue.enqueue('koop', 'xform', options)
      redis.once('message', (channel, message) => {
        const info = JSON.parse(message)
        t.equal(info.status, 'started')
        redis.once('message', (channel, message) => {
          const info = JSON.parse(message)
          t.equal(info.status, 'success')
        })
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
