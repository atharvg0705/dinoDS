import json
import pandas as pd
import logging
import random
from flask import Blueprint, render_template, jsonify, request, current_app
from datetime import datetime

map_routes = Blueprint('maps', __name__, template_folder='../template', static_folder='../maplogic')

log = logging.getLogger("maps")
logging.basicConfig(level=logging.INFO)

@map_routes.route('/')
def map_page():
    return render_template('map.html')

@map_routes.route('/api/country-fossil-counts')
def country_fossil_counts():
    """Enhanced fossil data endpoint with geological era filtering"""
    try:
        df = pd.read_csv('dinosaur_ecosystem_impact_ml_ready.csv')
        
        # Get filter parameters
        species_filter = request.args.get('species', '').strip().lower()
        group_filter = request.args.get('group', '').strip().lower()  
        era_filter = request.args.get('era', '').strip().lower()
        
        log.info(f"Filtering - Species: {species_filter}, Group: {group_filter}, Era: {era_filter}")
        
        # Apply species filter
        if species_filter and 'name' in df.columns:
            df = df[df['name'].astype(str).str.lower().str.contains(species_filter, na=False)]
            
        # Apply group/type filter
        if group_filter and 'type' in df.columns:
            df = df[df['type'].astype(str).str.lower() == group_filter]
            
        # Apply geological era filter
        if era_filter and 'geological_period' in df.columns:
            era_mapping = {
                'triassic': ['late triassic', 'early triassic', 'middle triassic'],
                'jurassic': ['late jurassic', 'early jurassic', 'mid jurassic', 'middle jurassic'], 
                'cretaceous': ['late cretaceous', 'early cretaceous']
            }
            
            if era_filter in era_mapping:
                periods = era_mapping[era_filter]
                df = df[df['geological_period'].astype(str).str.lower().isin(periods)]
        
        # Check for required column
        if 'lived_in' not in df.columns:
            return jsonify({"error": "Missing 'lived_in' column in CSV"}), 400
            
        # Count fossils by location
        location_counts = df['lived_in'].astype(str).str.strip().str.lower().value_counts().to_dict()
        
        # Load world countries GeoJSON
        geojson_path = current_app.static_folder + '/world_countries.geojson'
        with open(geojson_path, encoding='utf-8') as f:
            countries = json.load(f)
            
        # Enhanced country matching with better normalization
        total_fossils = 0
        countries_with_data = 0
        
        for feature in countries['features']:
            country_name = feature['properties'].get('ADMIN', '').strip().lower()
            
            # Try exact match first
            count = location_counts.get(country_name, 0)
            
            # If no exact match, try partial matching for common variations
            if count == 0:
                for location, location_count in location_counts.items():
                    if country_name in location or location in country_name:
                        count += location_count
                        
            feature['properties']['count'] = count
            feature['properties']['density'] = get_density_category(count)
            feature['properties']['last_updated'] = datetime.now().isoformat()
            
            if count > 0:
                total_fossils += count
                countries_with_data += 1
                
        # Add metadata to response
        countries['metadata'] = {
            'total_fossils': total_fossils,
            'countries_with_data': countries_with_data,
            'filters_applied': {
                'species': species_filter,
                'group': group_filter, 
                'era': era_filter
            },
            'generated_at': datetime.now().isoformat()
        }
        
        log.info(f"Processed {total_fossils} fossils across {countries_with_data} countries")
        return jsonify(countries)
        
    except FileNotFoundError:
        log.error("CSV file not found")
        return jsonify({"error": "Fossil database not found"}), 404
    except Exception as e:
        log.error(f"Error processing fossil data: {str(e)}")
        return jsonify({"error": "Failed to process fossil data"}), 500

def get_density_category(count):
    """Categorize fossil density for enhanced visualization"""
    if count > 100:
        return "very_high"
    elif count > 50:
        return "high" 
    elif count > 20:
        return "moderate"
    elif count > 5:
        return "low"
    elif count > 0:
        return "minimal"
    else:
        return "none"

@map_routes.route('/api/fossil-details/<country>')
def fossil_details(country):
    """Get detailed fossil information for a specific country"""
    try:
        df = pd.read_csv('dinosaur_ecosystem_impact_ml_ready.csv')
        
        # Filter data for the specific country
        country_data = df[df['lived_in'].astype(str).str.lower().str.contains(country.lower(), na=False)]
        
        if country_data.empty:
            return jsonify({"error": f"No fossil data found for {country}"}), 404
            
        # Generate detailed statistics
        details = {
            'country': country,
            'total_discoveries': len(country_data),
            'species_count': country_data['name'].nunique() if 'name' in country_data.columns else 0,
            'time_periods': country_data['geological_period'].unique().tolist() if 'geological_period' in country_data.columns else [],
            'dinosaur_types': country_data['type'].value_counts().to_dict() if 'type' in country_data.columns else {},
            'diet_distribution': country_data['diet'].value_counts().to_dict() if 'diet' in country_data.columns else {},
            'size_stats': {
                'avg_length': country_data['length_m'].mean() if 'length_m' in country_data.columns else 0,
                'max_length': country_data['length_m'].max() if 'length_m' in country_data.columns else 0,
                'avg_height': country_data['height_m'].mean() if 'height_m' in country_data.columns else 0
            },
            'notable_species': country_data['name'].head(10).tolist() if 'name' in country_data.columns else []
        }
        
        return jsonify(details)
        
    except Exception as e:
        log.error(f"Error getting fossil details: {str(e)}")
        return jsonify({"error": "Failed to get fossil details"}), 500

