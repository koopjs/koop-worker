/* @flow */
'use strict'

const test = require('tape')
const rewire = require('rewire')
const exportFile = rewire('../src/jobs/exportFile')
const fs = require('fs')
const _ = require('highland')
const rimraf = require('rimraf')

test('Transform data when geojson already exists', t => {
  t.plan(2)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    output: 'files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.csv',
    source: `files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.geojson`
  }
  exportFile(options, err => {
    t.error(err, 'No error')
    const rows = []
    _(fs.createReadStream(fileLoc(options.output)))
    .split()
    .compact()
    .each(r => rows.push(r))
    .done(() => t.equal(rows.length, 101), 'CSV has all expected features')
  })
})

test('Transform data into geohash', t => {
  t.plan(2)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    output: 'files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.geohash',
    source: `files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.geojson`
  }
  exportFile(options, err => {
    t.error(err, 'No error')
    const geohash = JSON.parse(fs.readFileSync(fileLoc(options.output)))
    t.equal(Object.keys(geohash).length, 100)
  })
})

test('Transform data with a filter when geojson already exists', t => {
  t.plan(2)
  const options = {
    id: 'f445febc447d4cb696e71ea7816d65d5',
    layer: 0,
    where: 'FID > 50',
    output: 'files/f445febc447d4cb696e71ea7816d65d5_0/test_filter/test.csv',
    source: `files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.geojson`
  }
  exportFile(options, err => {
    t.error(err, 'No error')
    const rows = []
    _(fs.createReadStream(fileLoc(options.output)))
    .split()
    .compact()
    .each(r => rows.push(r))
    .done(() => t.equal(rows.length, 51), 'CSV has all expected features')
  })
})

test('Set up feature stream mock', t => {
  function createStream () {
    return _(fs.createReadStream('./test/fixtures/features.txt')).split().compact()
  }
  function exists (a, b, callback) { callback(false) }
  exportFile.__set__('koop.cache.createStream', createStream)
  exportFile.__set__('koop.files.exists', exists)
  t.end()
})

test('Transform data when geojson does not exist', t => {
  t.plan(2)
  const options = {
    id: 'test',
    layer: 0,
    output: `files/test_0/full_0/test.csv`
  }
  exportFile(options, err => {
    t.error(err, 'No error')

    const rows = []
    _(fs.createReadStream(fileLoc(options.output)))
    .split()
    .compact()
    .each(r => rows.push(r))
    .done(() => t.equal(rows.length, 101), 'CSV has all expected features')
  })
})

test('Transform data directly into geojson', t => {
  t.plan(2)
  const options = {
    id: 'test',
    layer: 1,
    output: `files/test_0/full_1/test.geojson`
  }
  exportFile(options, err => {
    t.error(err, 'No error')
    const path = fileLoc(options.output)
    const geojson = fs.readFileSync(path)
    const features = JSON.parse(geojson).features
    t.equal(features.length, 100, 'GeoJSON has all expected features')
  })
})

test('Transform data from legacy geojson', t => {
  t.plan(2)
  const options = {
    id: 'test',
    layer: 1,
    output: `files/test_0/full_1/test.csv`
  }
  exportFile(options, err => {
    t.error(err, 'No error')
    const rows = []
    _(fs.createReadStream(fileLoc(options.output)))
    .split()
    .compact()
    .each(r => rows.push(r))
    .done(() => t.equal(rows.length, 101), 'CSV has all expected features')
  })
})

test('Teardown', t => {
  rimraf.sync('./test/output')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.csv')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/full_0/test.geohash')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/full_1/test.csv')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/full_1')
  rimraf.sync('./test/data/files/f445febc447d4cb696e71ea7816d65d5_0/test_filter/')
  t.end()
})

function fileLoc (output) {
  return `./test/data/${output}`
}
