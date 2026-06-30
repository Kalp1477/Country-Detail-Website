import React, { useEffect, useState } from "react";
import Map from "./components/Map";
import Analytics from "./components/Analytics";
import TriviaGame from "./components/TriviaGame";
import CountryComparison from "./components/CountryComparison";

const API_BASE = "http://localhost:8000/api";

// Geodesic distance calculator (Haversine formula) in kilometers
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("geo_theme") || "dark");
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem("geo_theme", theme);
  }, [theme]);

  const getMaritimeNeighbors = (country) => {
    if (!country || !country.latlng || country.latlng.length !== 2) return [];
    const [lat1, lon1] = country.latlng;
    const landBorders = country.borders || [];

    return countries
      .filter(
        (c) =>
          c.cca3 !== country.cca3 &&
          !landBorders.includes(c.cca3) &&
          c.latlng &&
          c.latlng.length === 2
      )
      .map((c) => {
        const dist = getDistance(lat1, lon1, c.latlng[0], c.latlng[1]);
        return { ...c, distance: dist };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4); // nearest 4
  };
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeContinent, setActiveContinent] = useState("All");
  const [sortBy, setSortBy] = useState("name"); // 'name' | 'population' | 'area'
  const [filterLandlocked, setFilterLandlocked] = useState(false);
  const [filterUnMember, setFilterUnMember] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Trivia Quiz state
  const [showTrivia, setShowTrivia] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [quizHighlightCode, setQuizHighlightCode] = useState(null);

  // Auth & Personalization state
  const [user, setUser] = useState(null); // { username, token }
  const [favorites, setFavorites] = useState([]); // List of CCA3 codes
  const [selectedCountryNote, setSelectedCountryNote] = useState("");
  const [notesStatus, setNotesStatus] = useState("");
  
  // Auth Form toggles
  const [showAuthBox, setShowAuthBox] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Analytics modal toggle
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Load countries on mount
  useEffect(() => {
    fetch(`${API_BASE}/countries?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load countries");
        return res.json();
      })
      .then((data) => {
        // Sort countries alphabetically by common name
        const sorted = data.sort((a, b) => a.name.common.localeCompare(b.name.common));
        setCountries(sorted);
        setFilteredCountries(sorted);
      })
      .catch((err) => console.error("Error loading countries:", err));

    // Restore user session from localStorage
    const savedUser = localStorage.getItem("geo_user");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        fetchFavorites(userData.access_token);
      } catch (e) {
        localStorage.removeItem("geo_user");
      }
    }
  }, []);

  // Filter and sort countries when query, continent, sort, or structural filters change
  useEffect(() => {
    let result = countries;

    // Apply continent filter
    if (activeContinent !== "All") {
      result = result.filter((c) => {
        if (!c.continents) return false;
        if (activeContinent === "Americas") {
          return c.continents.includes("North America") || c.continents.includes("South America");
        }
        return c.continents.includes(activeContinent);
      });
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.common.toLowerCase().includes(query) ||
          c.cca3.toLowerCase().includes(query) ||
          (c.capital && c.capital.some((cap) => cap.toLowerCase().includes(query)))
      );
    }

    // Apply landlocked filter
    if (filterLandlocked) {
      result = result.filter((c) => !c.borders || c.borders.length === 0);
    }

    // Apply UN member filter
    if (filterUnMember) {
      result = result.filter((c) => c.unMember === true);
    }

    // Apply sorting (create a shallow copy first to avoid mutating original state)
    const sortedResult = [...result];
    if (sortBy === "name") {
      sortedResult.sort((a, b) => a.name.common.localeCompare(b.name.common));
    } else if (sortBy === "population") {
      sortedResult.sort((a, b) => b.population - a.population);
    } else if (sortBy === "area") {
      sortedResult.sort((a, b) => b.area - a.area);
    }

    setFilteredCountries(sortedResult);
  }, [searchQuery, activeContinent, countries, sortBy, filterLandlocked, filterUnMember]);

  // Load note when selectedCountry changes (and user is logged in)
  useEffect(() => {
    if (!selectedCountry) {
      setSelectedCountryNote("");
      setNotesStatus("");
      return;
    }

    if (!user) {
      setSelectedCountryNote("");
      setNotesStatus("");
      return;
    }

    fetch(`${API_BASE}/notes?country_code=${selectedCountry.cca3}`, {
      headers: {
        Authorization: `Bearer ${user.access_token}`
      }
    })
      .then((res) => res.json())
      .then((data) => {
        setSelectedCountryNote(data.content || "");
        setNotesStatus("");
      })
      .catch((err) => console.error("Error fetching note:", err));
  }, [selectedCountry, user]);

  const fetchFavorites = (token) => {
    fetch(`${API_BASE}/favorites`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setFavorites(data);
      })
      .catch((err) => console.error("Error loading favorites:", err));
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError("");

    if (!authUsername || !authPassword) {
      setAuthError("Please fill out all fields.");
      return;
    }

    const endpoint = authMode === "login" ? "login" : "register";
    
    // For standard login FastAPI OAuth2 uses Form data, for register we use JSON.
    let body;
    let headers = {};
    
    if (endpoint === "login") {
      const formData = new URLSearchParams();
      formData.append("username", authUsername);
      formData.append("password", authPassword);
      body = formData;
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else {
      body = JSON.stringify({ username: authUsername, password: authPassword });
      headers["Content-Type"] = "application/json";
    }

    fetch(`${API_BASE}/auth/${endpoint}`, {
      method: "POST",
      headers,
      body
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((d) => {
            throw new Error(d.detail || "Authentication failed");
          });
        }
        return res.json();
      })
      .then((data) => {
        const session = {
          username: data.username,
          access_token: data.access_token
        };
        localStorage.setItem("geo_user", JSON.stringify(session));
        setUser(session);
        fetchFavorites(data.access_token);
        
        // Reset form
        setAuthUsername("");
        setAuthPassword("");
        setShowAuthBox(false);
      })
      .catch((err) => {
        setAuthError(err.message);
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("geo_user");
    setUser(null);
    setFavorites([]);
    setSelectedCountryNote("");
  };

  const handleSelectCountryByCode = (cca3) => {
    const country = countries.find((c) => c.cca3 === cca3.toUpperCase());
    if (country) {
      setSelectedCountry(country);
    }
  };

  const handleToggleFavorite = (cca3) => {
    if (!user) {
      setAuthMode("login");
      setShowAuthBox(true);
      return;
    }

    fetch(`${API_BASE}/favorites/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.access_token}`
      },
      body: JSON.stringify({ country_code: cca3 })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.favorited) {
          setFavorites((prev) => [...prev, cca3]);
        } else {
          setFavorites((prev) => prev.filter((c) => c !== cca3));
        }
      })
      .catch((err) => console.error("Error toggling favorite:", err));
  };

  const handleSaveNote = () => {
    if (!user || !selectedCountry) return;

    fetch(`${API_BASE}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.access_token}`
      },
      body: JSON.stringify({
        country_code: selectedCountry.cca3,
        content: selectedCountryNote
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setNotesStatus("Note saved successfully!");
        setTimeout(() => setNotesStatus(""), 3000);
      })
      .catch((err) => {
        setNotesStatus("Failed to save note.");
        console.error(err);
      });
  };

  // Continents list for quick pills
  const continents = ["All", "Africa", "Americas", "Asia", "Europe", "Oceania"];

  return (
    <div className="app-container">
      {/* Sidebar Layout */}
      <div className="left-panel">
        
        {/* Header */}
        <div className="app-header">
          <h1 className="app-title">GeoInsight</h1>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button 
              className="auth-btn" 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>{theme === "dark" ? "☀️ Light" : "🌙 Dark"}</span>
            </button>
            <button 
              className="auth-btn" 
              onClick={() => setShowAnalytics(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>📊 Insights</span>
            </button>
            <button 
              className="auth-btn" 
              onClick={() => {
                setShowTrivia(!showTrivia);
                setShowComparison(false);
                setSelectedCountry(null);
                setQuizHighlightCode(null);
              }}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px",
                background: showTrivia ? "linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(56, 189, 248, 0.3) 100%)" : "",
                borderColor: showTrivia ? "var(--color-secondary)" : ""
              }}
            >
              <span>🎮 {showTrivia ? "Explore" : "Quiz"}</span>
            </button>
            <button 
              className="auth-btn" 
              onClick={() => {
                setShowComparison(!showComparison);
                setShowTrivia(false);
                setSelectedCountry(null);
                setQuizHighlightCode(null);
              }}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px",
                background: showComparison ? "linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(56, 189, 248, 0.3) 100%)" : "",
                borderColor: showComparison ? "var(--color-secondary)" : ""
              }}
            >
              <span>⚖️ {showComparison ? "Explore" : "Compare"}</span>
            </button>
            {user ? (
              <div className="user-badge">
                <span className="user-name">@{user.username}</span>
                <button className="auth-btn" onClick={handleLogout}>Log Out</button>
              </div>
            ) : (
              <button className="auth-btn" onClick={() => { setShowAuthBox(!showAuthBox); setAuthError(""); }}>
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Auth Dropdown panel */}
        {showAuthBox && !user && (
          <div className="glass-panel auth-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="auth-form-title">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </span>
              <button 
                className="btn-link" 
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              >
                {authMode === "login" ? "Need an account?" : "Have an account?"}
              </button>
            </div>
            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="auth-input-group">
                <input 
                  type="text" 
                  className="auth-input" 
                  placeholder="Username" 
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                />
              </div>
              <div className="auth-input-group">
                <input 
                  type="password" 
                  className="auth-input" 
                  placeholder="Password" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>
              {authError && <span style={{ color: "#ef4444", fontSize: "12px" }}>{authError}</span>}
              <div className="auth-action-row">
                <button type="submit" className="btn-primary">
                  {authMode === "login" ? "Sign In" : "Register"}
                </button>
                <button 
                  type="button" 
                  className="auth-btn" 
                  onClick={() => setShowAuthBox(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showTrivia ? (
          <TriviaGame 
            user={user}
            API_BASE={API_BASE}
            countries={countries}
            onClose={() => {
              setShowTrivia(false);
              setQuizHighlightCode(null);
            }}
            onHighlightCountry={(cca3) => setQuizHighlightCode(cca3)}
          />
        ) : showComparison ? (
          <CountryComparison 
            countries={countries}
            onClose={() => setShowComparison(false)}
          />
        ) : (
          <>
            {/* Watchlist Section */}
            {user && favorites.length > 0 && (
              <div className="watchlist-section glass-panel">
                <h2 className="section-title">My Watchlist</h2>
                <div className="favorites-pills">
                  {favorites.map((cca3) => {
                    const c = countries.find((country) => country.cca3 === cca3);
                    if (!c) return null;
                    return (
                      <button 
                        key={cca3} 
                        className="fav-pill" 
                        onClick={() => setSelectedCountry(c)}
                      >
                        <span>{c.emoji || "📍"}</span>
                        <span>{c.name.common}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected Country Details Panel */}
            {selectedCountry ? (
              <div className="detail-panel glass-panel" style={{ padding: "20px" }}>
                <div className="detail-header-row">
                  <button className="back-btn" onClick={() => setSelectedCountry(null)}>
                    ← Back to List
                  </button>
                  <button 
                    className="fav-toggle-btn" 
                    onClick={() => handleToggleFavorite(selectedCountry.cca3)}
                  >
                    {favorites.includes(selectedCountry.cca3) ? "❤️" : "🤍"}
                  </button>
                </div>
                
                <div className="detail-flag-container">
                  {selectedCountry.flags && selectedCountry.flags.png ? (
                    <img 
                      src={selectedCountry.flags.png} 
                      alt={`${selectedCountry.name.common} flag`}
                      className="detail-flag" 
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '48px', background: 'rgba(255,255,255,0.03)' }}>
                      🗺️
                    </div>
                  )}
                </div>
                
                <div className="detail-name-section">
                  <h2 className="detail-name">{selectedCountry.name.common}</h2>
                  <span className="detail-official-name">{selectedCountry.name.official}</span>
                </div>

                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Capital</span>
                    <span className="detail-value">{selectedCountry.capital.join(", ") || "N/A"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Region</span>
                    <span className="detail-value">{selectedCountry.region} ({selectedCountry.subregion})</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Population</span>
                    <span className="detail-value">{selectedCountry.population.toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Land Area</span>
                    <span className="detail-value">
                      {selectedCountry.area ? `${selectedCountry.area.toLocaleString()} km²` : "N/A"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Currencies</span>
                    <span className="detail-value">
                      {Object.entries(selectedCountry.currencies).map(([code, info]) => (
                        <span key={code} style={{ display: "block" }}>
                          {code} ({info.symbol}) - {info.name}
                        </span>
                      )) || "N/A"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Languages</span>
                    <span className="detail-value">
                      {Object.values(selectedCountry.languages).join(", ") || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Border badges cross-referencing CCA3 codes */}
                <div className="borders-section">
                  <span className="detail-label">Bordering Countries</span>
                  {selectedCountry.borders && selectedCountry.borders.length > 0 ? (
                    <div className="borders-container">
                      {selectedCountry.borders.map((borderCode) => {
                        const borderCountry = countries.find((c) => c.cca3 === borderCode);
                        return (
                          <button 
                            key={borderCode} 
                            className="border-badge" 
                            onClick={() => handleSelectCountryByCode(borderCode)}
                          >
                            <span>{borderCountry?.emoji || "📍"}</span>
                            <span>{borderCountry?.name.common || borderCode}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: "14px", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No land borders (island nation).
                    </span>
                  )}
                </div>

                {/* Maritime / Nearby Neighbors */}
                <div className="borders-section" style={{ marginTop: "8px" }}>
                  <span className="detail-label">Maritime & Nearby Neighbors</span>
                  {getMaritimeNeighbors(selectedCountry).length > 0 ? (
                    <div className="borders-container">
                      {getMaritimeNeighbors(selectedCountry).map((mCountry) => (
                        <button 
                          key={mCountry.cca3} 
                          className="border-badge" 
                          onClick={() => handleSelectCountryByCode(mCountry.cca3)}
                          style={{ 
                            background: "rgba(168, 85, 247, 0.08)", 
                            borderColor: "rgba(168, 85, 247, 0.25)",
                            color: "#c084fc" 
                          }}
                        >
                          <span>{mCountry.emoji || "📍"}</span>
                          <span>{mCountry.name.common}</span>
                          <span style={{ fontSize: "10px", opacity: 0.8, marginLeft: "2px" }}>
                            ({Math.round(mCountry.distance)} km)
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: "14px", color: "var(--text-muted)", fontStyle: "italic" }}>
                      None found.
                    </span>
                  )}
                </div>

                {/* Travel Notes (Auth Locked) */}
                <div className="notes-section glass-panel" style={{ background: "rgba(0,0,0,0.1)" }}>
                  <span className="detail-label">My Travel & Watch Notes</span>
                  {user ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                      <textarea 
                        className="notes-textarea" 
                        placeholder="Write private notes about this country... (e.g. Planning to travel here in September)"
                        value={selectedCountryNote}
                        onChange={(e) => setSelectedCountryNote(e.target.value)}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {notesStatus && <span className="notes-status">{notesStatus}</span>}
                        <button className="save-note-btn" onClick={handleSaveNote}>Save Note</button>
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Please <button className="btn-link" style={{ fontSize: "13px", padding: 0 }} onClick={() => { setAuthMode("login"); setShowAuthBox(true); }}>Sign In</button> to append personal notes.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Grid View Layout */
              <>
                {/* Search and Filters */}
                <div className="search-filter-section">
                  <div className="search-input-wrapper">
                    <input 
                      type="text" 
                      className="search-field" 
                      placeholder="Search countries by name, code, or capital..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                    <button 
                      className="btn-link" 
                      style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", padding: 0 }}
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    >
                      <span>⚙️ {showAdvancedFilters ? "Hide" : "Show"} Sort & Filters</span>
                    </button>
                    
                    {(filterLandlocked || filterUnMember || sortBy !== "name") && (
                      <button 
                        className="btn-link" 
                        style={{ fontSize: "11px", color: "var(--color-primary)", padding: 0 }}
                        onClick={() => {
                          setSortBy("name");
                          setFilterLandlocked(false);
                          setFilterUnMember(false);
                        }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>

                  {showAdvancedFilters && (
                    <div className="glass-panel" style={{ padding: "12px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-color)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Sort By</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {["name", "population", "area"].map((option) => (
                            <button
                              key={option}
                              className={`filter-pill ${sortBy === option ? "active" : ""}`}
                              style={{ padding: "3px 8px", fontSize: "11px" }}
                              onClick={() => setSortBy(option)}
                            >
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                          <input 
                            type="checkbox" 
                            checked={filterLandlocked} 
                            onChange={(e) => setFilterLandlocked(e.target.checked)}
                            style={{ accentColor: "var(--color-primary)" }}
                          />
                          <span>Landlocked Only</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                          <input 
                            type="checkbox" 
                            checked={filterUnMember} 
                            onChange={(e) => setFilterUnMember(e.target.checked)}
                            style={{ accentColor: "var(--color-primary)" }}
                          />
                          <span>UN Member Only</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="filters-row custom-scroll" style={{ marginTop: "12px" }}>
                    {continents.map((continent) => (
                      <button 
                        key={continent} 
                        className={`filter-pill ${activeContinent === continent ? "active" : ""}`}
                        onClick={() => setActiveContinent(continent)}
                      >
                        {continent}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid */}
                <div className="country-grid custom-scroll">
                  {filteredCountries.map((c) => (
                    <div 
                      key={c.cca3} 
                      className="country-card glass-panel"
                      onClick={() => setSelectedCountry(c)}
                    >
                      <div className="card-flag-wrapper">
                        {c.flags && c.flags.png ? (
                          <img 
                            src={c.flags.png} 
                            alt={`${c.name.common} flag`}
                            className="card-flag" 
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const placeholder = e.target.parentElement.querySelector('.flag-error-placeholder');
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="flag-error-placeholder" 
                          style={{ 
                            display: c.flags && c.flags.png ? 'none' : 'flex', 
                            fontSize: '36px', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            height: '100%', 
                            width: '100%', 
                            background: 'rgba(255,255,255,0.03)' 
                          }}
                        >
                          🗺️
                        </div>
                      </div>
                      <div className="card-info">
                        <span className="card-name">{c.emoji} {c.name.common}</span>
                        <span className="card-region">{c.region}</span>
                      </div>
                    </div>
                  ))}
                  {filteredCountries.length === 0 && (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                      No countries found matching filters.
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Sticky Interactive Leaflet Map */}
      <div className="right-panel">
        <Map 
          theme={theme}
          selectedCountry={selectedCountry} 
          onSelectCountry={handleSelectCountryByCode}
          quizHighlightCode={quizHighlightCode}
          countries={countries}
        />
      </div>

      {/* Geopolitical Insights Modal */}
      {showAnalytics && (
        <Analytics onClose={() => setShowAnalytics(false)} />
      )}
    </div>
  );
}
