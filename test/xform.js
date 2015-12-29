const test = require('tape')
const rewire = require('rewire')
const xform = rewire('../src/jobs/xform')
const fs = require('fs')
const _ = require('highland')
const rimraf = require('rimraf')

test('Transform data when geojson already exists', t => {
  t.plan(2)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    key: 'test',
    format: 'csv',
    name: 'test',
    path: './test/output'
  }
  xform(options, err => {
    t.error(err, 'No error')
    const rows = []
    _(fs.createReadStream(fileLoc(options)))
    .split()
    .compact()
    .each(r => rows.push(r))
    .done(() => t.equal(rows.length, 101), 'CSV has all expected features')
  })
})

test('Set up feature stream mock', t => {
  function createStream () {
    return _(fs.createReadStream('./test/fixtures/features.txt')).split().compact()
  }
  function exists (a, b, callback) { callback(false) }
  xform.__set__('koop.Cache.createStream', createStream)
  xform.__set__('koop.files.exists', exists)
  t.end()
})

test('Transform data and save geojson when geojson does not exist', t => {
  t.plan(3)
  const options = {
    id: 'test',
    layer: 0,
    key: 'test',
    format: 'csv',
    name: 'test',
    path: './test/output'
  }
  xform(options, err => {
    t.error(err, 'No error')

    const path = fileLoc(options)
    const rows = []
    _(fs.createReadStream(path))
    .split()
    .compact()
    .each(r => rows.push(r))
    .done(() => t.equal(rows.length, 101), 'CSV has all expected features')

    const geojson = fs.readFileSync(path.replace('csv', 'geojson'))
    const features = JSON.parse(geojson).features
    t.equal(features.length, 100, 'GeoJSON has all expected features')
  })
})

test('Transform data directly into geojson', t => {
  t.plan(2)
  const options = {
    id: 'test',
    layer: 1,
    key: 'test',
    format: 'geojson',
    name: 'test',
    path: './test/output'
  }
  xform(options, err => {
    t.error(err, 'No error')
    const path = fileLoc(options)
    const geojson = fs.readFileSync(path)
    const features = JSON.parse(geojson).features
    t.equal(features.length, 100, 'GeoJSON has all expected features')
  })
})

test('Teardown', t => {
  rimraf.sync('./test/output')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/test_0')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/test_1')
  t.end()
})

function fileLoc (options) {
  return `./test/data/files/${options.id}_${options.layer}/${options.key}/${options.name}.${options.format}`
}
