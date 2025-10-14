// map.js - Complete Working Version with Email Service Fixes
let map;
let markers = [];
let currentUser = null;
let selectedLocation = null;
let allLocations = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing QueueManager Map...');
    
    // Initialize email service first
    initializeEmailService();
    
    // Check authentication
    auth.onAuthStateChanged((user) => {
        if (!user) {
            console.log('❌ No user logged in, redirecting to login...');
            window.location.href = 'auth.html';
            return;
        }
        
        currentUser = user;
        console.log('✅ User authenticated:', user.email);
        
        // Initialize components
        initMap();
        loadLocations();
        setupFilters();
        
        showToast(`Welcome back, ${user.email.split('@')[0]}!`, 'success');
    });
});

function initializeEmailService() {
    // Check if email service is already available
    if (typeof window.emailService !== 'undefined' && window.emailService.isInitialized) {
        console.log('✅ Email service already available and initialized');
        return;
    }
    
    // If email service doesn't exist, create a simple fallback
    if (typeof window.emailService === 'undefined') {
        console.log('🔄 Creating simple email service fallback...');
        
        window.emailService = {
            isInitialized: true,
            sendWelcomeAndQueueEmail: function(userEmail, userName, queueData) {
                console.log('📧 [SIMULATED] Sending welcome email to:', userEmail);
                console.log('📋 Email data:', {
                    service: queueData.service,
                    location: queueData.locationName,
                    ticketId: queueData.ticketId,
                    position: queueData.position,
                    estimatedWait: queueData.estimatedWait
                });
                
                return new Promise((resolve) => {
                    setTimeout(() => {
                        console.log('✅ [SIMULATED] Welcome email sent successfully');
                        resolve({ 
                            success: true, 
                            simulated: true,
                            message: 'Welcome email sent (simulated)'
                        });
                    }, 800);
                });
            },
            sendThankYouEmail: function(userEmail, userName, completionData) {
                console.log('📧 [SIMULATED] Sending thank you email to:', userEmail);
                return new Promise((resolve) => {
                    setTimeout(() => {
                        console.log('✅ [SIMULATED] Thank you email sent successfully');
                        resolve({ 
                            success: true, 
                            simulated: true,
                            message: 'Thank you email sent (simulated)'
                        });
                    }, 800);
                });
            }
        };
        
        console.log('✅ Simple email service fallback created');
    }
}

function initMap() {
    console.log('🗺️ Initializing map...');
    
    try {
        // Initialize map centered on Madurai, India
        map = L.map('map').setView([9.9252, 78.1198], 13);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);

        console.log('✅ Map initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing map:', error);
        showToast('Failed to load map. Please refresh the page.', 'error');
    }
}

async function loadLocations() {
    console.log('📋 Loading locations from Firebase...');
    
    try {
        showLoading(true);
        
        const snapshot = await db.collection('locations').get();
        const locationsList = document.getElementById('locationsList');
        
        // Clear existing data
        locationsList.innerHTML = '';
        
        // Remove existing markers from map
        markers.forEach(marker => {
            if (map && marker) {
                map.removeLayer(marker);
            }
        });
        markers = [];
        allLocations = [];
        
        let validLocationsCount = 0;
        const categoryCount = {
            hospital: 0,
            bank: 0,
            cafe: 0,
            restaurant: 0,
            other: 0
        };

        if (snapshot.empty) {
            locationsList.innerHTML = `
                <div class="text-center p-4">
                    <i class="fas fa-store-slash fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted">No Locations Found</h6>
                    <p class="text-muted small">Check back later for new locations</p>
                </div>
            `;
            showToast('No locations available yet', 'info');
            showLoading(false);
            return;
        }

        // Process each location
        snapshot.forEach(doc => {
            const locationData = doc.data();
            console.log('📍 Processing location:', locationData.name, locationData);
            
            // Enhanced coordinate extraction with multiple fallbacks
            let coords = extractCoordinates(locationData);
            
            const location = { 
                id: doc.id, 
                ...locationData,
                name: locationData.name || 'Unnamed Location',
                category: (locationData.category || 'other').toLowerCase(),
                services: locationData.services || ['General Service'],
                address: locationData.address || 'Address not specified',
                phone: locationData.phone || 'Not available',
                hours: locationData.hours || 'Not specified',
                coords: coords,
                hasValidCoords: isValidCoordinates(coords)
            };
            
            allLocations.push(location);
            
            // Count categories
            const category = location.category;
            if (categoryCount[category] !== undefined) {
                categoryCount[category]++;
            } else {
                categoryCount.other++;
            }
            
            // Add to map if coordinates are valid
            if (location.hasValidCoords) {
                console.log('✅ Adding to map:', location.name, coords);
                addLocationToMap(location);
                validLocationsCount++;
            } else {
                console.warn('❌ Invalid coordinates for:', location.name, coords);
            }
            
            // Always add to list
            addLocationToList(location);
        });

        // Update statistics
        updateStatistics(validLocationsCount, categoryCount);
        
        if (validLocationsCount > 0) {
            showToast(`Loaded ${validLocationsCount} locations on map (${allLocations.length} total)`, 'success');
            
            // Fit map to show all markers
            if (markers.length > 0) {
                const group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.1));
            }
        } else {
            showToast('No locations with valid coordinates found', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Error loading locations:', error);
        showToast('Failed to load locations. Please try again.', 'error');
        document.getElementById('locationsList').innerHTML = `
            <div class="alert alert-danger m-3">
                <h6>Error Loading Locations</h6>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadLocations()">Retry</button>
            </div>
        `;
    } finally {
        showLoading(false);
    }
}

