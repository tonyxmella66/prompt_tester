from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from openai import OpenAI
import logging
import sys
from datetime import datetime
from typing import Optional
from collections import defaultdict
import time
from supabase import create_client, Client
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)

logger = logging.getLogger(__name__)

client = OpenAI()

# Supabase configuration
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN")
# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# JWT configuration
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 10  # Max requests per minute per user
RATE_LIMIT_WINDOW = 60  # Time window in seconds
user_request_counts = defaultdict(list)

MODELS = [
    "gpt-4",
    "gpt-4-turbo",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4.5-preview",
    # Reasoning
    "o1-preview",
    "o1-mini",
    "o1",
    "o3-mini",
    "o3",
    "o3-pro",
    "o4-mini",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano"
]


class ModelRequest(BaseModel):
    prompt: str
    model: str
    temperature: float = Field(ge=0, le=2)
    web_search: bool


def verify_supabase_token(token: str) -> Optional[dict]:
    """Verify Supabase JWT token using Supabase client"""
    try:
        # Use Supabase client to verify the token
        response = supabase.auth.get_user(token)
        
        if response.user:
            # Return the user data
            return {
                "sub": response.user.id,
                "email": response.user.email,
                "aud": "authenticated",
                "role": "authenticated"
            }
        else:
            logger.warning("Invalid token - no user found")
            return None
            
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None


def check_rate_limit(user_id: str) -> bool:
    """Check if user has exceeded rate limit"""
    current_time = time.time()
    
    # Clean old requests outside the time window
    user_request_counts[user_id] = [
        req_time for req_time in user_request_counts[user_id]
        if current_time - req_time < RATE_LIMIT_WINDOW
    ]
    
    # Check if user has exceeded the limit
    if len(user_request_counts[user_id]) >= RATE_LIMIT_REQUESTS:
        return False
    
    # Add current request
    user_request_counts[user_id].append(current_time)
    return True


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    token = credentials.credentials
    payload = verify_supabase_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload


app = FastAPI(title="Prompt Tester API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    logger.info("Health check requested")
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/invoke_model")
async def invoke_model(request: ModelRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get('sub', 'unknown')
    user_email = current_user.get('email', 'unknown')
    
    # Check rate limit
    if not check_rate_limit(user_id):
        logger.warning(f"Rate limit exceeded for user {user_email}")
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_WINDOW} seconds."
        )
    
    logger.info(f"Model request received from user {user_email} - Model: {request.model}, temperature: {request.temperature}, web search: {request.web_search}")
    
    if request.model not in MODELS:
        error_msg = f"Model '{request.model}' is not found in the list of models. Allowed models: {MODELS}"
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    
    logger.info(f"Making OpenAI API call with model: {request.model}")
    tools = []
    if request.web_search:
        tools=[{ "type": "web_search_preview" }]
    
    try:
        response = client.responses.create(
            model=request.model,
            input=request.prompt,
            tools=tools
        )
        logger.info(f"OpenAI API call successful for model: {request.model}")
        return response
    except Exception as e:
        logger.error(f"OpenAI API call failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process request with OpenAI")
