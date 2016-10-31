# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [1.2.9] - 2016-10-29
### Fixed
* Ensure heartbeat is not sent after job completes

## [1.2.8] - 2016-10-15
### Changed
* Reduce geohash precision to 7

### Fixed
* Retrieval time is written to s3 metadata

## [1.2.7] - 2016-05-13
### Fixed
* Files are written into the correct temporary directory

## [1.2.6] - 2016-05-12
### Fixed
* Uncommented line causing multiple callbacks to fire at the end of export jobs

## [1.2.5] - 2016-05-06
### Changed
* Set the content type for files saved on s3

## [1.2.4] - 2016-05-06
### Changed
* Jobs running over 60 minutes are cancelled

### Fixed
* Catch ECONNRESET error from source in export stream

## [1.2.3] - 2016-04-28
### Fixed
* No unhandled rejections shall go uncaught
* Do not leave temp directory lying around when the source stream fails

## [1.2.2] - 2016-04-25
### Fixed
* Recommend retry when geohash fails because geojson is not ready on S3
* Handle geohash errors without throwing an exception

## [1.2.1] - 2016-04-22
### Changed
* Abort geoxform if write to disk fails in exportFile
* Shut down on emfile errors in exportFile

## [1.2.0] - 2016-04-21
### Added
* `maxRetries` is an new option for jobs

### Changed
* Only retry on some types of errors
* Remove `plugins/retry`

## [1.1.3] - 2016-04-14
### Changed
* Integrate koop-s3fs

## [1.1.2] - 2016-04-13
### Fixed
* Don't pass metadata object to S3 if the values are empty

## [1.1.1] - 2016-04-04
### Changed
* Metadata object is stored with files saved on S3

## [1.1.0] - 2016-03-22
### Added
* ExportFile can generate a geohash

## [1.0.1] - 2016-03-22
### Fixed
* Rebuild

## [1.0.0] - 2016-03-22
### Added
* Use Winnow for creating filtered files

### Changed
* ExportFile Job now takes a source (geojson filepath) and an output. The format, name and filePath parameters are no longer accepted

## [0.3.1] - 2016-03-17
### Changed
* Upgrade config package

## [0.3.0] - 2016-03-16
### Added
* Export jobs are retried 3 times

## [0.2.0] - 2016-03-15
### Added
* Clean shutdown on SIGTERM

## [0.1.1] - 2016-01-27
### Added
* Supply temp path in exportFile job

## [0.1.0] - 2016-01-26
### Changed
* `Rename xport to ExportFile`
* Remove simultaneous GeoJSON + transform writing
* Refactor exortFile internals

## [0.0.4] - 2016-01-26
### Changed
* Use fork instead of observe to prevent memory issues

## [0.0.3] - 2016-01-12
### Fixed
* Require Koop > 3.0

## [0.0.2] - 2016-01-08
### Fixed
* Removed case of trying to JSON.stringify circular object

## [0.0.1] - 2016-01-07
### Added
* First release

[1.2.9]: https://github.com/koopjs/koop-worker/compare/v1.2.9..v1.2.8
[1.2.8]: https://github.com/koopjs/koop-worker/compare/v1.2.8..v1.2.7
[1.2.7]: https://github.com/koopjs/koop-worker/compare/v1.2.7..v1.2.6
[1.2.6]: https://github.com/koopjs/koop-worker/compare/v1.2.6..v1.2.5
[1.2.5]: https://github.com/koopjs/koop-worker/compare/v1.2.5..v1.2.4
[1.2.4]: https://github.com/koopjs/koop-worker/compare/v1.2.4..v1.2.3
[1.2.3]: https://github.com/koopjs/koop-worker/compare/v1.2.3..v1.2.2
[1.2.2]: https://github.com/koopjs/koop-worker/compare/v1.2.2..v1.2.1
[1.2.1]: https://github.com/koopjs/koop-worker/compare/v1.2.1..v1.2.0
[1.2.0]: https://github.com/koopjs/koop-worker/compare/v1.2.0..v1.1.3
[1.1.3]: https://github.com/koopjs/koop-worker/compare/v1.1.3..v1.1.2
[1.1.2]: https://github.com/koopjs/koop-worker/compare/v1.1.2..v1.1.1
[1.1.1]: https://github.com/koopjs/koop-worker/compare/v1.1.1..v1.1.0
[1.1.0]: https://github.com/koopjs/koop-worker/compare/v1.1.0..v1.0.1
[1.0.1]: https://github.com/koopjs/koop-worker/compare/v1.0.0..v1.0.1
[1.0.0]: https://github.com/koopjs/koop-worker/compare/v0.3.1..v1.0.0
[0.3.1]: https://github.com/koopjs/koop-worker/compare/v0.3.0..v0.3.1
[0.3.0]: https://github.com/koopjs/koop-worker/compare/v0.2.0..v0.3.0
[0.2.0]: https://github.com/koopjs/koop-worker/compare/v0.1.1..v0.2.0
[0.1.1]: https://github.com/koopjs/koop-worker/compare/v0.1.0..v0.1.1
[0.1.0]: https://github.com/koopjs/koop-worker/compare/v0.0.4..v0.1.0
[0.0.4]: https://github.com/koopjs/koop-worker/compare/v0.0.3..v0.0.4
[0.0.3]: https://github.com/koopjs/koop-worker/compare/v0.0.2..v0.0.3
[0.0.2]: https://github.com/koopjs/koop-worker/compare/v0.0.1..v0.0.2
[0.0.1]: https://github.com/koopjs/koop-worker/tree/v0.0.1
