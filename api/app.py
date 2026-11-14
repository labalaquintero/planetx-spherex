from fastapi import FastAPI

app = FastAPI(title="Planet X / SPHEREx")

@app.get("/api/health")
def health():
    return {"status": "ok"}