// Enhanced coordinate extraction function
function extractCoordinates(locationData) {
    // Priority 1: Direct coordinate objects
    if (locationData.coords && typeof locationData.coords === 'object') {
        return locationData.coords;
    }
    if (locationData.coordinates && typeof locationData.coordinates === 'object') {
        return locationData.coordinates;
    }
    if (locationData.location && typeof locationData.location === 'object') {
        return locationData.location;
    }
    
    // Priority 2: Firebase GeoPoint format
    if (locationData.coords && locationData.coords._lat !== undefined) {
        return {
            latitude: locationData.coords._lat,
            longitude: locationData.coords._long
        };
    }
    
    // Priority 3: Individual latitude/longitude fields
    let coords = {};
    if (locationData.latitude !== undefined && locationData.longitude !== undefined) {
        coords.latitude = locationData.latitude;
        coords.longitude = locationData.longitude;
    } else if (locationData.lat !== undefined && locationData.lng !== undefined) {
        coords.lat = locationData.lat;
        coords.lng = locationData.lng;
    }
    
    // Priority 4: Array format
    if (Array.isArray(locationData.coords) && locationData.coords.length >= 2) {
        return locationData.coords;
    }
    
    return Object.keys(coords).length > 0 ? coords : null;
}

function isValidCoordinates(coords) {
    if (!coords) {
        return false;
    }
    
    let lat, lng;
    
    // Handle all possible coordinate formats
    if (coords.latitude !== undefined && coords.longitude !== undefined) {
        lat = coords.latitude;
        lng = coords.longitude;
    } else if (coords.lat !== undefined && coords.lng !== undefined) {
        lat = coords.lat;
        lng = coords.lng;
    } else if (Array.isArray(coords) && coords.length >= 2) {
        lat = coords[0];
        lng = coords[1];
    } else if (coords._lat !== undefined && coords._long !== undefined) {
        // Firebase GeoPoint format
        lat = coords._lat;
        lng = coords._long;
    } else {
        return false;
    }
    
    // Convert to numbers if they're strings
    lat = Number(lat);
    lng = Number(lng);
    
    const isValid = !isNaN(lat) && !isNaN(lng) &&
                   lat >= -90 && lat <= 90 &&
                   lng >= -180 && lng <= 180;
    
    return isValid;
}

function getCoordinates(coords) {
    if (!coords) return null;
    
    if (coords.latitude !== undefined && coords.longitude !== undefined) {
        return [Number(coords.latitude), Number(coords.longitude)];
    } else if (coords.lat !== undefined && coords.lng !== undefined) {
        return [Number(coords.lat), Number(coords.lng)];
    } else if (Array.isArray(coords) && coords.length >= 2) {
        return [Number(coords[0]), Number(coords[1])];
    } else if (coords._lat !== undefined && coords._long !== undefined) {
        // Firebase GeoPoint format
        return [Number(coords._lat), Number(coords._long)];
    }
    return null;
}

