import os
import json
import logging
import urllib.request
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from . import models, auth, analytics

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GeoExplorer")

# Database setup
Base.metadata.create_all(bind=engine)

# In-memory caches
countries_cache: List[Dict[str, Any]] = []
geojson_cache: Dict[str, Any] = {}
pandas_df = None

API_KEY = "rc_live_ec2d4f1d53de4f67a1062d3794d944f6"
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

COUNTRIES_BACKUP_PATH = os.path.join(DATA_DIR, "countries_backup.json")
GEOJSON_BACKUP_PATH = os.path.join(DATA_DIR, "geojson_backup.json")


def map_v5_country(c: dict) -> dict:
    names = c.get("names", {})
    codes = c.get("codes", {})
    capitals = c.get("capitals", [])
    flag = c.get("flag", {})
    area_dict = c.get("area", {})
    coords = c.get("coordinates", {})
    classification = c.get("classification", {})
    economy = c.get("economy", {})
    
    # Convert currencies: v5 list of dict to dict
    currencies = {}
    for curr in c.get("currencies", []):
        code = curr.get("code")
        if code:
            currencies[code] = {
                "name": curr.get("name", ""),
                "symbol": curr.get("symbol", "")
            }
            
    # Convert languages: v5 list of dict to dict
    languages = {}
    for lang in c.get("languages", []):
        code = lang.get("iso639_1") or lang.get("bcp47") or lang.get("iso639_3")
        if code:
            languages[code] = lang.get("name", "")
            
    capital = [cap.get("name") for cap in capitals if cap.get("name")]
    
    latlng = []
    if coords.get("lat") is not None and coords.get("lng") is not None:
        latlng = [coords.get("lat"), coords.get("lng")]
    elif capitals and capitals[0].get("coordinates"):
        cap_coords = capitals[0]["coordinates"]
        latlng = [cap_coords.get("lat"), cap_coords.get("lng")]
        
    cca3 = codes.get("alpha_3") or c.get("cca3", "")
    if not cca3:
        common_name = names.get("common", "")
        if "Northern Cyprus" in common_name:
            cca3 = "NCY"
        elif "Somaliland" in common_name:
            cca3 = "SML"
        elif "Abkhazia" in common_name:
            cca3 = "ABH"
        else:
            cca3 = common_name[:3].upper() if common_name else "UNK"
        
    cca2 = codes.get("alpha_2") or c.get("cca2", "")
    cca2_lower = cca2.lower() if cca2 else ""

    return {
        "name": {
            "common": names.get("common", ""),
            "official": names.get("official", "")
        },
        "cca3": cca3,
        "cca2": cca2,
        "capital": capital,
        "currencies": currencies,
        "region": c.get("region", ""),
        "subregion": c.get("subregion", ""),
        "languages": languages,
        "latlng": latlng,
        "borders": c.get("borders", []),
        "area": area_dict.get("kilometers", 0.0) if isinstance(area_dict, dict) else float(area_dict or 0),
        "population": c.get("population", 0),
        "continents": c.get("continents", []),
        "flags": {
            "png": f"https://flagcdn.com/w320/{cca2_lower}.png" if cca2_lower else "",
            "svg": f"https://flagcdn.com/{cca2_lower}.svg" if cca2_lower else ""
        },
        "emoji": flag.get("emoji") or "",
        "gini": economy.get("gini_coefficient") or {},
        "unMember": classification.get("un_member", True),
        "timezones": c.get("timezones") or []
    }


def map_v3_country(c: dict) -> dict:
    cca2 = c.get("cca2", "")
    cca2_lower = cca2.lower() if cca2 else ""
    
    cca3 = c.get("cca3") or c.get("codes", {}).get("alpha_3", "")
    if not cca3:
        common_name = c.get("name", {}).get("common", "")
        if "Northern Cyprus" in common_name:
            cca3 = "NCY"
        elif "Somaliland" in common_name:
            cca3 = "SML"
        elif "Abkhazia" in common_name:
            cca3 = "ABH"
        else:
            cca3 = common_name[:3].upper() if common_name else "UNK"
        
    # Extract flags
    flags = {
        "png": f"https://flagcdn.com/w320/{cca2_lower}.png" if cca2_lower else "",
        "svg": f"https://flagcdn.com/{cca2_lower}.svg" if cca2_lower else ""
    }

    return {
        "name": {
            "common": c.get("name", {}).get("common", ""),
            "official": c.get("name", {}).get("official", "")
        },
        "cca3": cca3,
        "cca2": cca2,
        "capital": c.get("capital") or [],
        "currencies": c.get("currencies") or {},
        "region": c.get("region", ""),
        "subregion": c.get("subregion", ""),
        "languages": c.get("languages") or {},
        "latlng": c.get("latlng") or [],
        "borders": c.get("borders") or [],
        "area": float(c.get("area") or 0.0),
        "population": c.get("population", 0),
        "continents": c.get("continents") or [c.get("region", "")],
        "flags": flags,
        "emoji": c.get("flag") if isinstance(c.get("flag"), str) and len(c.get("flag")) <= 4 else "",
        "gini": c.get("gini") or {},
        "unMember": c.get("unMember", True),
        "timezones": c.get("timezones") or []
    }


