import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = "http://localhost:8000/api";

// Day/Night astronomical calculations
const isDayTime = (lat, lon) => {
  const now = new Date();
  
  // Day of the year
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  
  // Declination of the sun (approximate)
  const declination = 23.44 * Math.sin((360 / 365) * (day - 80) * Math.PI / 180);
  
  // Subsolar longitude
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const utcTimeVal = utcHours + utcMinutes / 60 + utcSeconds / 3600;
  const subsolarLon = 180 - (utcTimeVal * 15);
  
  const phi = lat * Math.PI / 180;
  const lambda = lon * Math.PI / 180;
  const decRad = declination * Math.PI / 180;
  const subsolarLonRad = subsolarLon * Math.PI / 180;
  
  const cosTheta = Math.sin(phi) * Math.sin(decRad) + Math.cos(phi) * Math.cos(decRad) * Math.cos(lambda - subsolarLonRad);
  return cosTheta >= 0;
};

const getTerminatorPolygon = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  
  const declination = 23.44 * Math.sin((360 / 365) * (day - 80) * Math.PI / 180);
  
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const utcTimeVal = utcHours + utcMinutes / 60 + utcSeconds / 3600;
  const subsolarLon = 180 - (utcTimeVal * 15);

  const latlngs = [];
  const isNorthernSummer = declination >= 0;
  
  // 2-degree step for excellent performance and visual smoothness
  for (let lon = -180; lon <= 180; lon += 2) {
    const lonRad = (lon - subsolarLon) * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const tanLat = -Math.cos(lonRad) / Math.tan(decRad);
    let lat = Math.atan(tanLat) * 180 / Math.PI;
    lat = Math.max(-85, Math.min(85, lat)); // Clamp for Web Mercator map bounds
    latlngs.push([lat, lon]);
  }
  
  if (isNorthernSummer) {
    latlngs.push([-90, 180]);
    latlngs.push([-90, -180]);
  } else {
    latlngs.push([90, 180]);
    latlngs.push([90, -180]);
  }
  
  return latlngs;
};

