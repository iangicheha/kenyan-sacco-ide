SHELL := /bin/sh

.PHONY: help check test dev token token-dev docker-up docker-down

help:
	@echo "Available targets:"
	@echo "  make check         - Run TypeScript checks"
	@echo "  make test          - Run backend tests"
	@echo "  make dev           - Start frontend dev server"
	@echo "  make token         - Generate one JWT (ROLE=analyst SUB=dev-user)"
	@echo "  make token-dev     - Generate read-only/analyst/admin JWTs"
	@echo "  make docker-up     - Start app + db with Docker Compose"
	@echo "  make docker-down   - Stop Docker Compose services"

check:
	pnpm check

test:
	pnpm test

dev:
	pnpm dev

token:
	pnpm token:generate -- --role $${ROLE-analyst} --sub $${SUB-dev-user}

token-dev:
	pnpm token:generate:dev -- $${EXPIRY-1d} $${PREFIX-dev}

docker-up:
	docker compose up --build

docker-down:
	docker compose down
