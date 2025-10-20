#!/usr/bin/env bash
uvicorn adv_backend.app.main:app --host 127.0.0.1 --port 8000 --reload