function addLocationToMap(location) {
    const coords = getCoordinates(location.coords);
    if (!coords) {
        console.warn('Cannot get coordinates for location:', location.name);
        return;
    }

    console.log('🎯 Creating marker for:', location.name, 'at', coords);
    
    const icon = getIconForCategory(location.category);
    
    try {
        const marker = L.marker(coords, { icon })
            .addTo(map)
            .bindPopup(`
                <div style="min-width: 250px;">
                    <h6 class="mb-2">${getCategoryIcon(location.category)} ${location.name}</h6>
                    <p class="mb-1"><strong>Category:</strong> ${location.category}</p>
                    <p class="mb-1"><strong>Services:</strong> ${location.services.join(', ')}</p>
                    <p class="mb-2"><strong>Address:</strong> ${location.address}</p>
                    <div class="d-grid">
                        <button class="btn btn-sm btn-primary" onclick="openLocationModal('${location.id}')">
                            <i class="fas fa-ticket-alt me-1"></i>Join Queue
                        </button>
                    </div>
                </div>
            `);

        // Add click event to open modal
        marker.on('click', function() {
            openLocationModal(location.id);
        });

        markers.push(marker);
        console.log('✅ Marker added successfully for:', location.name);
        
    } catch (error) {
        console.error('❌ Error adding marker to map:', error);
    }
}

function addLocationToList(location) {
    const locationsList = document.getElementById('locationsList');
    const hasValidCoords = location.hasValidCoords;
    
    const listItem = document.createElement('div');
    listItem.className = 'location-card';
    listItem.innerHTML = `
        <div class="list-group-item border-0" onclick="openLocationModal('${location.id}')">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-2">
                        <h6 class="mb-0 me-2">${getCategoryIcon(location.category)} ${location.name}</h6>
                        <span class="badge ${location.category}-badge category-badge">${location.category}</span>
                        ${!hasValidCoords ? '<span class="badge bg-warning ms-1" title="No map location"><i class="fas fa-map-marker-slash"></i></span>' : ''}
                    </div>
                    <p class="text-muted small mb-1">
                        <i class="fas fa-tasks me-1"></i>${location.services.join(', ')}
                    </p>
                    <p class="text-muted small mb-0">
                        <i class="fas fa-map-marker-alt me-1"></i>${location.address}
                    </p>
                </div>
                <div class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); openLocationModal('${location.id}')">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    locationsList.appendChild(listItem);
}

function getIconForCategory(category) {
    const iconColors = {
        hospital: 'red',
        bank: 'blue', 
        cafe: 'green',
        restaurant: 'orange',
        other: 'gray'
    };
    
    const color = iconColors[category] || 'gray';
    
    // Create custom icon with better visibility
    return L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

function getCategoryIcon(category) {
    const icons = {
        hospital: '🏥',
        bank: '🏦',
        cafe: '☕',
        restaurant: '🍴'
    };
    return icons[category] || '📍';
}

function updateStatistics(totalLocations, categoryCount) {
    document.getElementById('totalLocations').textContent = totalLocations;
    document.getElementById('locationCount').textContent = allLocations.length;
    document.getElementById('hospitalCount').textContent = categoryCount.hospital || 0;
    document.getElementById('bankCount').textContent = categoryCount.bank || 0;
    document.getElementById('cafeCount').textContent = categoryCount.cafe || 0;
}

function setupFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const searchInput = document.getElementById('searchLocation');

    categoryFilter.addEventListener('change', filterLocations);
    searchInput.addEventListener('input', filterLocations);
    
    console.log('✅ Filters setup complete');
}

function filterLocations() {
    const category = document.getElementById('categoryFilter').value;
    const searchTerm = document.getElementById('searchLocation').value.toLowerCase();

    const locationCards = document.querySelectorAll('.location-card');
    
    locationCards.forEach((card, index) => {
        if (index >= allLocations.length) return;
        
        const location = allLocations[index];
        const locationName = location.name.toLowerCase();
        const locationCategory = location.category;
        
        const categoryMatch = category === 'all' || locationCategory === category;
        const searchMatch = locationName.includes(searchTerm) || 
                           location.services.some(service => service.toLowerCase().includes(searchTerm)) ||
                           location.address.toLowerCase().includes(searchTerm);
        
        card.style.display = categoryMatch && searchMatch ? 'block' : 'none';
    });

    // Filter map markers
    markers.forEach((marker, index) => {
        if (index >= allLocations.length) return;
        
        const location = allLocations[index];
        const locationName = location.name.toLowerCase();
        const locationCategory = location.category;
        
        const categoryMatch = category === 'all' || locationCategory === category;
        const searchMatch = locationName.includes(searchTerm);
        
        if (marker && location.hasValidCoords) {
            if (categoryMatch && searchMatch) {
                marker.setOpacity(1);
                if (!map.hasLayer(marker)) {
                    marker.addTo(map);
                }
            } else {
                marker.setOpacity(0.3);
                if (map.hasLayer(marker)) {
                    marker.remove();
                }
            }
        }
    });
}

async function openLocationModal(locationId) {
    try {
        console.log('Opening modal for location:', locationId);
        
        const doc = await db.collection('locations').doc(locationId).get();
        if (!doc.exists) {
            showToast('Location not found', 'error');
            return;
        }
        
        selectedLocation = { 
            id: doc.id, 
            ...doc.data(),
            name: doc.data().name || 'Unnamed Location',
            services: doc.data().services || ['General Service'],
            category: doc.data().category || 'other'
        };
        
        // Update modal content
        document.getElementById('modalLocationName').textContent = selectedLocation.name;
        document.getElementById('modalLocationInfo').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong><i class="fas fa-tag me-2"></i>Category:</strong><br>
                    ${getCategoryIcon(selectedLocation.category)} ${selectedLocation.category}</p>
                    <p><strong><i class="fas fa-map-marker-alt me-2"></i>Address:</strong><br>
                    ${selectedLocation.address}</p>
                </div>
                <div class="col-md-6">
                    <p><strong><i class="fas fa-phone me-2"></i>Phone:</strong><br>
                    ${selectedLocation.phone}</p>
                    <p><strong><i class="fas fa-clock me-2"></i>Hours:</strong><br>
                    ${selectedLocation.hours}</p>
                </div>
            </div>
            <div class="mt-3">
                <strong><i class="fas fa-tasks me-2"></i>Available Services:</strong><br>
                <span class="badge bg-light text-dark me-1">${selectedLocation.services.join('</span> <span class="badge bg-light text-dark me-1">')}</span>
            </div>
        `;
        
        // Load queue information
        await loadQueueInfo(selectedLocation.id);
        
        // Populate services dropdown
        const serviceSelect = document.getElementById('serviceSelect');
        serviceSelect.innerHTML = selectedLocation.services.map(service => 
            `<option value="${service}">${service}</option>`
        ).join('');
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('locationModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error opening location modal:', error);
        showToast('Failed to load location details', 'error');
    }
}

