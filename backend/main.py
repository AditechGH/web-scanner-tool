from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create the FastAPI app instance
app = FastAPI()

# Configure CORS (Cross-Origin Resource Sharing)
# This allows the frontend (running on localhost:5173)
# to communicate with this backend (running on localhost:8000).
origins = [
    "http://localhost:5173",  # Default Vite dev port
    "http://localhost:3000",  # Common alternative (e.g., Create React App)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


@app.get("/api")
async def root():
    """
    Test endpoint to confirm the API is running.
    """
    return {"message": "Hello from the Secret Hunter API!"}