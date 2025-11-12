document.addEventListener('DOMContentLoaded', () => {
  // Initialize map with enhanced styling
  const map = L.map('map', {
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    attributionControl: true
  }).setView([20, 0], 2);

  // Enhanced tile layer with multiple options
  const baseLayers = {
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: '© Esri'
    }),
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    }),
    'Dark Theme': L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors'
    })
  };

  // Set default layer
  baseLayers['Dark Theme'].addTo(map);

  // Add layer control
  L.control.layers(baseLayers).addTo(map);

  // State management
  let countriesLayer = null;
  let fossilMarkers = L.layerGroup();
  let heatmapLayer = null;

  // Get UI elements
  const taxonSelect = document.getElementById('taxon-select');
  const searchInput = document.getElementById('taxon-search');
  const heatToggle = document.getElementById('heat-toggle');
  const timeToggle = document.getElementById('time-toggle');
  const flashCard = document.getElementById('flash-card');
  const flashClose = document.getElementById('flash-close');
  const fossilDetails = document.getElementById('fossil-details');
  const detailsClose = document.getElementById('details-close');
  const timelinePanel = document.getElementById('timeline-panel');
  const timelineClose = document.getElementById('timeline-close');
  const legendPanel = document.getElementById('legend-panel');
  const legendBtn = document.getElementById('legend-btn');
  const eraFilter = document.getElementById('era-filter');
  const loadingOverlay = document.getElementById('loading-overlay');
  
  // Stats elements
  const totalFossils = document.getElementById('total-fossils');
  const activeFilters = document.getElementById('active-filters');

  // Application state
  const state = { 
    mode: 'heat',
    activeFilters: 0,
    totalDiscoveries: 0,
    currentEra: null,
    timelineActive: false
  };

  // Initialize UI
  fossilMarkers.addTo(map);

  // Flash card functionality
  if (flashClose) {
    flashClose.addEventListener('click', () => {
      flashCard.style.display = 'none';
    });
  }

  function showFlashMessage(message, icon = '🔍', duration = 5000) {
    if (flashCard) {
      const iconElement = flashCard.querySelector('.flash-icon');
      const metaElement = flashCard.querySelector('.meta');
      
      if (iconElement) iconElement.textContent = icon;
      if (metaElement) metaElement.textContent = message;
      
      flashCard.style.display = 'flex';
      
      if (duration > 0) {
        setTimeout(() => {
          flashCard.style.display = 'none';
        }, duration);
      }
    }
  }

  function showLoading(show = true) {
    if (loadingOverlay) {
      loadingOverlay.style.display = show ? 'flex' : 'none';
    }
  }

  // Enhanced color scheme for fossil density
  function getColor(d) {
    return d > 100 ? '#800026' :
           d > 50  ? '#BD0026' :
           d > 20  ? '#E31A1C' :
           d > 10  ? '#FC4E2A' :
           d > 5   ? '#FD8D3C' :
           d > 0   ? '#FFEDA0' :
                     'transparent';
  }

  function style(feature) {
    const count = feature.properties.count || 0;
    return {
      fillColor: getColor(count),
      weight: count > 0 ? 2 : 1,
      opacity: 1,
      color: count > 0 ? '#ffd700' : 'rgba(255, 255, 255, 0.3)',
      dashArray: count > 0 ? '' : '3',
      fillOpacity: count > 0 ? 0.8 : 0.1
    };
  }

  // Enhanced feature interactions
  function onEachFeature(feature, layer) {
    const props = feature.properties;
    const count = props.count || 0;
    
    layer.on({
      mouseover: e => {
        e.target.setStyle({
          weight: 3,
          color: '#00ffff',
          fillOpacity: count > 0 ? 0.9 : 0.3
        });
        
        if (count > 0) {
          layer.openTooltip();
        }
      },
      mouseout: e => {
        if (countriesLayer) {
          countriesLayer.resetStyle(e.target);
        }
        layer.closeTooltip();
      },
      click: e => {
        if (count > 0) {
          showCountryDetails(props);
          
          // Create enhanced popup
          const popupContent = createCountryPopup(props);
          L.popup({
            maxWidth: 300,
            className: 'custom-popup'
          })
          .setLatLng(e.latlng)
          .setContent(popupContent)
          .openOn(map);
          
          showFlashMessage(`Exploring ${props.ADMIN}: ${count} fossil discoveries`, '🦴', 3000);
        } else {
          showFlashMessage(`No fossil discoveries recorded in ${props.ADMIN}`, '❌', 2000);
        }
      }
    });

    // Enhanced tooltip
    if (count > 0) {
      layer.bindTooltip(
        `<div class="tooltip-content">
          <strong>${props.ADMIN}</strong><br>
          <span class="fossil-count">${count} discoveries</span><br>
          <small>Click for details</small>
        </div>`,
        {
          permanent: false,
          sticky: true,
          className: 'custom-tooltip',
          direction: 'top'
        }
      );
    }
  }

  // Create enhanced country popup content
  function createCountryPopup(props) {
    const count = props.count || 0;
    const density = count > 50 ? 'Very High' : 
                   count > 20 ? 'High' : 
                   count > 10 ? 'Moderate' : 'Low';
    
    return `
      <div class="popup-content">
        <div class="popup-header">
          <h3>${props.ADMIN}</h3>
          <div class="density-badge ${density.toLowerCase().replace(' ', '-')}">${density} Density</div>
        </div>
        <div class="popup-stats">
          <div class="stat">
            <span class="stat-icon">🦴</span>
            <span class="stat-text">${count} Discoveries</span>
          </div>
          <div class="stat">
            <span class="stat-icon">🏛️</span>
            <span class="stat-text">Research Sites</span>
          </div>
          <div class="stat">
            <span class="stat-icon">📅</span>
            <span class="stat-text">Multiple Eras</span>
          </div>
        </div>
        <div class="popup-actions">
          <button onclick="viewCountryDetails('${props.ADMIN}')" class="popup-btn">
            <i class="fas fa-search"></i> Explore
          </button>
          <button onclick="predictImpact('${props.ADMIN}')" class="popup-btn secondary">
            <i class="fas fa-calculator"></i> Analyze
          </button>
        </div>
      </div>
    `;
  }

  // Show country details in side panel
  function showCountryDetails(props) {
    const detailsName = document.getElementById('details-name');
    const detailsInfo = document.getElementById('details-info');
    const impactPreview = document.getElementById('impact-preview');
    
    if (detailsName) detailsName.textContent = props.ADMIN;
    
    if (detailsInfo) {
      const count = props.count || 0;
      detailsInfo.innerHTML = `
        <div class="country-details">
          <div class="detail-item">
            <i class="fas fa-bone"></i>
            <span><strong>${count}</strong> fossil discoveries</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-globe"></i>
            <span>Multiple geological formations</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-university"></i>
            <span>Active research sites</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-clock"></i>
            <span>Triassic to Cretaceous periods</span>
          </div>
        </div>
        <div class="discovery-timeline">
          <h4>Recent Discoveries</h4>
          <div class="timeline-item">
            <span class="timeline-year">2023</span>
            <span class="timeline-desc">New theropod species identified</span>
          </div>
          <div class="timeline-item">
            <span class="timeline-year">2022</span>
            <span class="timeline-desc">Sauropod fossils excavated</span>
          </div>
        </div>
      `;
    }
    
    // Show mock impact analysis
    if (impactPreview) {
      const mockScore = Math.floor(Math.random() * 40) + 30;
      const previewScore = document.getElementById('preview-score');
      if (previewScore) previewScore.textContent = mockScore;
      impactPreview.style.display = 'block';
    }
  }

  // Load and display country fossil data
  async function loadCountries() {
    showLoading(true);
    
    if (countriesLayer) {
      countriesLayer.clearLayers();
      map.removeLayer(countriesLayer);
    }

    showFlashMessage('Excavating fossil database...', '⛏️', 0);

    const params = new URLSearchParams();
    if (taxonSelect && taxonSelect.value) {
      params.set('group', taxonSelect.value.toLowerCase());
      state.activeFilters++;
    }
    if (searchInput && searchInput.value.trim()) {
      params.set('species', searchInput.value.trim().toLowerCase());
      state.activeFilters++;
    }
    if (eraFilter && eraFilter.value) {
      params.set('era', eraFilter.value);
      state.activeFilters++;
    }

    const url = `/maps/api/country-fossil-counts?${params.toString()}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to load fossil data');
      }

      const geojson = await response.json();

      countriesLayer = L.geoJSON(geojson, {
        style: style,
        onEachFeature: onEachFeature
      }).addTo(map);

      // Calculate statistics
      let totalFossilCount = 0;
      let countriesWithFossils = 0;
      
      geojson.features.forEach(feature => {
        const count = feature.properties.count || 0;
        totalFossilCount += count;
        if (count > 0) countriesWithFossils++;
      });

      state.totalDiscoveries = totalFossilCount;
      updateStats();

      showFlashMessage(
        `Discovered ${totalFossilCount} fossils across ${countriesWithFossils} regions`, 
        '🎉', 
        4000
      );

      // Add fossil markers for high-density areas
      if (state.mode === 'points') {
        addFossilMarkers(geojson);
      }

    } catch (error) {
      console.error('Error loading countries:', error);
      showFlashMessage('Excavation failed. Please try again.', '❌', 3000);
    } finally {
      showLoading(false);
    }
  }

  // Add individual fossil site markers
  function addFossilMarkers(geojson) {
    fossilMarkers.clearLayers();
    
    geojson.features.forEach(feature => {
      const count = feature.properties.count || 0;
      if (count > 10) { // Only show markers for significant discoveries
        const bounds = L.geoJSON(feature).getBounds();
        const center = bounds.getCenter();
        
        // Add some randomness to marker positions
        const lat = center.lat + (Math.random() - 0.5) * 2;
        const lng = center.lng + (Math.random() - 0.5) * 2;
        
        const marker = L.marker([lat, lng], {
          icon: createFossilIcon(count)
        }).addTo(fossilMarkers);
        
        marker.bindPopup(createMarkerPopup(feature.properties));
      }
    });
  }

  // Create custom fossil site icons
  function createFossilIcon(count) {
    const size = Math.min(40, 20 + count * 0.5);
    const color = count > 50 ? '#ff4400' : count > 20 ? '#ffaa00' : '#00ff88';
    
    return L.divIcon({
      className: 'fossil-marker',
      html: `
        <div class="fossil-icon" style="
          width: ${size}px; 
          height: ${size}px; 
          background: ${color}; 
          border: 2px solid #ffd700;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${Math.max(12, size * 0.4)}px;
          box-shadow: 0 0 15px ${color};
        ">🦴</div>
      `,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }

  // Create marker popup content
  function createMarkerPopup(props) {
    return `
      <div class="marker-popup">
        <h4><i class="fas fa-map-marker-alt"></i> Fossil Site</h4>
        <p><strong>Region:</strong> ${props.ADMIN}</p>
        <p><strong>Discoveries:</strong> ${props.count}</p>
        <button onclick="focusSite('${props.ADMIN}')" class="popup-btn">
          <i class="fas fa-search-plus"></i> Focus
        </button>
      </div>
    `;
  }

  // Update statistics display
  function updateStats() {
    if (totalFossils) {
      totalFossils.textContent = state.totalDiscoveries.toLocaleString();
    }
    if (activeFilters) {
      activeFilters.textContent = state.activeFilters;
    }
  }

  // Event listeners
  if (taxonSelect) {
    taxonSelect.addEventListener('change', () => {
      const selectedText = taxonSelect.options[taxonSelect.selectedIndex].text;
      showFlashMessage(`Filtering by: ${selectedText}`, '🔍', 2000);
      state.activeFilters = 0; // Reset counter
      loadCountries();
    });
  }

  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if (searchInput.value.trim()) {
          showFlashMessage(`Searching for: ${searchInput.value.trim()}`, '🔎', 2000);
        }
        state.activeFilters = 0; // Reset counter
        loadCountries();
      }, 300);
    });
  }

  if (eraFilter) {
    eraFilter.addEventListener('change', () => {
      const selectedText = eraFilter.options[eraFilter.selectedIndex].text;
      if (eraFilter.value) {
        showFlashMessage(`Time travel to: ${selectedText}`, '🕰️', 2000);
      }
      state.activeFilters = 0; // Reset counter
      loadCountries();
    });
  }

  if (heatToggle) {
    heatToggle.addEventListener('click', () => {
      state.mode = state.mode === 'heat' ? 'points' : 'heat';
      const icon = heatToggle.querySelector('i');
      
      if (state.mode === 'heat') {
        heatToggle.innerHTML = '<i class="fas fa-fire"></i> Heatmap';
        fossilMarkers.clearLayers();
      } else {
        heatToggle.innerHTML = '<i class="fas fa-map-pin"></i> Points';
      }
      
      showFlashMessage(`Switched to ${state.mode} view`, '🔄', 2000);
      loadCountries();
    });
  }

  if (timeToggle) {
    timeToggle.addEventListener('click', () => {
      state.timelineActive = !state.timelineActive;
      timelinePanel.style.display = state.timelineActive ? 'block' : 'none';
      
      if (state.timelineActive) {
        showFlashMessage('Time machine activated!', '⏰', 2000);
      }
    });
  }

  if (legendBtn) {
    legendBtn.addEventListener('click', () => {
      const isVisible = legendPanel.style.display !== 'none';
      legendPanel.style.display = isVisible ? 'none' : 'block';
    });
  }

  // Close buttons
  if (detailsClose) {
    detailsClose.addEventListener('click', () => {
      fossilDetails.style.display = 'none';
    });
  }

  if (timelineClose) {
    timelineClose.addEventListener('click', () => {
      timelinePanel.style.display = 'none';
      state.timelineActive = false;
    });
  }

  // Sidebar actions
  const resetMapBtn = document.getElementById('reset-map');
  const randomFossilBtn = document.getElementById('random-fossil');
  const exportDataBtn = document.getElementById('export-data');

  if (resetMapBtn) {
    resetMapBtn.addEventListener('click', () => {
      map.setView([20, 0], 2);
      taxonSelect.value = '';
      searchInput.value = '';
      eraFilter.value = '';
      state.activeFilters = 0;
      loadCountries();
      showFlashMessage('Map reset to global view', '🌍', 2000);
    });
  }

  if (randomFossilBtn) {
    randomFossilBtn.addEventListener('click', () => {
      // Mock random fossil discovery
      const randomCountries = ['Mongolia', 'Argentina', 'United States', 'China', 'Canada', 'Niger'];
      const randomCountry = randomCountries[Math.floor(Math.random() * randomCountries.length)];
      showFlashMessage(`Discovered rare fossil in ${randomCountry}!`, '🎲', 3000);
    });
  }

  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      showFlashMessage('Exporting fossil database...', '📊', 2000);
      // Mock export functionality
      setTimeout(() => {
        showFlashMessage('Export complete! Check downloads.', '✅', 3000);
      }, 2000);
    });
  }

  // Global functions for popup buttons
  window.viewCountryDetails = function(country) {
    showFlashMessage(`Loading detailed analysis for ${country}`, '🔬', 2000);
  };

  window.predictImpact = function(country) {
    showFlashMessage(`Calculating ecosystem impact for ${country}`, '⚡', 2000);
  };

  window.focusSite = function(country) {
    showFlashMessage(`Focusing on fossil sites in ${country}`, '🎯', 2000);
  };

  // Auto-sync with impact predictor
  const specimenNameInput = document.getElementById('name');
  if (specimenNameInput && searchInput) {
    specimenNameInput.addEventListener('input', function () {
      if (this.value.trim().length > 2) {
        searchInput.value = this.value.trim();
        loadCountries();
      }
    });
  }

  // Initialize app
  setTimeout(() => {
    loadCountries();
    showFlashMessage('Welcome to the Time-Machine Map! 🦕', '👋', 4000);
  }, 500);

  console.log('Enhanced Fossil Explorer initialized successfully! 🌍🦴');
});

  // ---- In your global functions section, add: ----

  // Fetch and display fossil details for a country
  window.viewCountryDetails = function(country) {
    showLoading(true);
    fetch(`/maps/api/fossil-details/${encodeURIComponent(country)}`)
      .then(res => {
        if (!res.ok) throw new Error('No data');
        return res.json();
      })
      .then(data => {
        // Build HTML summary
        let html = `<h3>${data.country}</h3>`;
        html += `<p><strong>Total Discoveries:</strong> ${data.total_discoveries}</p>`;
        html += `<p><strong>Species Count:</strong> ${data.species_count}</p>`;
        html += `<p><strong>Periods:</strong> ${data.time_periods.join(', ')}</p>`;
        html += `<p><strong>Types:</strong> ${Object.entries(data.dinosaur_types).map(([t,c])=>`${t}: ${c}`).join(', ')}</p>`;
        html += `<p><strong>Diet Distribution:</strong> ${Object.entries(data.diet_distribution).map(([d,c])=>`${d}: ${c}`).join(', ')}</p>`;
        html += `<p><strong>Avg Length:</strong> ${data.size_stats.avg_length.toFixed(1)} m</p>`;
        html += `<p><strong>Avg Height:</strong> ${data.size_stats.avg_height.toFixed(1)} m</p>`;
        html += `<h4>Notable Species:</h4><ul>${data.notable_species.map(n=>`<li>${n}</li>`).join('')}</ul>`;

        // Show in flash-card
        const flash = document.getElementById('flash-card');
        flash.querySelector('.flash-icon').textContent = '🦴';
        flash.querySelector('.meta').innerHTML = html;
        flash.style.display = 'flex';
      })
      .catch(err => {
        showFlashMessage(`No details for ${country}`, '❌', 3000);
      })
      .finally(() => {
        showLoading(false);
      });
  };
