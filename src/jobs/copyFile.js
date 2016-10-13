'use strict'
const config = require('config')
const createKoop = require('koop')
const koop = createKoop(config)

let fs
if (config.filesystem.s3 && config.filesystem.s3.bucket) {
  fs = require('koop-s3fs')
} else {
  fs = require('koop-localfs')
}
koop.register(fs)

function copyFile (options, done) {
  koop.fs.copy(options, err => done(err))
}

module.exports = copyFile
