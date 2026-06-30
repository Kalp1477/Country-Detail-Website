import pandas as pd
from typing import List, Dict, Any

def load_dataframe(countries: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Parses the raw unified countries list into a Pandas DataFrame.
    """
    records = []
    for c in countries:
        # Extract common fields
        name = c.get("name", {}).get("common", "Unknown")
        cca3 = c.get("cca3", "")
        region = c.get("region", "Other")
        # Continents is list
        continents = c.get("continents", [])
        continent = continents[0] if continents else region
        
        population = c.get("population", 0)
        
        # Area can be directly a number (from v3.1/mledoze fallback) or a dict (from v5)
        area_raw = c.get("area", 0)
        if isinstance(area_raw, dict):
            area = area_raw.get("kilometers", 0)
        else:
            area = float(area_raw) if area_raw is not None else 0.0

        # Gini can be a dict (year: val) or float
        gini_raw = c.get("gini", {})
        gini_val = None
        if isinstance(gini_raw, dict) and gini_raw:
            # Get latest year's value
            latest_year = max(gini_raw.keys())
            gini_val = gini_raw[latest_year]
        elif isinstance(gini_raw, (int, float)):
            gini_val = gini_raw

        # Extract currencies
        curr_list = []
        currencies_raw = c.get("currencies", {})
        if isinstance(currencies_raw, list):
            # v5 structure: [{"code": "EUR", "name": "Euro"}]
            curr_list = [curr.get("code") for curr in currencies_raw if curr.get("code")]
        elif isinstance(currencies_raw, dict):
            # v3.1 structure: {"EUR": {"name": "Euro"}}
            curr_list = list(currencies_raw.keys())

        records.append({
            "name": name,
            "cca3": cca3,
            "continent": continent,
            "region": region,
            "population": population,
            "area": area,
            "gini": gini_val,
            "currencies": curr_list
        })
    
    return pd.DataFrame(records)

def get_most_dense_countries(df: pd.DataFrame, top_n: int = 5) -> Dict[str, List[Dict[str, Any]]]:
    """
    Groups countries by continent and returns the top N densest countries in each.
    """
    # Exclude entries with zero or invalid area
    valid_df = df[df["area"] > 0].copy()
    valid_df["density"] = valid_df["population"] / valid_df["area"]
    
    # Sort by density desc
    valid_df = valid_df.sort_values(by="density", ascending=False)
    
    # Group by continent and take top N
    result = {}
    import math
    for continent, group in valid_df.groupby("continent"):
        top_dense = group.head(top_n)
        records = top_dense[[
            "name", "cca3", "population", "area", "density"
        ]].to_dict(orient="records")
        
        # Post-process for JSON compliance
        for r in records:
            for k, v in r.items():
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    r[k] = None
                    
        result[str(continent)] = records
        
    return result

def get_land_to_pop_metrics(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Returns land-to-population ratio, density, and Gini wealth distribution indicator.
    """
    valid_df = df[df["area"] > 0].copy()
    valid_df["density"] = valid_df["population"] / valid_df["area"]
    valid_df["land_per_capita_sqm"] = (valid_df["area"] * 1000000) / valid_df["population"]
    
    # Sort by area descending for visualization
    sorted_df = valid_df.sort_values(by="area", ascending=False)
    
    records = sorted_df[[
        "name", "cca3", "population", "area", "density", "land_per_capita_sqm", "gini"
    ]].to_dict(orient="records")
    
    # Post-process for JSON compliance
    import math
    for r in records:
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None
                
    return records

def get_currency_web(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Exposes which countries share identical currencies, sorted by the size of the sharing group.
    """
    # Explode currencies list
    exploded_df = df.explode("currencies")
    exploded_df = exploded_df[exploded_df["currencies"].notna()]
    
    # Group by currency and get count and list of countries
    currency_groups = {}
    for curr, group in exploded_df.groupby("currencies"):
        countries_in_group = group[["name", "cca3"]].to_dict(orient="records")
        currency_groups[str(curr)] = {
            "currency": curr,
            "countries": countries_in_group,
            "count": len(countries_in_group)
        }
        
    # Sort groups by count descending
    sorted_groups = sorted(currency_groups.values(), key=lambda x: x["count"], reverse=True)
    return sorted_groups
