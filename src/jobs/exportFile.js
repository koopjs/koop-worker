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
  const geojson = `${options.name}.geojson`
  koop.files.exists(options.filePath, geojson, exists => {
    log.info('GeoJSON exists:', exists, options)
    const source = exists ? koop.files.createReadStream(`${options.filePath}/${geojson}`) : createCacheStream(options)
    options.tempPath = config.data_dir
    // noop or true transform
    const transform = options.format === 'geojson' ? _() : GeoXForm.createStream(options.format, options)
    const output = koop.files.createWriteStream(`${options.filePath}/${options.name}.${options.format}`)

    source
    .on('log', l => log[l.level](l.message))
    .on('error', e => done(e))
    .pipe(transform)
    .on('log', l => log[l.level](l.message))
    .on('error', e => done(e))
    .pipe(output)
    .on('log', l => log[l.level](l.message))
    .on('error', e => done(e))
    .on('finish', () => done())
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
