const config = require('config')
const createKoop = require('koop')
const koop = createKoop(config)

function copyFile (options, done) {
  koop.files.copy(options, err => done(err))
}

module.exports = copyFile
