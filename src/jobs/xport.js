/* @flow */
'use strict'
const path = require('path')
const config = require('config')

const createKoop = require('koop')
const koop = createKoop(config)

const log = koop.log
if (config.cache !== 'local') {
  const cache = require('koop-pgcache')
  koop.register(cache)
}

const GeoXForm = require('geo-xform')
const _ = require('highland')

function xport (options, done) {
  // TODO ya gotta fix this d00d
  if (!options.filePath) options.filePath = path.join('files', `/${options.id}_${options.layer || 0}`, options.key)
  const fileName = `${options.name}.geojson`
  options.geojsonPath = path.join(options.filePath, fileName)
  if (options.format === 'geojson') return xformGeojson(options, done)
  koop.files.exists(options.filePath, fileName, exists => {
    log.info('GeoJSON exists:', exists, options)
    if (exists) return xformOnly(options, done)
    xformAndSave(options, done)
  })
}

function xformOnly (options, done) {
  const fileName = options.geojsonPath.replace(/(?!\S+\.)geojson/, options.format)
  const output = koop.files.createWriteStream(fileName)
  koop.files.createReadStream(options.geojsonPath)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .pipe(GeoXForm.createStream(options.format, options))
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .pipe(output)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .on('finish', () => done())
}

function xformAndSave (options, done) {
  const cacheStream = createCacheStream(options)
  const geojsonOut = koop.files.createWriteStream(options.geojsonPath)
  const fileName = `${options.name}.${options.format}`
  const output = koop.files.createWriteStream(path.join(options.filePath, fileName))

  // we can pipe the geojson straight to S3 while transformations are in progress
  // that way we can reuse the geojson rather than hitting the database again
  cacheStream
  .observe()
  .pipe(geojsonOut)
  .on('error', e => log.error(e))

  cacheStream
  .pipe(GeoXForm.createStream(options.format, options))
  .on('error', e => done(e))
  .on('log', l => log[l.level](l.message))
  .pipe(output)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .on('finish', () => done())
}

function xformGeojson (options, done) {
  createCacheStream(options)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .pipe(koop.files.createWriteStream(options.geojsonPath))
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .on('finish', () => done())
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

module.exports = xport
