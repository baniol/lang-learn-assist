.PHONY: install dev build preview clean \
        lint lint-fix format format-check type-check \
        rust-check rust-fmt rust-fmt-check rust-clippy \
        test test-watch test-coverage test-rust test-all \
        check-all setup-hooks \
        bump-patch bump-minor bump-major \
        help

# Quick aliases
r: dev
t: test
ca: check-all

##@ Help

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  dev              Run Tauri dev server"
	@echo "  build            Build production app"
	@echo "  preview          Preview Vite build"
	@echo "  install          Install npm dependencies + setup hooks"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint             Run ESLint"
	@echo "  lint-fix         Run ESLint with auto-fix"
	@echo "  format           Format code with Prettier"
	@echo "  format-check     Check formatting with Prettier"
	@echo "  type-check       Run TypeScript type check"
	@echo "  rust-check       Check Rust compilation"
	@echo "  rust-fmt         Format Rust code"
	@echo "  rust-fmt-check   Check Rust formatting"
	@echo "  rust-clippy      Run Rust linter"
	@echo "  check-all        Run all checks (lint, format, type-check, tests)"
	@echo ""
	@echo "Testing:"
	@echo "  test             Run frontend tests"
	@echo "  test-watch       Run frontend tests in watch mode"
	@echo "  test-coverage    Run frontend tests with coverage"
	@echo "  test-rust        Run Rust backend tests"
	@echo "  test-all         Run all tests (frontend + Rust)"
	@echo ""
	@echo "Versioning:"
	@echo "  bump-patch       Bump patch version (0.0.x)"
	@echo "  bump-minor       Bump minor version (0.x.0)"
	@echo "  bump-major       Bump major version (x.0.0)"
	@echo ""
	@echo "Setup:"
	@echo "  setup-hooks      Configure git pre-commit hook"
	@echo "  clean            Remove build artifacts"
	@echo ""
	@echo "Aliases: r=dev, t=test, ca=check-all"

##@ Development

install: setup-hooks
	npm install

dev:
	MACOSX_DEPLOYMENT_TARGET=10.15 npm run tauri dev

build:
	MACOSX_DEPLOYMENT_TARGET=10.15 npm run tauri build

preview:
	npm run preview

##@ Code Quality

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

type-check:
	npx tsc --noEmit

rust-check:
	cd src-tauri && cargo check

rust-fmt:
	cd src-tauri && cargo fmt

rust-fmt-check:
	cd src-tauri && cargo fmt --check

rust-clippy:
	cd src-tauri && cargo clippy -- -D warnings

check-all: lint format-check type-check test-all rust-fmt-check rust-clippy

##@ Testing

test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

test-rust:
	cd src-tauri && cargo test

test-all: test test-rust

##@ Versioning

bump-patch:
	bash scripts/bump-version.sh patch

bump-minor:
	bash scripts/bump-version.sh minor

bump-major:
	bash scripts/bump-version.sh major

##@ Setup

setup-hooks:
	git config core.hooksPath .githooks
	chmod +x .githooks/pre-commit
	@echo "Git hooks configured."

clean:
	rm -rf dist/
	rm -rf src-tauri/target/
