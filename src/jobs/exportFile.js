/* @flow */
'use strict'
const path = require('path')
const config = require('config')
const Winnow = require('winnow')
const FeatureParser = require('feature-parser')

const createKoop = require('koop')
const koop = createKoop(config)

const log = koop.log
if (config.cache !== 'local') {
  const cache = require('koop-pgcache')
  koop.register(cache)
}

const GeoXForm = require('geo-xform')
const _ = require('highland')

function exportFile (options, callback) {
  let source
  let finished = false
  const output = koop.files.createWriteStream(options.output)
  checkSourceExists(options.source, (err, exists) => {
    if (err) return callback(err)
    source = exists ? koop.files.createReadStream(options.source) : createCacheStream(options)
    options.tempPath = config.data_dir
    // noop or true transform
    const format = options.format || path.extname(options.output).replace(/\./, '')
    const transform = format === 'geojson' ? _() : GeoXForm.createStream(format, options)
    // filter will either be a winnow prepared query or a pass-thru stream a.k.a noop
    const filter = options.where || options.geometry ? createFilter(options) : _()
    _(source)
    .on('log', l => log[l.level](l.message))
    .on('error', e => finish(e))
    .pipe(filter)
    .stopOnError(e => finish(e))
    .pipe(transform)
    .on('log', l => log[l.level](l.message))
    .on('error', e => finish(e))
    .pipe(output)
    .on('log', l => log[l.level](l.message))
    .on('error', e => finish(e))
    .on('finish', () => finish())
  })
  return {
    abort: function abort (callback) {
      output.abort()
      finish(new Error('SIGTERM'))
      callback()
    }
  }
  function finish (error) {
    if (!finished) callback(error)
    finished = true
  }
}

function checkSourceExists (source, callback) {
  if (!source) return callback(null, false)
  const dirname = path.dirname(source)
  const basename = path.basename(source)
  koop.files.exists(dirname, basename, exists => callback(null, exists))
}

function createFilter (options) {
  const winnow = Winnow.prepareQuery(options)
  const parser = FeatureParser.parse()
  return _.pipeline(stream => {
    return stream
    .pipe(parser)
    .map(JSON.parse)
    .map(winnow)
    .compact()
    .sequence()
    .pipe(GeoXForm.GeoJSON.createStream({json: true}))
  })
}

function createCacheStream (options) {
  const output = _()
  koop.cache.createStream(options.table, options)
  .on('log', l => log[l.level](l.message))
  .on('error', e => output.emit('error', e))
  .pipe(GeoXForm.GeoJSON.createStream())
  .on('log', l => log[l.level](l.message))
  .on('error', e => output.emit('error', e))
  .pipe(output)
  return output
}

module.exports = exportFile
