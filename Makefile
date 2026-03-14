.PHONY: test-up test test-down test-coverage test-fast test-musdb musdb-download

# Start test infrastructure containers
test-up:
	docker compose up -d --wait
	@echo "Waiting for services to be healthy..."
	@sleep 2

# Run full test suite
test: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/ -v --asyncio-mode=auto

# Run tests without starting containers (assumes they're already running)
test-fast:
	cd backend && ENV_FILE=../.env.test pytest tests/ -v --asyncio-mode=auto

# Run with coverage report
test-coverage: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/ -v --asyncio-mode=auto \
		--cov=app \
		--cov-report=html:htmlcov \
		--cov-report=term-missing \
		--cov-fail-under=70

# Stop and remove test containers + volumes
test-down:
	docker compose down -v

# Download MUSDB18 sample dataset for real audio testing
musdb-download:
	pip install musdb soundfile numpy
	python -c "import musdb; musdb.DB(download=True, root='test_audio/musdb18')"

# Run MUSDB tests only (real audio)
test-musdb: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/test_musdb.py -v --asyncio-mode=auto -m musdb

# Run model evaluation tests (requires GPU + demucs + musdb)
test-model-eval:
	cd backend && pytest tests/test_model_eval.py -v --asyncio-mode=auto -m model_eval

# Run a specific test file
test-auth: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/test_auth.py -v --asyncio-mode=auto

test-separation: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/test_separation.py -v --asyncio-mode=auto

test-credits: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/test_credits.py -v --asyncio-mode=auto

test-admin: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/test_admin.py -v --asyncio-mode=auto

test-e2e: test-up
	cd backend && ENV_FILE=../.env.test pytest tests/test_e2e.py -v --asyncio-mode=auto
