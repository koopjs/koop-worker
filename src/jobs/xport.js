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

function exportFile (options, done) {
  // TODO ya gotta fix this d00d
  if (!options.filePath) options.filePath = path.join('files', `/${options.id}_${options.layer || 0}`, options.key)
  const fileName = `${options.name}.geojson`
  options.geojsonPath = path.join(options.filePath, fileName)
  if (options.format === 'geojson') return exportGeojson(options, done)
  koop.files.exists(options.filePath, fileName, exists => {
    log.info('GeoJSON exists:', exists, options)
    if (exists) exportFromS3(options, done)
    else exportFromCache(options, done)
  })
}

function exportFromS3 (options, done) {
  const fileName = options.geojsonPath.replace(/(?!\S+\.)geojson/, options.format)
  const transform = GeoXForm.createStream(options.format, options)
  const output = koop.files.createWriteStream(fileName)

  koop.files.createReadStream(options.geojsonPath)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .pipe(transform)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .pipe(output)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .on('finish', () => done())
}

function exportFromCache (options, done) {
  const cacheStream = createCacheStream(options)
  const fileName = `${options.name}.${options.format}`
  const output = koop.files.createWriteStream(path.join(options.filePath, fileName))

  cacheStream
  .pipe(GeoXForm.createStream(options.format, options))
  .on('error', e => done(e))
  .on('log', l => log[l.level](l.message))
	.on('data', () => console.log('data coming through the pipe'))
  .pipe(output)
  .on('log', l => log[l.level](l.message))
  .on('error', e => done(e))
  .on('finish', () => done())
}

function exportGeojson (options, done) {
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

module.exports = exportFile