async function loadQueueInfo(locationId) {
    try {
        const queueSnapshot = await db.collection('queues')
            .where('locationId', '==', locationId)
            .where('status', 'in', ['waiting', 'in-progress'])
            .get();
        
        const queueCount = queueSnapshot.size;
        const estimatedWait = queueCount * 5; // 5 minutes per person
        
        document.getElementById('currentQueueCount').textContent = queueCount;
        document.getElementById('estimatedWaitTime').textContent = 
            estimatedWait > 0 ? `${estimatedWait} min` : 'No wait';
            
    } catch (error) {
        console.error('Error loading queue info:', error);
        document.getElementById('currentQueueCount').textContent = 'Error';
        document.getElementById('estimatedWaitTime').textContent = 'Unknown';
    }
}

async function joinQueue() {
    if (!selectedLocation || !currentUser) {
        showToast('Please select a location and ensure you are logged in', 'error');
        return;
    }
    
    const serviceSelect = document.getElementById('serviceSelect');
    const selectedService = serviceSelect.value;
    
    if (!selectedService) {
        showToast('Please select a service', 'error');
        return;
    }
    
    try {
        // Generate unique ticket ID
        const ticketId = 'T' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        
        // Get next position in queue
        const nextPosition = await getNextQueuePosition(selectedLocation.id);
        
        // Get user data
        let userData = {};
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                userData = userDoc.data();
            }
        } catch (userError) {
            console.warn('Could not fetch user data:', userError);
        }

        // Calculate estimated wait time
        const estimatedWait = (nextPosition - 1) * 5;
        
        // Check if this is user's first queue
        const isFirstQueue = await checkIfFirstQueue(currentUser.uid);
        
        // Create queue ticket
        await db.collection('queues').doc(ticketId).set({
            ticketId: ticketId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            customerEmail: currentUser.email,
            customerName: userData.name || 'Customer',
            locationId: selectedLocation.id,
            locationName: selectedLocation.name,
            service: selectedService,
            status: 'waiting',
            position: nextPosition,
            estimatedWait: estimatedWait,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedAt: null,
            isFirstQueue: isFirstQueue,
            welcomeQueueEmailSent: false,
            thankYouEmailSent: false
        });

        // ✅ EMAIL 1: Send Welcome + Queue Details Email
        const emailResult = await sendWelcomeAndQueueEmail(currentUser.email, userData.name || 'Customer', {
            service: selectedService,
            locationName: selectedLocation.name,
            ticketId: ticketId,
            position: nextPosition,
            estimatedWait: estimatedWait + ' minutes',
            isFirstQueue: isFirstQueue
        });

        // If this was their first queue, mark user as no longer first-time
        if (isFirstQueue) {
            await db.collection('users').doc(currentUser.uid).update({
                firstQueueCompleted: true
            });
        }
        
        // Close modal and show success
        const modal = bootstrap.Modal.getInstance(document.getElementById('locationModal'));
        modal.hide();
        
        if (emailResult.simulated) {
            showToast(`Successfully joined queue! Position: ${nextPosition} (Email simulated)`, 'success');
        } else {
            showToast(`Successfully joined queue! Position: ${nextPosition}`, 'success');
        }
        
        // Redirect to track page
        setTimeout(() => {
            window.location.href = `myqueues.html?ticket=${ticketId}`;
        }, 2000);
        
    } catch (error) {
        console.error('Error joining queue:', error);
        showToast('Failed to join queue. Please try again.', 'error');
    }
}

