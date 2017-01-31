'use strict'
const koop = require('../lib/initKoop')()

function copyFile (options, done) {
  koop.fs.copy(options, err => done(err))
}

module.exports = copyFile
