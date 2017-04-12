const config = require('config')
const Koop = require('koop')

module.exports = function () {
  const koop = new Koop(config)

  if (config.cache !== 'local') {
    const cache = require('koop-pgcache')
    koop.register(cache)
  }

  if (config.filesystem.s3 && config.filesystem.s3.bucket) {
    const fs = require('@koopjs/filesystem-s3')
    koop.register(fs)
  }
  return koop
}