def fetch_v5_countries() -> List[Dict[str, Any]]:
    logger.info("Attempting to fetch countries from REST Countries v5 API...")
    countries = []
    offset = 0
    limit = 100
    while True:
        url = f"https://api.restcountries.com/countries/v5?limit={limit}&offset={offset}"
        req = urllib.request.Request(
            url, 
            headers={'Authorization': f'Bearer {API_KEY}', 'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            objects = res_data['data']['objects']
            countries.extend(objects)
            meta = res_data['data']['meta']
            if not meta.get('more') or len(objects) == 0:
                break
            offset += limit
    
    # Map to unified schema
    mapped = [map_v5_country(c) for c in countries]
    logger.info(f"Successfully fetched and mapped {len(mapped)} countries from REST Countries v5 API.")
    return mapped


def fetch_fallback_countries() -> List[Dict[str, Any]]:
    logger.info("Attempting to fetch from backup mledoze repository...")
    url = "https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        countries = json.loads(response.read().decode())
    
    mapped = [map_v3_country(c) for c in countries]
    logger.info(f"Successfully fetched and mapped {len(mapped)} countries from mledoze repo.")
    return mapped


def fetch_geojson() -> Dict[str, Any]:
    logger.info("Attempting to fetch GeoJSON from Natural Earth repository...")
    url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        geojson = json.loads(response.read().decode())
    logger.info("Successfully fetched world boundaries GeoJSON.")
    return geojson


@asynccontextmanager
async def lifespan(app: FastAPI):
    global countries_cache, geojson_cache, pandas_df
    
    # 1. Fetch Country Details
    try:
        countries_cache = fetch_v5_countries()
        # Save local backup
        with open(COUNTRIES_BACKUP_PATH, "w", encoding="utf-8") as f:
            json.dump(countries_cache, f, ensure_ascii=False, indent=2)
        logger.info("Saved local countries cache backup.")
    except Exception as e:
        logger.warning(f"Failed to fetch from REST Countries v5 API: {e}")
        try:
            countries_cache = fetch_fallback_countries()
            # Save local backup
            with open(COUNTRIES_BACKUP_PATH, "w", encoding="utf-8") as f:
                json.dump(countries_cache, f, ensure_ascii=False, indent=2)
            logger.info("Saved local countries cache backup from fallback.")
        except Exception as e2:
            logger.warning(f"Failed to fetch from fallback repo: {e2}")
            # Load from local backup file
            if os.path.exists(COUNTRIES_BACKUP_PATH):
                logger.info("Loading countries from local backup file...")
                with open(COUNTRIES_BACKUP_PATH, "r", encoding="utf-8") as f:
                    countries_cache = json.load(f)
                logger.info(f"Loaded {len(countries_cache)} countries from local backup.")
            else:
                logger.error("No countries data available! App may fail.")
                
    # 2. Fetch GeoJSON Boundaries
    try:
        geojson_cache = fetch_geojson()
        with open(GEOJSON_BACKUP_PATH, "w", encoding="utf-8") as f:
            json.dump(geojson_cache, f, ensure_ascii=False)
        logger.info("Saved local GeoJSON cache backup.")
    except Exception as e:
        logger.warning(f"Failed to fetch GeoJSON online: {e}")
        if os.path.exists(GEOJSON_BACKUP_PATH):
            logger.info("Loading GeoJSON from local backup file...")
            with open(GEOJSON_BACKUP_PATH, "r", encoding="utf-8") as f:
                geojson_cache = json.load(f)
            logger.info("Loaded GeoJSON from local backup.")
        else:
            logger.error("No GeoJSON boundaries available!")
            
    # 3. Load Pandas DataFrame
    if countries_cache:
        pandas_df = analytics.load_dataframe(countries_cache)
        logger.info("Pandas Geopolitical Engine initialized successfully.")
        
    yield


app = FastAPI(
    title="GeoInsight Explorer API",
    description="Backend API for countries database, mapping, and geopolitical insights",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Schemas
class UserRegister(BaseModel):
    username: str
    password: str

class ToggleFavorite(BaseModel):
    country_code: str

class SaveNote(BaseModel):
    country_code: str
    content: str

class ScoreSubmit(BaseModel):
    score: int
    total_questions: int = 5


# Authentication Endpoints
@app.post("/api/auth/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if username exists
    existing_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    hashed_pwd = auth.get_password_hash(user_data.password)
    new_user = models.User(username=user_data.username, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate token
    token = auth.create_access_token(data={"sub": new_user.username})
    return {"access_token": token, "token_type": "bearer", "username": new_user.username}


@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username}


# Countries & Boundaries Cache Endpoints
@app.get("/api/countries")
def get_countries():
    if not countries_cache:
        raise HTTPException(status_code=503, detail="Country data cache is empty or loading.")
    return countries_cache


@app.get("/api/geojson")
def get_geojson_boundaries():
    if not geojson_cache:
        raise HTTPException(status_code=503, detail="GeoJSON boundaries cache is empty or loading.")
    return geojson_cache


# User Notes and Favorites
@app.get("/api/favorites")
def get_favorites(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    favs = db.query(models.Favorite).filter(models.Favorite.user_id == current_user.id).all()
    return [f.country_code for f in favs]


@app.post("/api/favorites/toggle")
def toggle_favorite(data: ToggleFavorite, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    code = data.country_code.upper()
    existing = db.query(models.Favorite).filter(
        models.Favorite.user_id == current_user.id,
        models.Favorite.country_code == code
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"favorited": False, "country_code": code}
    else:
        new_fav = models.Favorite(user_id=current_user.id, country_code=code)
        db.add(new_fav)
        db.commit()
        return {"favorited": True, "country_code": code}


@app.get("/api/notes")
def get_note(country_code: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    code = country_code.upper()
    note = db.query(models.Note).filter(
        models.Note.user_id == current_user.id,
        models.Note.country_code == code
    ).first()
    return {"content": note.content if note else ""}


@app.post("/api/notes")
def save_note(data: SaveNote, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    code = data.country_code.upper()
    existing = db.query(models.Note).filter(
        models.Note.user_id == current_user.id,
        models.Note.country_code == code
    ).first()
    
    if existing:
        existing.content = data.content
        db.commit()
        db.refresh(existing)
        return {"content": existing.content, "updated_at": existing.updated_at}
    else:
        new_note = models.Note(user_id=current_user.id, country_code=code, content=data.content)
        db.add(new_note)
        db.commit()
        db.refresh(new_note)
        return {"content": new_note.content, "updated_at": new_note.updated_at}


# Geopolitical Analytics Endpoints
@app.get("/api/analytics/density")
def get_density():
    if pandas_df is None:
        raise HTTPException(status_code=503, detail="Analytics engine not initialized.")
    try:
        res = analytics.get_most_dense_countries(pandas_df)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/land-ratios")
def get_land_ratios():
    if pandas_df is None:
        raise HTTPException(status_code=503, detail="Analytics engine not initialized.")
    try:
        res = analytics.get_land_to_pop_metrics(pandas_df)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/currency-web")
def get_currency_web():
    if pandas_df is None:
        raise HTTPException(status_code=503, detail="Analytics engine not initialized.")
    try:
        res = analytics.get_currency_web(pandas_df)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Trivia / Quiz Game Endpoints
import random
import math

def get_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(d_lon / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def get_maritime_neighbors(target: dict, all_countries: list, num_neighbors: int = 4) -> list:
    target_coords = target.get("latlng")
    if not target_coords or len(target_coords) != 2:
        return []
    lat1, lon1 = target_coords[0], target_coords[1]
    land_borders = target.get("borders") or []
    
    candidates = []
    for c in all_countries:
        if c.get("cca3") == target.get("cca3"):
            continue
        if c.get("cca3") in land_borders:
            continue
        c_coords = c.get("latlng")
        if not c_coords or len(c_coords) != 2:
            continue
        dist = get_distance(lat1, lon1, c_coords[0], c_coords[1])
        candidates.append((c, dist))
        
    candidates.sort(key=lambda x: x[1])
    return [item[0] for item in candidates[:num_neighbors]]

def generate_trivia_questions(
    countries: list, 
    num_questions: int = 5, 
    continent: Optional[str] = None, 
    country_code: Optional[str] = None
) -> list:
    valid_countries = [
        c for c in countries 
        if c.get("name", {}).get("common") and c.get("capital") and len(c.get("capital")) > 0
    ]
    if len(valid_countries) < 10:
        valid_countries = countries
        
    if country_code:
        # Generate targeted single country focus questions
        target = next((c for c in valid_countries if c["cca3"].upper() == country_code.upper()), None)
        if target:
            # Regional pool for distractors
            target_continents = target.get("continents") or []
            regional_pool = [
                c for c in valid_countries 
                if c["cca3"] != target["cca3"] and any(cont in (c.get("continents") or []) for cont in target_continents)
            ]
            if len(regional_pool) < 10:
                regional_pool = [c for c in valid_countries if c["cca3"] != target["cca3"]]
                
            questions = []
            
            # 1. Capital Question
            correct_capital = target["capital"][0] if target.get("capital") else "N/A"
            other_capitals = list({
                c["capital"][0] for c in regional_pool 
                if c.get("capital") and len(c.get("capital")) > 0
            })
            distractors = random.sample(other_capitals, min(3, len(other_capitals)))
            options = distractors + [correct_capital]
            random.shuffle(options)
            questions.append({
                "id": 1,
                "type": "capital",
                "cca3": target["cca3"],
                "questionText": f"What is the capital of {target['name']['common']}?",
                "options": options,
                "correctAnswer": correct_capital
            })
            
            # 2. Flag Question
            correct_name = target["name"]["common"]
            other_names = list({c["name"]["common"] for c in regional_pool})
            distractors = random.sample(other_names, min(3, len(other_names)))
            options = distractors + [correct_name]
            random.shuffle(options)
            questions.append({
                "id": 2,
                "type": "flag",
                "cca3": target["cca3"],
                "questionText": f"Which country does this flag belong to?",
                "flagUrl": target["flags"]["png"] if target.get("flags") else "",
                "options": options,
                "correctAnswer": correct_name
            })
            
            # 3. Currency Question
            target_currencies = target.get("currencies") or {}
            curr_names = [curr.get("name") for curr in target_currencies.values() if curr.get("name")]
            correct_currency = curr_names[0] if curr_names else "N/A"
            
            other_currencies = []
            for c in regional_pool:
                c_currs = [curr.get("name") for curr in (c.get("currencies") or {}).values() if curr.get("name")]
                if c_currs and c_currs[0] != correct_currency:
                    other_currencies.append(c_currs[0])
            other_currencies = list(set(other_currencies))
            distractors = random.sample(other_currencies, min(3, len(other_currencies)))
            options = distractors + [correct_currency]
            random.shuffle(options)
            questions.append({
                "id": 3,
                "type": "capital",
                "cca3": target["cca3"],
                "questionText": f"What is the official currency of {target['name']['common']}?",
                "options": options,
                "correctAnswer": correct_currency
            })
            
            # 4. Population Question
            correct_pop = f"{target.get('population', 0):,}"
            other_pops = []
            for c in regional_pool:
                if c.get("population"):
                    other_pops.append(f"{c['population']:,}")
            other_pops = list(set(other_pops))
            distractors = random.sample(other_pops, min(3, len(other_pops)))
            options = distractors + [correct_pop]
            random.shuffle(options)
            questions.append({
                "id": 4,
                "type": "capital",
                "cca3": target["cca3"],
                "questionText": f"What is the approximate population of {target['name']['common']}?",
                "options": options,
                "correctAnswer": correct_pop
            })
            
            # 5. Land Area Question
            correct_area = f"{int(target.get('area', 0)):,} sq km"
            other_areas = []
            for c in regional_pool:
                if c.get("area"):
                    other_areas.append(f"{int(c['area']):,} sq km")
            other_areas = list(set(other_areas))
            distractors = random.sample(other_areas, min(3, len(other_areas)))
            options = distractors + [correct_area]
            random.shuffle(options)
            questions.append({
                "id": 5,
                "type": "map",
                "cca3": target["cca3"],
                "questionText": f"What is the total land area of {target['name']['common']}?",
                "options": options,
                "correctAnswer": correct_area
            })
            
            return questions

    # Determine the target pool
    target_pool = valid_countries
    
    if continent:
        def match_continent(c):
            c_continents = c.get("continents") or []
            if continent == "Americas":
                return "North America" in c_continents or "South America" in c_continents
            return continent in c_continents
            
        filtered = [c for c in valid_countries if match_continent(c)]
        if len(filtered) >= 5:
            target_pool = filtered
            
    questions = []
    types = ["flag", "capital", "map"]
    
    targets = random.sample(target_pool, min(num_questions, len(target_pool)))
        
    for i, target in enumerate(targets):
        q_type = random.choice(types)
        
        if q_type == "flag" and not (target.get("flags") and target["flags"].get("png")):
            q_type = random.choice(["capital", "map"])
            
        correct_name = target["name"]["common"]
        
        # Distractors pool
        if continent:
            distractor_pool = target_pool
        else:
            distractor_pool = valid_countries

        if q_type == "capital":
            correct_answer = target["capital"][0]
            question_text = f"What is the capital of {correct_name}?"
            other_capitals = list({
                c["capital"][0] for c in distractor_pool 
                if c["cca3"] != target["cca3"] and c.get("capital") and len(c.get("capital")) > 0
            })
            distractors = random.sample(other_capitals, min(3, len(other_capitals)))
            options = distractors + [correct_answer]
            random.shuffle(options)
            
            questions.append({
                "id": i + 1,
                "type": q_type,
                "cca3": target["cca3"],
                "questionText": question_text,
                "options": options,
                "correctAnswer": correct_answer
            })
        elif q_type == "flag":
            correct_answer = correct_name
            question_text = "Which country does this flag belong to?"
            other_names = list({
                c["name"]["common"] for c in distractor_pool 
                if c["cca3"] != target["cca3"]
            })
            distractors = random.sample(other_names, min(3, len(other_names)))
            options = distractors + [correct_answer]
            random.shuffle(options)
            
            questions.append({
                "id": i + 1,
                "type": q_type,
                "cca3": target["cca3"],
                "questionText": question_text,
                "flagUrl": target["flags"]["png"],
                "options": options,
                "correctAnswer": correct_answer
            })
        else: # map
            correct_answer = correct_name
            question_text = "Which country is highlighted in purple on the map?"
            other_names = list({
                c["name"]["common"] for c in distractor_pool 
                if c["cca3"] != target["cca3"]
            })
            distractors = random.sample(other_names, min(3, len(other_names)))
            options = distractors + [correct_answer]
            random.shuffle(options)
            
            questions.append({
                "id": i + 1,
                "type": q_type,
                "cca3": target["cca3"],
                "questionText": question_text,
                "options": options,
                "correctAnswer": correct_answer
            })
            
    return questions


@app.get("/api/quiz/questions")
def get_quiz_questions(continent: Optional[str] = None, country_code: Optional[str] = None):
    if not countries_cache:
        raise HTTPException(status_code=503, detail="Country data cache is empty or loading.")
    try:
        return generate_trivia_questions(countries_cache, continent=continent, country_code=country_code)
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate trivia questions.")


@app.post("/api/quiz/scores")
def submit_score(data: ScoreSubmit, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    try:
        new_score = models.Score(
            user_id=current_user.id,
            score=data.score,
            total_questions=data.total_questions
        )
        db.add(new_score)
        db.commit()
        db.refresh(new_score)
        return {"message": "Score saved successfully!", "score": new_score.score}
    except Exception as e:
        logger.error(f"Error saving score: {e}")
        raise HTTPException(status_code=500, detail="Failed to save score.")


@app.get("/api/quiz/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    try:
        results = db.query(models.Score, models.User.username)\
            .join(models.User, models.Score.user_id == models.User.id)\
            .order_by(models.Score.score.desc(), models.Score.created_at.desc())\
            .limit(10)\
            .all()
            
        leaderboard = []
        for score_obj, username in results:
            leaderboard.append({
                "username": username,
                "score": score_obj.score,
                "total_questions": score_obj.total_questions,
                "created_at": score_obj.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        return leaderboard
    except Exception as e:
        logger.error(f"Error loading leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to load leaderboard.")

