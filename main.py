from fastapi import FastAPI

app = FastAPI(title="Hello from Mac")

@app.get("/")
def root():
    return {"ok": True, "msg": "FastAPI running on Mac 🎉"}

@app.get("/health")
def health():
    return {"status": "healthy"}
