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
if (config.filesystem.local) {
  const LocalFs = require('koop-localfs')
  koop.register(LocalFs)
} else {
  const S3FS = require('koop-s3fs')
  koop.register(S3FS)
}

const GeoXForm = require('geo-xform')
const _ = require('highland')

function exportFile (options, callback) {
  let output
  let finished = false

  createSource(options, (err, source, info) => {
    if (err) return callback(err)
    options.tempPath = config.data_dir

    const filter = createFilter(options)
    const transform = createTransform(options)
    output = createOutput(options, info)

    executeExport(source, filter, transform, output, finish)
  })

  function finish (error) {
    if (!finished) callback(error)
    finished = true
  }

  return {
    abort: function (callback) {
      output.abort()
      finish(new Error('SIGTERM'))
      callback()
    }
  }
}

function createSource (options, callback) {
  let source
  checkSourceExists(options.source, (err, info) => {
    info = info || {}
    if (err) {
      try {
        source = createCacheStream(options)
      } catch (e) {
        e.recommendRetry = true
        return callback(e)
      }
    } else {
      source = koop.fs.createReadStream(options.source)
    }
    callback(null, source, info)
  })
}

function createOutput (options, info) {
  let writeOptions
  if (info.lastModified) {
    writeOptions = {
      metadata: {
        retrieved_at: info.LastModified
      }
    }
  }
  return koop.fs.createWriteStream(options.output, writeOptions)
}

function checkSourceExists (source, callback) {
  if (!source) return callback(null, false)
  koop.fs.stat(source, callback)
}

function createFilter (options) {
  const filtered = options.where || options.geometry
  const isGeohash = /geohash/.test(options.output)
  // if the query is not filtered or the output isn't geohash we just return a noop
  if (!filtered && !isGeohash) return _()
  // if the query is actually filtered then we use Winnow, otherwise it's a noop
  const winnower = filtered ? Winnow.prepareQuery(options) : function (feature) { return feature }
  const output = _.pipeline(stream => {
    return stream
    .pipe(FeatureParser.parse())
    .stopOnError(e => output.emit('error', e))
    .map(JSON.parse)
    .stopOnError(e => output.emit('error', e))
    .map(winnower)
    .stopOnError(e => output.emit('error', e))
    .flatten()
    .compact()
    // if we are cooking a geohash we need to send objects to the transform stage
    // otherwise we just need to send a geojson stream in string forms
    .pipe(isGeohash ? _() : GeoXForm.GeoJSON.createStream({json: true}))
  })

  return output
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
    .errors((e, push, next) => next())
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

function executeExport (source, filter, transform, output, finish) {
  _(source)
  .on('log', l => log[l.level](l.message))
  .on('error', e => finish(e))
  .pipe(filter)
  .on('error', e => {
    if (e.message.match(/Unexpected token \]/i)) e.recommendRetry = true
    finish(e)
    output.abort()
  })
  .pipe(transform)
  .on('log', l => log[l.level](l.message))
  .on('error', e => {
    if (e.message.match(/Unexpected token \]/i)) e.recommendRetry = true
    // In case of a file descriptor leak shut down the worker
    if (e.message.match(/EMFILE/i)) throw e
    finish(e)
    output.abort()
  })
  .pipe(output)
  .on('log', l => log[l.level](l.message))
  .on('error', e => {
    // if We have an error during save to or upload to s3
    // we should abort the transformation
    transform.abort()
    e.recommendRetry = true
    finish(e)
    output.abort()
  })
  .on('finish', () => finish())
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
