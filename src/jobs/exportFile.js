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
  let output
  let finished = false

  checkSourceExists(options.source, (err, exists, info) => {
    if (err) return callback(err)
    info = info || {}
    const writeOptions = {
      metadata: {
        retrieved_at: info.LastModified
      }
    }
    output = koop.files.createWriteStream(options.output, writeOptions)
    source = exists ? koop.files.createReadStream(options.source) : createCacheStream(options)
    options.tempPath = config.data_dir
    const filter = createFilter(options)
    const transform = createTransform(options)
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
  koop.files.exists(dirname, basename, (exists, path, info) => callback(null, exists, info))
}

function createFilter (options) {
  const filtered = options.where || options.geometry
  const isGeohash = /geohash/.test(options.output)
  // if the query is not filtered or the output isn't geohash we just return a noop
  if (!filtered && !isGeohash) return _()
  // if the query is actually filtered then we use Winnow, otherwise it's a noop
  const winnower = filtered ? Winnow.prepareQuery(options) : function (feature) { return feature }
  // if we are cooking a geohash we need to send objects to the transform stage
  // otherwise we just need to send a geojson stream in string forms
  const output = isGeohash ? _() : GeoXForm.GeoJSON.createStream({json: true})
  return _.pipeline(stream => {
    return stream
    .pipe(FeatureParser.parse())
    .map(JSON.parse)
    .map(winnower)
    .flatten()
    .compact()
    .pipe(output)
  })
}

function createTransform (options) {
  const format = options.format || path.extname(options.output).replace(/\./, '')
  switch (format) {
    case 'geojson':
      return _()
    case 'geohash':
      return cookGeohash()
    default:
      return GeoXForm.createStream(format, options)
  }
}

function cookGeohash () {
  return _.pipeline(stream => {
    const geohash = {}
    const output = _()
    const cooker = Winnow.prepareSql('SELECT geohash(geometry, 8) as geohash FROM ?')
    stream
    .map(cooker)
    .errors()
    .each(row => {
      if (row[0]) {
        const hash = row[0].geohash
        if (geohash[hash]) geohash[hash]++
        else geohash[hash] = 1
      }
    })
    .done(() => {
      output.write(JSON.stringify(geohash))
      output.write(_.nil)
    })
    return output
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