// Enhanced Welcome Email Sender
async function sendWelcomeAndQueueEmail(userEmail, userName, queueData) {
    try {
        // Ensure email service is available
        if (!window.emailService) {
            console.warn('📧 Email service not available - initializing...');
            initializeEmailService();
            
            // Wait a moment for initialization
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('📧 Preparing to send welcome+queue email to:', userEmail);

        const emailData = {
            service: queueData.service,
            locationName: queueData.locationName,
            ticketId: queueData.ticketId,
            position: queueData.position,
            estimatedWait: queueData.estimatedWait,
            isFirstQueue: queueData.isFirstQueue,
            app_name: 'QueueManager',
            support_email: 'support@queuemanager.com',
            current_year: new Date().getFullYear()
        };

        const emailResult = await emailService.sendWelcomeAndQueueEmail(
            userEmail,
            userName,
            emailData
        );
        
        // Update ticket with email sent status
        await db.collection('queues').doc(queueData.ticketId).update({
            welcomeQueueEmailSent: emailResult.success,
            welcomeQueueEmailSentAt: firebase.firestore.FieldValue.serverTimestamp(),
            emailSimulated: emailResult.simulated || false,
            welcomeQueueEmailError: emailResult.error || null
        });

        return emailResult;

    } catch (emailError) {
        console.error('❌ Error in sendWelcomeAndQueueEmail:', emailError);
        
        // Update ticket with failure status
        await db.collection('queues').doc(queueData.ticketId).update({
            welcomeQueueEmailSent: false,
            welcomeQueueEmailError: emailError.message
        });

        return { 
            success: false, 
            error: emailError.message 
        };
    }
}

// Helper function to check if this is user's first queue
async function checkIfFirstQueue(userId) {
    try {
        const previousQueues = await db.collection('queues')
            .where('userId', '==', userId)
            .get();
        
        return previousQueues.empty;
    } catch (error) {
        console.error('Error checking first queue:', error);
        return true; // Assume first queue if we can't check
    }
}

async function getNextQueuePosition(locationId) {
    try {
        const snapshot = await db.collection('queues')
            .where('locationId', '==', locationId)
            .where('status', 'in', ['waiting', 'in-progress'])
            .get();
        
        return snapshot.size + 1;
    } catch (error) {
        console.error('Error getting queue position:', error);
        return 1;
    }
}

function showLoading(show) {
    const locationsList = document.getElementById('locationsList');
    if (show) {
        locationsList.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading locations...</span>
                </div>
                <p class="mt-2 text-muted">Loading locations...</p>
            </div>
        `;
    }
}

// Add missing logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut().then(() => {
            window.location.href = 'auth.html';
        }).catch(error => {
            console.error('Logout error:', error);
            showToast('Logout failed. Please try again.', 'error');
        });
    }
}

// Add missing showToast function
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // Create toast container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${type === 'error' ? 'danger' : type} border-0 show`;
    toast.style.marginBottom = '10px';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

// Make functions globally available
window.openLocationModal = openLocationModal;
window.joinQueue = joinQueue;
window.logout = logout;
window.refreshLocations = loadLocations;
window.filterLocations = filterLocations;
window.showAllLocations = function() {
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('searchLocation').value = '';
    filterLocations();
};

console.log('✅ Map.js loaded successfully with enhanced email service handling');
