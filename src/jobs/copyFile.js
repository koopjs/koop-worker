const config = require('config')
const createKoop = require('koop')
const koop = createKoop(config)

if (config.filesystem.local) {
  const LocalFs = require('koop-localfs')
  koop.register(LocalFs)
} else {
  const S3FS = require('koop-s3fs')
  koop.register(S3FS)
}

function copyFile (options, done) {
  koop.fs.copy(options, err => done(err))
}

module.exports = copyFile