@map_routes.route('/api/fossil-timeline')
def fossil_timeline():
    """Get fossil discovery timeline data"""
    try:
        df = pd.read_csv('dinosaur_ecosystem_impact_ml_ready.csv')
        
        # Create mock timeline data based on geological periods
        timeline_data = []
        
        if 'geological_period' in df.columns and 'start_time_mya' in df.columns:
            period_data = df.groupby('geological_period').agg({
                'start_time_mya': 'mean',
                'name': 'count'
            }).reset_index()
            
            for _, row in period_data.iterrows():
                timeline_data.append({
                    'period': row['geological_period'],
                    'time_mya': row['start_time_mya'],
                    'discoveries': row['name'],
                    'description': get_period_description(row['geological_period'])
                })
                
        return jsonify({
            'timeline': sorted(timeline_data, key=lambda x: x['time_mya'], reverse=True),
            'total_periods': len(timeline_data)
        })
        
    except Exception as e:
        log.error(f"Error generating timeline: {str(e)}")
        return jsonify({"error": "Failed to generate timeline"}), 500

def get_period_description(period):
    """Get description for geological periods"""
    descriptions = {
        'Late Triassic': 'Dawn of the dinosaurs, early reptilian dominance',
        'Early Jurassic': 'First giant sauropods emerge',
        'Mid Jurassic': 'Diversification of dinosaur species',
        'Late Jurassic': 'Golden age of giant dinosaurs',
        'Early Cretaceous': 'Rise of flowering plants and new species',  
        'Late Cretaceous': 'Peak diversity before mass extinction'
    }
    return descriptions.get(period, 'Ancient period of prehistoric life')

@map_routes.route('/api/random-discovery')
def random_discovery():
    """Generate a random fossil discovery for exploration"""
    try:
        df = pd.read_csv('dinosaur_ecosystem_impact_ml_ready.csv')
        
        if not df.empty:
            # Select random fossil
            random_fossil = df.sample(n=1).iloc[0]
            
            discovery = {
                'name': random_fossil.get('name', 'Unknown Species'),
                'location': random_fossil.get('lived_in', 'Unknown Location'),
                'period': random_fossil.get('geological_period', 'Unknown Period'),
                'type': random_fossil.get('type', 'Unknown Type'),
                'length': random_fossil.get('length_m', 0),
                'height': random_fossil.get('height_m', 0),
                'discovery_year': random.randint(1990, 2023),
                'significance': generate_significance_text()
            }
            
            return jsonify(discovery)
        else:
            return jsonify({"error": "No fossil data available"}), 404
            
    except Exception as e:
        log.error(f"Error generating random discovery: {str(e)}")
        return jsonify({"error": "Failed to generate discovery"}), 500

def generate_significance_text():
    """Generate random significance text for discoveries"""
    significance_options = [
        "Rare species with unique bone structure",
        "Well-preserved specimen with soft tissue traces", 
        "First discovery of this species in the region",
        "Exceptionally large individual of known species",
        "Evidence of social behavior patterns",
        "Contains fossilized stomach contents",
        "Shows evidence of predator-prey interactions",
        "Rare juvenile specimen with growth markers"
    ]
    return random.choice(significance_options)

@map_routes.route('/api/export-data')
def export_data():
    """Export filtered fossil data"""
    try:
        df = pd.read_csv('dinosaur_ecosystem_impact_ml_ready.csv')
        
        # Apply any filters from query parameters
        species_filter = request.args.get('species', '').strip().lower()
        group_filter = request.args.get('group', '').strip().lower()
        
        if species_filter and 'name' in df.columns:
            df = df[df['name'].astype(str).str.lower().str.contains(species_filter, na=False)]
            
        if group_filter and 'type' in df.columns:
            df = df[df['type'].astype(str).str.lower() == group_filter]
            
        # Generate summary statistics
        export_data = {
            'summary': {
                'total_records': len(df),
                'unique_species': df['name'].nunique() if 'name' in df.columns else 0,
                'countries': df['lived_in'].nunique() if 'lived_in' in df.columns else 0,
                'time_periods': df['geological_period'].nunique() if 'geological_period' in df.columns else 0
            },
            'data': df.head(100).to_dict('records') if not df.empty else [],
            'export_timestamp': datetime.now().isoformat()
        }
        
        return jsonify(export_data)
        
    except Exception as e:
        log.error(f"Error exporting data: {str(e)}")
        return jsonify({"error": "Failed to export data"}), 500
