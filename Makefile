.PHONY: install dev build preview clean lint format test test-rust test-all type-check help

help:
	@echo "Available commands:"
	@echo "  make install       - Install npm dependencies"
	@echo "  make dev           - Run Tauri dev server"
	@echo "  make build         - Build production app"
	@echo "  make preview       - Preview Vite build"
	@echo "  make lint          - Run TypeScript check"
	@echo "  make format        - Format code"
	@echo "  make test-rust     - Run Rust backend tests"
	@echo "  make type-check    - Run TypeScript type check"
	@echo "  make clean         - Remove build artifacts"

install:
	npm install

dev:
	MACOSX_DEPLOYMENT_TARGET=10.15 npm run tauri dev

build:
	MACOSX_DEPLOYMENT_TARGET=10.15 npm run tauri build

preview:
	npm run preview

lint:
	npm run build

format:
	@echo "No formatter configured yet"

type-check:
	npx tsc --noEmit

test-rust:
	cd src-tauri && cargo test

test-all: test-rust

clean:
	rm -rf dist/
	rm -rf src-tauri/target/
	rm -rf node_modules/
