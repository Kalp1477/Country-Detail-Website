import React, { useState, useEffect } from "react";

export default function TriviaGame({ user, API_BASE, onClose, onHighlightCountry, countries = [] }) {
  const [gameState, setGameState] = useState("welcome"); // 'welcome' | 'loading' | 'playing' | 'gameover'
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  
  // Active question states
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  // Customization states
  const [selectedContinent, setSelectedContinent] = useState("All");
  const [selectedCountryFocus, setSelectedCountryFocus] = useState(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter countries for dropdown
  const dropdownCountries = (countries || []).filter(c => 
    c.name.common.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.cca3.toLowerCase().includes(countrySearch.toLowerCase())
  ).slice(0, 5);

  // Fetch leaderboard on mount and when welcome screen is shown
  useEffect(() => {
    fetchLeaderboard();
  }, [gameState]);

  const fetchLeaderboard = () => {
    setLoadingLeaderboard(true);
    fetch(`${API_BASE}/quiz/leaderboard`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setLeaderboard(data);
        setLoadingLeaderboard(false);
      })
      .catch((err) => {
        console.error("Error loading leaderboard:", err);
        setLoadingLeaderboard(false);
      });
  };

  const startQuiz = () => {
    setGameState("loading");
    setScoreSubmitted(false);

    let url = `${API_BASE}/quiz/questions`;
    const params = [];
    if (selectedCountryFocus) {
      params.push(`country_code=${selectedCountryFocus.cca3}`);
    } else if (selectedContinent !== "All") {
      params.push(`continent=${selectedContinent}`);
    }
    if (params.length > 0) {
      url += `?${params.join("&")}`;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load questions");
        return res.json();
      })
      .then((data) => {
        setQuestions(data);
        setCurrentIdx(0);
        setScore(0);
        setSelectedOption(null);
        setAnswered(false);
        setGameState("playing");
        
        // If the first question is map-type, highlight it immediately
        if (data.length > 0 && data[0].type === "map") {
          onHighlightCountry(data[0].cca3);
        } else {
          onHighlightCountry(null);
        }
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to load quiz. Please make sure the backend is running.");
        setGameState("welcome");
      });
  };

  // Highlight active country if question type is map
  useEffect(() => {
    if (gameState === "playing" && questions[currentIdx]) {
      const q = questions[currentIdx];
      if (q.type === "map") {
        onHighlightCountry(q.cca3);
      } else {
        onHighlightCountry(null);
      }
    }
  }, [currentIdx, gameState, questions]);

  const handleOptionSelect = (option) => {
    if (answered) return;
    setSelectedOption(option);
    setAnswered(true);

    const q = questions[currentIdx];
    if (option === q.correctAnswer) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setGameState("gameover");
      onHighlightCountry(null); // Clear map highlights
    }
  };

  const submitScore = (scoreVal = score, totalQuestionsVal = questions.length) => {
    if (!user) return;
    setSubmittingScore(true);
    fetch(`${API_BASE}/quiz/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.access_token}`
      },
      body: JSON.stringify({
        score: scoreVal,
        total_questions: totalQuestionsVal
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setScoreSubmitted(true);
        setSubmittingScore(false);
        fetchLeaderboard();
      })
      .catch((err) => {
        console.error(err);
        setSubmittingScore(false);
      });
  };

  // Auto-submit score when quiz ends
  useEffect(() => {
    if (gameState === "gameover" && user && !scoreSubmitted && !submittingScore) {
      submitScore(score, questions.length);
    }
  }, [gameState, user, score, questions.length, scoreSubmitted, submittingScore]);

  const getStartButtonLabel = () => {
    if (selectedCountryFocus) {
      return `Start ${selectedCountryFocus.name.common} Details Quiz`;
    }
    if (selectedContinent !== "All") {
      return `Start ${selectedContinent} Quiz`;
    }
    return "Start Random Quiz";
  };

  const getPerformanceMessage = () => {
    const ratio = score / (questions.length || 5);
    if (ratio === 1) return "🏆 Master Geographer! Flawless victory!";
    if (ratio >= 0.8) return "🌟 Outstanding! You really know the world!";
    if (ratio >= 0.6) return "👍 Great job! Solid geographical skills.";
    if (ratio >= 0.4) return "🙂 Nice try! Keep practicing to improve.";
    return "🗺️ Time to study the atlas! Give it another shot.";
  };

  if (gameState === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "300px", color: "var(--text-muted)" }}>
        <div className="spinner" style={{ marginBottom: "16px", border: "4px solid rgba(168, 85, 247, 0.1)", borderTop: "4px solid var(--color-secondary)", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite" }} />
        <span>Generating trivia challenge...</span>
      </div>
    );
  }

  return (
    <div className="detail-panel glass-panel" style={{ padding: "24px", animation: "slideIn 0.3s ease", border: "1px solid rgba(168, 85, 247, 0.2)", background: "linear-gradient(135deg, rgba(22, 30, 49, 0.75) 0%, rgba(30, 15, 50, 0.7) 100%)" }}>
      
      {/* Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "var(--color-secondary)" }}>🎮</span> Geopolitical Challenge
        </h2>
        <button className="back-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
          Close Game
        </button>
      </div>

      {gameState === "welcome" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>
            Test your geographical intelligence! Identify country flags, name capitals, and guess highlighted country shapes on the interactive map.
          </p>

          {/* Continent Selection Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>Select Continent Focus:</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {["All", "Africa", "Americas", "Asia", "Europe", "Oceania"].map((cont) => (
                <button
                  key={cont}
                  onClick={() => {
                    setSelectedContinent(cont);
                    setSelectedCountryFocus(null); // Clear country focus when choosing continent
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    background: selectedContinent === cont ? "var(--color-secondary)" : "rgba(255, 255, 255, 0.05)",
                    color: selectedContinent === cont ? "#fff" : "var(--text-main)",
                    border: selectedContinent === cont ? "1px solid var(--color-secondary)" : "1px solid rgba(255, 255, 255, 0.1)",
                    transition: "all 0.2s"
                  }}
                >
                  {cont}
                </button>
              ))}
            </div>
          </div>

          {/* Country Selection Dropdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>Or Focus Quiz on a Specific Country:</span>
            {selectedCountryFocus ? (
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                background: "rgba(168, 85, 247, 0.1)", 
                padding: "8px 12px", 
                borderRadius: "8px",
                border: "1px solid var(--color-secondary)"
              }}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>
                  📍 {selectedCountryFocus.emoji || ""} {selectedCountryFocus.name.common}
                </span>
                <button 
                  onClick={() => setSelectedCountryFocus(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#f87171",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                >
                  Clear Selection
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search and choose a country directly..."
                  value={countrySearch}
                  onChange={(e) => {
                    setCountrySearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--text-main)",
                    fontSize: "13px"
                  }}
                />
                {showDropdown && countrySearch.trim() !== "" && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    background: "#161d30",
                    border: "1px solid rgba(168, 85, 247, 0.2)",
                    borderRadius: "8px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    marginTop: "4px"
                  }}>
                    {dropdownCountries.map((c) => (
                      <div
                        key={c.cca3}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input blur from hiding dropdown before selection registers
                          setSelectedCountryFocus(c);
                          setSelectedContinent("All"); // Clear continent choice
                          setCountrySearch("");
                          setShowDropdown(false);
                        }}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: "13px",
                          transition: "background 0.2s"
                        }}
                        onMouseOver={(e) => e.target.style.background = "rgba(168, 85, 247, 0.2)"}
                        onMouseOut={(e) => e.target.style.background = "none"}
                      >
                        {c.emoji || ""} {c.name.common}
                      </div>
                    ))}
                    {dropdownCountries.length === 0 && (
                      <div style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                        No countries found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            className="auth-btn" 
            onClick={startQuiz}
            style={{ 
              background: "linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)", 
              color: "#fff", 
              border: "none", 
              padding: "12px 24px", 
              borderRadius: "10px", 
              fontSize: "15px", 
              fontWeight: "600",
              cursor: "pointer",
              transition: "transform 0.2s",
              marginTop: "8px"
            }}
            onMouseOver={(e) => e.target.style.transform = "scale(1.02)"}
            onMouseOut={(e) => e.target.style.transform = "scale(1.0)"}
          >
            {getStartButtonLabel()}
          </button>

          {/* Leaderboard Section */}
          <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", color: "var(--color-primary)", marginBottom: "10px" }}>
              🏆 Global Leaderboard
            </h3>
            
            {loadingLeaderboard ? (
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading rankings...</span>
            ) : leaderboard.length === 0 ? (
              <span style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No scores logged yet. Be the first!</span>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto" }} className="custom-scroll">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={{ padding: "6px" }}>Rank</th>
                      <th style={{ padding: "6px" }}>Player</th>
                      <th style={{ padding: "6px" }}>Score</th>
                      <th style={{ padding: "6px" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "6px", fontWeight: "600" }}>#{idx + 1}</td>
                        <td style={{ padding: "6px", color: item.username === user?.username ? "var(--color-secondary)" : "inherit" }}>
                          @{item.username}
                        </td>
                        <td style={{ padding: "6px", fontWeight: "700", color: "var(--color-primary)" }}>
                          {item.score} / {item.total_questions}
                        </td>
                        <td style={{ padding: "6px", color: "var(--text-muted)", fontSize: "11px" }}>{item.created_at.split(" ")[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {gameState === "playing" && questions[currentIdx] && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Progress Indicator */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>Question {currentIdx + 1} of {questions.length}</span>
              <span>Score: {score}</span>
            </div>
            <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
              <div 
                style={{ 
                  height: "100%", 
                  width: `${((currentIdx + 1) / questions.length) * 100}%`, 
                  background: "linear-gradient(90deg, var(--color-secondary), var(--color-primary))",
                  transition: "width 0.3s"
                }} 
              />
            </div>
          </div>

          {/* Active Question Prompt */}
          <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: "15px", fontWeight: "600", textAlign: "center", display: "block" }}>
              {questions[currentIdx].questionText}
            </span>
          </div>

          {/* Special Visual: Flag rendering */}
          {questions[currentIdx].type === "flag" && (
            <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
              <div style={{ width: "160px", height: "100px", overflow: "hidden", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                <img 
                  src={questions[currentIdx].flagUrl} 
                  alt="Quiz flag" 
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                />
              </div>
            </div>
          )}

          {/* Special Visual: Map direction prompt */}
          {questions[currentIdx].type === "map" && (
            <div style={{ textAlign: "center", fontSize: "13px", color: "var(--color-secondary)", fontStyle: "italic", background: "rgba(168, 85, 247, 0.08)", padding: "8px", borderRadius: "6px" }}>
              📍 Panning map to the highlighted country. Take a look!
            </div>
          )}

          {/* Options Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
            {questions[currentIdx].options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === questions[currentIdx].correctAnswer;
              
              let btnStyle = {
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--text-main)"
              };

              if (answered) {
                if (isCorrect) {
                  btnStyle = {
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid var(--color-accent)",
                    color: "var(--color-accent)",
                    fontWeight: "600"
                  };
                } else if (isSelected) {
                  btnStyle = {
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    color: "#f87171"
                  };
                } else {
                  btnStyle = {
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.02)",
                    color: "var(--text-muted)",
                    opacity: 0.5
                  };
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(option)}
                  style={{
                    ...btnStyle,
                    padding: "12px",
                    borderRadius: "8px",
                    cursor: answered ? "default" : "pointer",
                    fontSize: "13px",
                    textAlign: "center",
                    transition: "all 0.2s"
                  }}
                  disabled={answered}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {/* Action Row */}
          {answered && (
            <button
              onClick={handleNext}
              style={{
                marginTop: "12px",
                background: "var(--color-primary)",
                color: "#000",
                border: "none",
                padding: "10px",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "center"
              }}
            >
              {currentIdx < questions.length - 1 ? "Next Question →" : "Finish Quiz 🏁"}
            </button>
          )}
        </div>
      )}

      {gameState === "gameover" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
          
          <div>
            <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Quiz Results</span>
            <h3 style={{ fontSize: "28px", fontWeight: "800", background: "linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "6px 0" }}>
              {score} / {questions.length} Correct
            </h3>
            <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-main)" }}>
              {getPerformanceMessage()}
            </span>
          </div>

          {/* Submit Score block */}
          <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
            {user ? (
              scoreSubmitted ? (
                <span style={{ color: "var(--color-accent)", fontSize: "13px", fontWeight: "500" }}>
                  ✓ Score submitted to Leaderboard!
                </span>
              ) : (
                <button
                  onClick={submitScore}
                  disabled={submittingScore}
                  style={{
                    background: "var(--color-secondary)",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "13px",
                    opacity: submittingScore ? 0.7 : 1
                  }}
                >
                  {submittingScore ? "Submitting..." : "Submit Score to Leaderboard"}
                </button>
              )
            ) : (
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                Please sign in to log your score on the leaderboard.
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              className="auth-btn" 
              onClick={startQuiz} 
              style={{ flex: 1, padding: "10px", fontSize: "13px", fontWeight: "600" }}
            >
              Play Again
            </button>
            <button 
              className="auth-btn" 
              onClick={() => setGameState("welcome")} 
              style={{ flex: 1, padding: "10px", fontSize: "13px" }}
            >
              Show Rankings
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
