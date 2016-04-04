 Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

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
