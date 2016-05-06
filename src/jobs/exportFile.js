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
  let source
  let filter
  let transform
  let finished = false
  let failed = false

  createSource(options, (err, newSource, info) => {
    if (err) return callback(err)
    filter = createFilter(options)
    transform = createTransform(options)
    output = createOutput(options, info)
    source = newSource
    options.tempPath = config.data_dir

    _(source)
    .on('log', l => log[l.level](l.message))
    .on('error', e => {
      failed = true
      e.recommendRetry = true
      finish(e)
    })
    .pipe(filter)
    .on('error', e => {
      failed = true
      if (e.message.match(/Unexpected token \]/i)) e.recommendRetry = true
      finish(e)
    })
    .pipe(transform)
    .on('log', l => log[l.level](l.message))
    .on('error', e => {
      failed = true
      if (e.message.match(/Unexpected token \]/i)) e.recommendRetry = true
      finish(e)
    })
    .pipe(output)
    .on('log', l => log[l.level](l.message))
    .on('error', e => {
      failed = true
      e.recommendRetry = true
      finish(e)
    })
    .on('finish', () => {
      // TODO figure out why finish is firing on failures
      if (!failed) finish()
    })
  })

  function finish (error) {
    // Make sure to clean up anything that is running if the jobs fails
    if (error && !finished) tryAbort()
    // guard against the job ending multiple times
    if (!finished) callback(error)
    finished = true
  }

  function tryAbort () {
    [source, filter, transform, output].forEach(x => {
      try {
        if (x && x.abort) x.abort()
      } catch (e) {
        log.error(e)
      }
    })
  }

  return {
    abort: function (message) {
      finish(new Error(message))
    }
  }
}

function createSource (options, callback) {
  checkSourceExists(options.source, (err, info) => {
    if (err) callback(null, createCacheStream(options))
    else callback(null, koop.fs.createReadStream(options.source), info)
  })
}

function createOutput (options, info) {
  let writeOptions
  info = info || {}
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
  const cooker = _.pipeline(stream => {
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
  // noop for compatibility with the ogr transform
  cooker.abort = () => {}
  return cooker
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
