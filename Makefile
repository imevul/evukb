SHELL := /usr/bin/env bash

.PHONY: dev dev-local-embed up down prod update migrate test verify-dev verify-qdrant generate-openapi api-docs lint typecheck build

dev:
	pnpm run dev

dev-local-embed:
	pnpm run dev-local-embed

up:
	pnpm run up

down:
	pnpm run down

prod:
	@operator_key_status="$$(EVUKB_ROOT="$(CURDIR)" scripts/ensure-operator-api-key.sh)"; \
	if [ "$$operator_key_status" = "added" ]; then \
		pnpm run prod -- --force-recreate evukb-api evukb-web; \
	else \
		pnpm run prod; \
	fi

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
