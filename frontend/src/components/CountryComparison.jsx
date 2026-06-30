import React, { useState } from "react";

export default function CountryComparison({ countries = [], onClose }) {
  const [countryA, setCountryA] = useState(null);
  const [countryB, setCountryB] = useState(null);

  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");

  const [showDropdownA, setShowDropdownA] = useState(false);
  const [showDropdownB, setShowDropdownB] = useState(false);

  // Filter countries for autocomplete
  const filterList = (search) => {
    return countries
      .filter((c) =>
        c.name.common.toLowerCase().includes(search.toLowerCase()) ||
        c.cca3.toLowerCase().includes(search.toLowerCase())
      )
      .slice(0, 5);
  };

  const listA = filterList(searchA);
  const listB = filterList(searchB);

  // Helper calculations
  const getDensity = (c) => {
    if (!c || !c.area || c.area === 0) return 0;
    return c.population / c.area;
  };

  const getBordersCount = (c) => {
    if (!c || !c.borders) return 0;
    return c.borders.length;
  };

  const getCurrenciesString = (c) => {
    if (!c || !c.currencies) return "N/A";
    const currs = Object.values(c.currencies);
    if (currs.length === 0) return "N/A";
    return currs.map((curr) => `${curr.name || ""} (${curr.symbol || ""})`.trim()).join(", ");
  };

  const getLanguagesString = (c) => {
    if (!c || !c.languages) return "N/A";
    const langs = Object.values(c.languages);
    if (langs.length === 0) return "N/A";
    return langs.join(", ");
  };

  // Chart rendering helper
  const renderComparisonBar = (label, valA, valB, formatter = (v) => v.toLocaleString()) => {
    const maxVal = Math.max(valA, valB) || 1;
    const pctA = (valA / maxVal) * 100;
    const pctB = (valB / maxVal) * 100;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "14px 0" }}>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px", background: "rgba(255,255,255,0.01)", borderRadius: "6px" }}>
          {/* Bar A */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ fontWeight: "500" }}>{countryA.emoji} {countryA.name.common}</span>
              <span style={{ fontWeight: "700", color: "var(--color-primary)" }}>{formatter(valA)}</span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
              <div 
                style={{ 
                  height: "100%", 
                  width: `${pctA}%`, 
                  background: "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
                  borderRadius: "4px",
                  transition: "width 0.5s ease-out"
                }} 
              />
            </div>
          </div>
          {/* Bar B */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ fontWeight: "500" }}>{countryB.emoji} {countryB.name.common}</span>
              <span style={{ fontWeight: "700", color: "var(--color-secondary)" }}>{formatter(valB)}</span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
              <div 
                style={{ 
                  height: "100%", 
                  width: `${pctB}%`, 
                  background: "linear-gradient(90deg, var(--color-secondary), var(--color-accent, #10b981))",
                  borderRadius: "4px",
                  transition: "width 0.5s ease-out"
                }} 
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="detail-panel glass-panel" style={{ padding: "24px", animation: "slideIn 0.3s ease", border: "1px solid rgba(168, 85, 247, 0.2)", background: "linear-gradient(135deg, rgba(22, 30, 49, 0.75) 0%, rgba(30, 15, 50, 0.7) 100%)" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "var(--color-secondary)" }}>⚖️</span> Country Comparison
        </h2>
        <button className="back-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
          Close Tool
        </button>
      </div>

      {/* Selectors Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        
        {/* Country Selector A */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>First Country:</span>
          {countryA ? (
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              background: "rgba(168, 85, 247, 0.1)", 
              padding: "8px 12px", 
              borderRadius: "8px",
              border: "1px solid var(--color-primary)",
              height: "38px"
            }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>
                {countryA.emoji} {countryA.name.common}
              </span>
              <button onClick={() => setCountryA(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                Clear
              </button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search first country..."
                value={searchA}
                onChange={(e) => { setSearchA(e.target.value); setShowDropdownA(true); }}
                onFocus={() => setShowDropdownA(true)}
                onBlur={() => setTimeout(() => setShowDropdownA(false), 200)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-main)",
                  fontSize: "13px",
                  height: "38px"
                }}
              />
              {showDropdownA && searchA.trim() !== "" && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: "#161d30",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  borderRadius: "8px",
                  maxHeight: "150px",
                  overflowY: "auto",
                  marginTop: "4px"
                }}>
                  {listA.map((c) => (
                    <div
                      key={c.cca3}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCountryA(c);
                        setSearchA("");
                        setShowDropdownA(false);
                      }}
                      style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}
                      onMouseOver={(e) => e.target.style.background = "rgba(168, 85, 247, 0.2)"}
                      onMouseOut={(e) => e.target.style.background = "none"}
                    >
                      {c.emoji} {c.name.common}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Country Selector B */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Second Country:</span>
          {countryB ? (
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              background: "rgba(6, 182, 212, 0.1)", 
              padding: "8px 12px", 
              borderRadius: "8px",
              border: "1px solid var(--color-secondary)",
              height: "38px"
            }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>
                {countryB.emoji} {countryB.name.common}
              </span>
              <button onClick={() => setCountryB(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                Clear
              </button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search second country..."
                value={searchB}
                onChange={(e) => { setSearchB(e.target.value); setShowDropdownB(true); }}
                onFocus={() => setShowDropdownB(true)}
                onBlur={() => setTimeout(() => setShowDropdownB(false), 200)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-main)",
                  fontSize: "13px",
                  height: "38px"
                }}
              />
              {showDropdownB && searchB.trim() !== "" && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: "#161d30",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  borderRadius: "8px",
                  maxHeight: "150px",
                  overflowY: "auto",
                  marginTop: "4px"
                }}>
                  {listB.map((c) => (
                    <div
                      key={c.cca3}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCountryB(c);
                        setSearchB("");
                        setShowDropdownB(false);
                      }}
                      style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}
                      onMouseOver={(e) => e.target.style.background = "rgba(168, 85, 247, 0.2)"}
                      onMouseOut={(e) => e.target.style.background = "none"}
                    >
                      {c.emoji} {c.name.common}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Comparison Grid & Dashboard */}
      {countryA && countryB ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Side by Side flags and names */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Country A Info */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width: "90px", height: "60px", overflow: "hidden", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "10px" }}>
                {countryA.flags && countryA.flags.png ? (
                  <img src={countryA.flags.png} alt="Flag A" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>🗺️</div>
                )}
              </div>
              <span style={{ fontSize: "15px", fontWeight: "700", textAlign: "center" }}>{countryA.name.common}</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>{countryA.name.official}</span>
            </div>
            {/* Country B Info */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width: "90px", height: "60px", overflow: "hidden", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "10px" }}>
                {countryB.flags && countryB.flags.png ? (
                  <img src={countryB.flags.png} alt="Flag B" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>🗺️</div>
                )}
              </div>
              <span style={{ fontSize: "15px", fontWeight: "700", textAlign: "center" }}>{countryB.name.common}</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>{countryB.name.official}</span>
            </div>
          </div>

          {/* Qualitative Details Comparison (Currencies, Languages) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
            
            {/* Currencies */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px" }}>
              <div style={{ fontSize: "12px" }}>
                <strong style={{ color: "var(--text-muted)", display: "block" }}>Currency A</strong>
                <span>{getCurrenciesString(countryA)}</span>
              </div>
              <div style={{ fontSize: "12px" }}>
                <strong style={{ color: "var(--text-muted)", display: "block" }}>Currency B</strong>
                <span>{getCurrenciesString(countryB)}</span>
              </div>
            </div>

            {/* Languages */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px" }}>
              <div style={{ fontSize: "12px" }}>
                <strong style={{ color: "var(--text-muted)", display: "block" }}>Languages A</strong>
                <span>{getLanguagesString(countryA)}</span>
              </div>
              <div style={{ fontSize: "12px" }}>
                <strong style={{ color: "var(--text-muted)", display: "block" }}>Languages B</strong>
                <span>{getLanguagesString(countryB)}</span>
              </div>
            </div>

            {/* Region / Subregion */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ fontSize: "12px" }}>
                <strong style={{ color: "var(--text-muted)", display: "block" }}>Region A</strong>
                <span>{countryA.region} ({countryA.subregion || "N/A"})</span>
              </div>
              <div style={{ fontSize: "12px" }}>
                <strong style={{ color: "var(--text-muted)", display: "block" }}>Region B</strong>
                <span>{countryB.region} ({countryB.subregion || "N/A"})</span>
              </div>
            </div>

          </div>

          {/* Bar Charts Comparisons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            
            {/* Population Chart */}
            {renderComparisonBar("Population", countryA.population, countryB.population)}

            {/* Area Chart */}
            {renderComparisonBar("Land Area (sq km)", countryA.area, countryB.area, (val) => `${val.toLocaleString()} sq km`)}

            {/* Density Chart */}
            {renderComparisonBar("Population Density (per sq km)", getDensity(countryA), getDensity(countryB), (val) => `${val.toFixed(2)} / sq km`)}

            {/* Land Border Count */}
            {renderComparisonBar("Land Border Count", getBordersCount(countryA), getBordersCount(countryB), (val) => `${val} borders`)}

          </div>

        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "250px", color: "var(--text-muted)", textAlign: "center", gap: "12px", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "10px", background: "rgba(255,255,255,0.01)" }}>
          <span style={{ fontSize: "40px" }}>⚖️</span>
          <span style={{ fontSize: "14px", fontStyle: "italic" }}>
            Please select both countries above to display comparative dashboard metrics and visual charts.
          </span>
        </div>
      )}

    </div>
  );
}