export default function Map({ theme, selectedCountry, onSelectCountry, quizHighlightCode, countries = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const terminatorLayerRef = useRef(null);
  const [geoJsonData, setGeoJsonData] = useState(null);

  const darkLayerRef = useRef(null);
  const lightLayerRef = useRef(null);

  const [hoveredCode, setHoveredCode] = useState(null);
  const [hoveredCountryData, setHoveredCountryData] = useState(null);

  // Fetch GeoJSON boundaries on mount
  useEffect(() => {
    fetch(`${API_BASE}/geojson`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch boundaries");
        return res.json();
      })
      .then((data) => {
        setGeoJsonData(data);
      })
      .catch((err) => console.error("Error loading GeoJSON boundaries:", err));
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    // Create Leaflet Map instance with wider zoom range
    const map = L.map(containerRef.current, {
      zoomControl: true,
      minZoom: 1,
      maxZoom: 18
    }).setView([20, 0], 2);

    mapRef.current = map;

    // Define Tile Layers
    const darkLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    });

    const lightLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    });

    const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 20
    });

    darkLayerRef.current = darkLayer;
    lightLayerRef.current = lightLayer;

    // Add default layer based on initial theme
    if (theme === "light") {
      lightLayer.addTo(map);
    } else {
      darkLayer.addTo(map);
    }

    // Add Layer Toggle Control
    const baseMaps = {
      "Dark Mode": darkLayer,
      "Light Gray": lightLayer,
      "Satellite": satelliteLayer
    };
    L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

    // Initialize day/night shadow layer
    const terminatorCoords = getTerminatorPolygon();
    const terminatorLayer = L.polygon(terminatorCoords, {
      color: "transparent",
      fillColor: "rgba(0, 0, 0, 0.45)",
      fillOpacity: 1,
      interactive: false
    }).addTo(map);
    terminatorLayerRef.current = terminatorLayer;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Recalculate day/night shadow boundary every 60 seconds
  useEffect(() => {
    const updateTerminator = () => {
      if (terminatorLayerRef.current) {
        terminatorLayerRef.current.setLatLngs(getTerminatorPolygon());
      }
    };
    const interval = setInterval(updateTerminator, 60000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic ticking clock & daylight check for hovered country
  useEffect(() => {
    if (!hoveredCode || !countries || countries.length === 0) {
      setHoveredCountryData(null);
      return;
    }

    const country = countries.find((c) => c.cca3 === hoveredCode);
    if (!country) {
      setHoveredCountryData(null);
      return;
    }

    const updateClock = () => {
      const tzList = country.timezones || [];
      const tzString = tzList.length > 0 ? tzList[0] : null;
      let offset = 0;
      
      if (tzString) {
        if (tzString !== "UTC") {
          const match = tzString.match(/UTC([+-])(\d+):(\d+)/);
          if (match) {
            const sign = match[1] === "+" ? 1 : -1;
            const hours = parseInt(match[2]);
            const minutes = parseInt(match[3]);
            offset = sign * (hours + minutes / 60);
          }
        }
      } else {
        const latlng = country.latlng;
        offset = latlng && latlng[1] ? Math.round(latlng[1] / 15) : 0;
      }

      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const localTime = new Date(utcTime + (3600000 * offset));
      
      const timeStr = localTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const coords = country.latlng || [0, 0];
      const dayTime = isDayTime(coords[0], coords[1]);

      setHoveredCountryData({
        name: country.name.common,
        emoji: country.emoji || "📍",
        timezoneStr: tzString || `UTC${offset >= 0 ? "+" : ""}${offset}`,
        localTime: timeStr,
        isDay: dayTime
      });
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [hoveredCode, countries]);

  // Handle theme changes for Leaflet tile layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (theme === "light") {
      if (darkLayerRef.current && map.hasLayer(darkLayerRef.current)) {
        map.removeLayer(darkLayerRef.current);
      }
      if (lightLayerRef.current) {
        lightLayerRef.current.addTo(map);
      }
    } else {
      if (lightLayerRef.current && map.hasLayer(lightLayerRef.current)) {
        map.removeLayer(lightLayerRef.current);
      }
      if (darkLayerRef.current) {
        darkLayerRef.current.addTo(map);
      }
    }
  }, [theme]);

  // Render GeoJSON Layer when boundaries are loaded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoJsonData) return;

    // Clear previous GeoJSON layer if any
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    const defaultStyle = {
      color: "#0284c7",                  /* Bright sky blue stroke for clarity */
      weight: 1.5,                       /* Thicker border */
      fillColor: "rgba(56, 189, 248, 0.08)", /* Slightly more visible fill */
      fillOpacity: 1
    };

    const highlightStyle = {
      color: "#38bdf8",                  /* Neon Cyan border on hover */
      weight: 2.5,
      fillColor: "rgba(56, 189, 248, 0.25)"
    };

    const selectedStyle = {
      color: "#c084fc",                  /* Neon Purple for selected */
      weight: 3,                         /* Thicker select border */
      fillColor: "rgba(168, 85, 247, 0.35)"
    };

    const fadedStyle = {
      color: "rgba(56, 189, 248, 0.08)", /* Very faint outline */
      weight: 0.8,
      fillColor: "transparent",
      fillOpacity: 0
    };

    // Helper to get country code (CCA3 mapping)
    const getCountryCode = (feature) => {
      const props = feature.properties || {};
      const code = props.ISO_A3 === "-99" ? props.ADM0_A3 : props.ISO_A3;
      return code ? code.toUpperCase() : null;
    };

    const onEachFeature = (feature, layer) => {
      const countryCode = getCountryCode(feature);
      const countryName = feature.properties.NAME || "Unknown";

      // ONLY bind tooltip and interaction events if we are NOT in quiz highlight mode
      if (!quizHighlightCode) {
        layer.bindTooltip(countryName, {
          className: "map-tooltip",
          direction: "top",
          sticky: true
        });

        layer.on({
          mouseover: (e) => {
            const isSelected = selectedCountry && selectedCountry.cca3 === countryCode;
            if (!isSelected) {
              layer.setStyle(highlightStyle);
            }
            if (countryCode) {
              setHoveredCode(countryCode);
            }
          },
          mouseout: (e) => {
            const isSelected = selectedCountry && selectedCountry.cca3 === countryCode;
            if (isSelected) {
              layer.setStyle(selectedStyle);
            } else {
              layer.setStyle(defaultStyle);
            }
            setHoveredCode(null);
          },
          click: (e) => {
            if (countryCode) {
              onSelectCountry(countryCode);
            }
          }
        });
      }
    };

    // Create GeoJSON vector layer
    const geoLayer = L.geoJSON(geoJsonData, {
      style: (feature) => {
        const countryCode = getCountryCode(feature);
        if (quizHighlightCode) {
          return countryCode === quizHighlightCode ? selectedStyle : fadedStyle;
        }
        const isSelected = selectedCountry && selectedCountry.cca3 === countryCode;
        return isSelected ? selectedStyle : defaultStyle;
      },
      onEachFeature: onEachFeature
    }).addTo(map);

    geoJsonLayerRef.current = geoLayer;
  }, [geoJsonData, selectedCountry, quizHighlightCode]);

  // Pan to country and show prominent popup when selectedCountry changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCountry) {
      if (map) map.closePopup();
      return;
    }

    const latlng = selectedCountry.latlng;
    if (latlng && latlng.length === 2) {
      // Fly to the coordinates of the selected country
      map.flyTo([latlng[0], latlng[1]], 4, {
        animate: true,
        duration: 1.5
      });

      // Show beautiful styled popup with large visible name
      L.popup({
        closeButton: false,
        className: "custom-map-popup"
      })
      .setLatLng([latlng[0], latlng[1]])
      .setContent(`
        <div style="text-align: center; font-family: Outfit, sans-serif; color: var(--text-main); padding: 2px;">
          <div style="font-size: 16px; font-weight: 700; color: var(--color-primary); white-space: nowrap;">
            ${selectedCountry.emoji || '📍'} ${selectedCountry.name.common}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Capital: ${selectedCountry.capital.join(', ') || 'N/A'}
          </div>
          <div style="font-size: 11px; color: var(--color-secondary); font-weight: 500; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${selectedCountry.region}
          </div>
        </div>
      `)
      .openOn(map);
    }
  }, [selectedCountry]);

  // Pan to highlighted country in quiz mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !quizHighlightCode || !geoJsonData) return;

    const feature = geoJsonData.features.find((f) => {
      const props = f.properties || {};
      const code = props.ISO_A3 === "-99" ? props.ADM0_A3 : props.ISO_A3;
      return code && code.toUpperCase() === quizHighlightCode;
    });

    if (feature) {
      const tempLayer = L.geoJSON(feature);
      const bounds = tempLayer.getBounds();
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 5,
        animate: true,
        duration: 1.5
      });
      map.closePopup();
    }
  }, [quizHighlightCode, geoJsonData]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      
      {/* Floating Timezone & Local Time Overlay */}
      {hoveredCountryData && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          zIndex: 1000,
          background: "rgba(22, 29, 48, 0.85)",
          border: "1px solid rgba(168, 85, 247, 0.4)",
          borderRadius: "12px",
          padding: "12px 16px",
          color: "#fff",
          fontFamily: "Outfit, sans-serif",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          minWidth: "240px",
          pointerEvents: "none",
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-primary)" }}>
              {hoveredCountryData.emoji} {hoveredCountryData.name}
            </span>
            <span style={{ fontSize: "18px" }}>
              {hoveredCountryData.isDay ? "☀️" : "🌙"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>Timezone</span>
              <span style={{ fontWeight: "600" }}>{hoveredCountryData.timezoneStr}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>Local Time</span>
              <span style={{ fontWeight: "700", color: "var(--color-secondary)" }}>{hoveredCountryData.localTime}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "rgba(255,255,255,0.4)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "4px", marginTop: "4px" }}>
              <span>Status</span>
              <span style={{ fontWeight: "500" }}>{hoveredCountryData.isDay ? "Daytime" : "Nighttime"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
