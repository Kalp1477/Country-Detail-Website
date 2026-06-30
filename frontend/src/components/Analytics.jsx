import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000/api/analytics";

export default function Analytics({ onClose }) {
  const [activeTab, setActiveTab] = useState("density");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [densityData, setDensityData] = useState(null);
  const [landRatiosData, setLandRatiosData] = useState([]);
  const [currencyWebData, setCurrencyWebData] = useState([]);

  const [tableSearch, setTableSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/density`).then((r) => r.json()),
      fetch(`${API_BASE}/land-ratios`).then((r) => r.json()),
      fetch(`${API_BASE}/currency-web`).then((r) => r.json())
    ])
      .then(([density, landRatios, currencyWeb]) => {
        setDensityData(density);
        setLandRatiosData(landRatios);
        setCurrencyWebData(currencyWeb);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading analytics data:", err);
        setError("Could not load geopolitical insights. Please make sure the backend is running.");
        setLoading(false);
      });
  }, []);

  const renderDensityTab = () => {
    if (!densityData) return null;
    return (
      <div className="custom-scroll" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {Object.entries(densityData).map(([continent, countries]) => {
          // Find max density in this continent to normalize progress bars
          const maxDensity = Math.max(...countries.map((c) => c.density), 1);
          
          return (
            <div key={continent} className="density-card-group">
              <h3 className="density-continent-title">
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--color-primary)" }} />
                {continent}
              </h3>
              
              <div className="chart-bar-container">
                {countries.map((c) => {
                  const percentage = Math.max((c.density / maxDensity) * 100, 3);
                  return (
                    <div key={c.cca3} className="chart-item">
                      <div className="chart-labels-row">
                        <span style={{ fontWeight: 500 }}>{c.name} ({c.cca3})</span>
                        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                          {c.density !== null && c.density !== undefined ? c.density.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "N/A"} pop/km²
                        </span>
                      </div>
                      <div className="chart-bar-bg">
                        <div 
                          className="chart-bar-fill" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        <span>Pop: {c.population !== null && c.population !== undefined ? c.population.toLocaleString() : "N/A"}</span>
                        <span>Area: {c.area !== null && c.area !== undefined ? c.area.toLocaleString() : "N/A"} km²</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLandRatiosTab = () => {
    const filtered = landRatiosData.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(tableSearch.toLowerCase())) ||
        (c.cca3 && c.cca3.toLowerCase().includes(tableSearch.toLowerCase()))
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Showing {filtered.length} of {landRatiosData.length} countries
          </span>
          <input
            type="text"
            className="search-field"
            placeholder="Search table..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            style={{ width: "250px", padding: "6px 12px", fontSize: "13px" }}
          />
        </div>
        
        <div className="custom-scroll" style={{ overflowX: "auto", maxHeight: "400px" }}>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Population</th>
                <th>Area (km²)</th>
                <th>Density (/km²)</th>
                <th>Land per Capita (m²)</th>
                <th>Gini Index</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.cca3}>
                  <td style={{ fontWeight: 500 }}>
                    {c.name || "Unknown"} <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{c.cca3 || ""}</span>
                  </td>
                  <td>{c.population !== null && c.population !== undefined ? c.population.toLocaleString() : "N/A"}</td>
                  <td>{c.area !== null && c.area !== undefined ? c.area.toLocaleString() : "N/A"}</td>
                  <td>{c.density !== null && c.density !== undefined ? c.density.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "N/A"}</td>
                  <td>{c.land_per_capita_sqm !== null && c.land_per_capita_sqm !== undefined ? c.land_per_capita_sqm.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "N/A"}</td>
                  <td style={{ color: c.gini ? "var(--color-primary)" : "var(--text-muted)" }}>
                    {c.gini !== null && c.gini !== undefined ? c.gini.toFixed(1) : "N/A"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCurrencyWebTab = () => {
    // Show shared currencies (count > 1)
    const sharedCurrencies = currencyWebData.filter((c) => c.count > 1);
    
    return (
      <div className="currency-list custom-scroll" style={{ maxHeight: "450px", overflowY: "auto", paddingRight: "8px" }}>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "16px" }}>
          This visualization groups countries that share a common currency, showcasing currency integrations across borders.
        </p>
        
        {sharedCurrencies.map((c) => (
          <div key={c.currency} className="currency-card">
            <div>
              <span className="currency-badge">{c.currency}</span>
              <span style={{ marginLeft: "12px", fontSize: "14px", color: "var(--text-muted)", fontWeight: 500 }}>
                {c.count} Countries Share This
              </span>
            </div>
            <div className="currency-members">
              {c.countries.map((country, idx) => (
                <span key={country.cca3}>
                  {country.name} ({country.cca3})
                  {idx < c.countries.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid rgba(56, 189, 248, 0.2)", boxShadow: "0 0 30px rgba(56, 189, 248, 0.15)" }}
      >
        <div className="modal-header">
          <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Geopolitical Analytics Engine
          </h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`modal-tab ${activeTab === "density" ? "active" : ""}`}
            onClick={() => setActiveTab("density")}
          >
            Population Density
          </button>
          <button 
            className={`modal-tab ${activeTab === "ratios" ? "active" : ""}`}
            onClick={() => setActiveTab("ratios")}
          >
            Land & Gini Metrics
          </button>
          <button 
            className={`modal-tab ${activeTab === "currency" ? "active" : ""}`}
            onClick={() => setActiveTab("currency")}
          >
            Currency Web
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--text-muted)" }}>
              Computing geopolitical insights...
            </div>
          )}
          
          {error && (
            <div style={{ color: "#ef4444", textAlign: "center", marginTop: "40px" }}>
              {error}
            </div>
          )}

          {!loading && !error && activeTab === "density" && renderDensityTab()}
          {!loading && !error && activeTab === "ratios" && renderLandRatiosTab()}
          {!loading && !error && activeTab === "currency" && renderCurrencyWebTab()}
        </div>
      </div>
    </div>
  );
}
