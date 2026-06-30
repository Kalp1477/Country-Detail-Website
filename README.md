GeoInsight Explorer 🌍⚖️
An interactive, high-performance full-stack web application for geopolitical intelligence, mapping, data analytics, and quiz trivia. Built using a modern React frontend with Leaflet.js, and a robust FastAPI backend leveraging Pandas, SQLite, and JWT authentication.

🚀 Features
🗺️ 1. Interactive Geospatial Mapping
Theme Synchronization: Auto-swaps base maps between CartoDB Dark Matter, CartoDB Light Gray, and ESRI Satellite based on system themes.
Geospatial Interoperability: Interactive boundary outlines (neon highlights) with smooth flyTo camera panning, center popups, and adjacency badges for instant teleportation.
Day/Night Terminator Shadow: Projects a real-time astronomical shadow layer showing the Earth's current night hemisphere, updating every 60 seconds.
Ticking Timezone Clock: Hovering over any country displays a floating card showing its UTC offset, current local ticking time, and day/night status.
📊 2. Geopolitical Analytics & Comparison
Pandas-Powered Engine: Explores population densities, wealth distribution coefficients (Gini index), and currency webs (countries sharing identical currencies).
Side-by-Side Comparison: Allows users to select two countries and compare vital statistics side-by-side.
Demographic Bar Charts: Visualizes relative demographic percentages (population, land area, density, border count) using custom, theme-aware horizontal bars.
🎮 3. Geopolitical Trivia & Map Quiz Game
Scoped Focus Filters: Focus the quiz globally, on a specific continent, or on a single target country.
Single-Country Focus: Test your knowledge on a specific country's capital, flag, currency, population, and land area.
SQL Leaderboard: Authenticated users enjoy zero-friction auto-score submission that logs results immediately to the global rankings list.
🔒 4. User Personalization & Watchlist
Secure Auth: Token-based login and registration using standard bcrypt password hashing and JWT access tokens.
Travel Watchlist: Save countries to a persistent horizontal watchlist row for quick access.
Private Notes: Save custom trip details, flight itineraries, or notes for any country.
🛠️ Tech Stack
Frontend: React (Vite), Leaflet.js, HTML5/CSS3 (Glassmorphism design system)
Backend: FastAPI (Python 3), Uvicorn, Pandas (Data Analytics Engine)
Database & Auth: SQLite, SQLAlchemy, Bcrypt, PyJWT
External Data Mappers: REST Countries v5 API, Natural Earth GeoJSON boundaries, fallback GitHub repos.
📂 Directory Structure
text

├── backend/
│   ├── app/
│   │   ├── analytics.py    # Pandas Geopolitical Engine calculations
│   │   ├── auth.py         # Password hashing & JWT token validation
│   │   ├── database.py     # SQLite and SQLAlchemy session configuration
│   │   ├── models.py       # SQL schema for Users, Notes, and Scores
│   │   └── main.py         # API routes, caching, and startup adapters
│   ├── data/               # Local JSON backups for offline boots
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Analytics.jsx       # Global Insights dashboard
│   │   │   ├── CountryComparison.jsx # Side-by-side comparison charts
│   │   │   ├── Map.jsx             # Leaflet.js maps & clock overlays
│   │   │   └── TriviaGame.jsx      # Trivia engine and leaderboards
│   │   ├── App.jsx         # Main dashboard layout and state coordination
│   │   └── index.css       # Glassmorphism design tokens & styles
│   └── package.json        # NPM dependencies
└── README.md
⚙️ Installation & Setup
Prerequisites
Node.js (v18+)
Python (3.9+)
1. Backend Setup
Navigate into the backend folder:
bash

cd backend
Create and activate a Python virtual environment:
Windows:
bash

python -m venv .venv
.\.venv\Scripts\activate
macOS/Linux:
bash

python3 -m venv .venv
source .venv/bin/activate
Install dependencies:
bash

pip install -r requirements.txt
Start the FastAPI server:
bash

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
2. Frontend Setup
Open a new terminal and navigate into the frontend folder:
bash

cd frontend
Install npm packages:
bash

npm install
Start the Vite development server:
bash

npm run dev
Open the displayed local URL (e.g. http://localhost:5173/ or 5174) in your browser.
💻 VS Code Automation
To start both servers with a single shortcut in VS Code, create a .vscode/tasks.json file in the root directory:

json

{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Backend",
      "type": "shell",
      "command": ".venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000",
      "options": {
        "cwd": "${workspaceFolder}/backend"
      },
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "Start Frontend",
      "type": "shell",
      "command": "npm run dev",
      "options": {
        "cwd": "${workspaceFolder}/frontend"
      },
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "Start App",
      "dependsOn": [
        "Start Backend",
        "Start Frontend"
      ],
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": []
    }
  ]
}
Press Ctrl + Shift + B and select Start App to boot both servers instantly.
