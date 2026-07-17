SHELL := /usr/bin/env bash

.PHONY: dev dev-local-embed up down prod update migrate test verify-dev verify-qdrant benchmark-vector generate-openapi api-docs lint typecheck build

dev:
	pnpm run dev

dev-local-embed:
	pnpm run dev-local-embed

up:
	pnpm run up

down:
	pnpm run down

prod:
	pnpm run prod

update:
	git pull --ff-only && $(MAKE) prod

migrate:
	pnpm run migrate

test:
	pnpm run test

verify-dev:
	pnpm run verify-dev

verify-qdrant:
	pnpm run verify-qdrant

benchmark-vector:
	pnpm run benchmark:vector

generate-openapi:
	pnpm run generate-openapi

api-docs:
	pnpm run generate-api-docs

lint:
	pnpm run lint

typecheck:
	pnpm run typecheck

build:
	pnpm run build
