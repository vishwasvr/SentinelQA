# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- CI unit tests and coverage gate (QA-32) ([#4](https://github.com/vishwasvr/SentinelQA/pull/4)).
- CI secrets scan (gitleaks) and params JSON Schema check ([#5](https://github.com/vishwasvr/SentinelQA/pull/5)).
- Repository standards: CONTRIBUTING, CHANGELOG, SECURITY.

### Changed
- Alarm email sourced from a GitHub environment variable; emails forbidden in params ([#6](https://github.com/vishwasvr/SentinelQA/pull/6)).

### Pending (open PRs, not merged)
- Safety-critical shared modules: audit, gate, sample, config, with module specs ([#7](https://github.com/vishwasvr/SentinelQA/pull/7)).

## [0.0.0]

### Added
- Design phase: BRD v1.7.2, architecture, ADRs, specs, runbooks, delivery strategy (#1–#3).
