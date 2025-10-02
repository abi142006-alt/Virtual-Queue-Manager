let map;
let markers = [];
let currentUser = null;
let selectedLocation = null;

// Initialize map and load locations
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        currentUser = user;
        initMap();
        loadLocations();
        setupFilters();
    });
});

function initMap() {
    // Initialize map centered on Madurai, India
    map = L.map('map').setView([9.9252, 78.1198], 13); // Madurai coordinates
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add a marker for Madurai city center
    L.marker([9.9252, 78.1198])
        .addTo(map)
        .bindPopup('<b>Madurai City Center</b><br>Welcome to Madurai!')
        .openPopup();
}

async function loadLocations() {
    try {
        const snapshot = await db.collection('locations').get();
        const locationsList = document.getElementById('locationsList');
        locationsList.innerHTML = '';
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];

        snapshot.forEach(doc => {
            const location = { id: doc.id, ...doc.data() };
            addLocationToMap(location);
            addLocationToList(location);
        });
    } catch (error) {
        console.error('Error loading locations:', error);
        showToast('Error loading locations. Please refresh the page.', 'error');
    }
}

function addLocationToMap(location) {
    const icon = getIconForCategory(location.category);
    
    const marker = L.marker([location.coords.latitude, location.coords.longitude], { icon })
        .addTo(map)
        .bindPopup(`
            <div>
                <h6>${location.name}</h6>
                <p><strong>Category:</strong> ${getCategoryIcon(location.category)} ${location.category}</p>
                <p><strong>Services:</strong> ${location.services.join(', ')}</p>
                <p><strong>Address:</strong> ${location.address || 'Not specified'}</p>
                <button class="btn btn-sm btn-primary mt-2" onclick="openLocationModal('${location.id}')">
                    Join Queue
                </button>
            </div>
        `);

    markers.push(marker);
}

function addLocationToList(location) {
    const locationsList = document.getElementById('locationsList');
    const listItem = document.createElement('div');
    listItem.className = 'list-group-item location-card';
    listItem.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h6 class="mb-1">${getCategoryIcon(location.category)} ${location.name}</h6>
                <small class="text-muted">${location.services.join(', ')}</small>
                <br>
                <small class="text-muted">${location.address || ''}</small>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="openLocationModal('${location.id}')">
                Join
            </button>
        </div>
    `;
    locationsList.appendChild(listItem);
}

function getIconForCategory(category) {
    const iconUrl = {
        hospital: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        bank: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        cafe: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
    }[category] || 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png';

    return L.icon({
        iconUrl: iconUrl,
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
        cafe: '☕'
    };
    return icons[category] || '📍';
}

function setupFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const searchInput = document.getElementById('searchLocation');

    categoryFilter.addEventListener('change', filterLocations);
    searchInput.addEventListener('input', filterLocations);
}

function filterLocations() {
    const category = document.getElementById('categoryFilter').value;
    const searchTerm = document.getElementById('searchLocation').value.toLowerCase();

    const locationCards = document.querySelectorAll('.location-card');
    
    locationCards.forEach(card => {
        const locationName = card.querySelector('h6').textContent.toLowerCase();
        const locationCategory = card.querySelector('h6').textContent.includes('🏥') ? 'hospital' :
                               card.querySelector('h6').textContent.includes('🏦') ? 'bank' : 'cafe';
        
        const categoryMatch = category === 'all' || locationCategory === category;
        const searchMatch = locationName.includes(searchTerm);
        
        card.style.display = categoryMatch && searchMatch ? 'block' : 'none';
    });

    // Also filter map markers
    markers.forEach(marker => {
        const markerCategory = getMarkerCategory(marker);
        const categoryMatch = category === 'all' || markerCategory === category;
        marker.setOpacity(categoryMatch ? 1 : 0.3);
    });
}

function getMarkerCategory(marker) {
    // Extract category from marker popup content
    const popupContent = marker.getPopup().getContent();
    if (popupContent.includes('🏥')) return 'hospital';
    if (popupContent.includes('🏦')) return 'bank';
    if (popupContent.includes('☕')) return 'cafe';
    return 'other';
}

async function openLocationModal(locationId) {
    try {
        const doc = await db.collection('locations').doc(locationId).get();
        selectedLocation = { id: doc.id, ...doc.data() };
        
        document.getElementById('modalLocationName').textContent = selectedLocation.name;
        document.getElementById('modalLocationInfo').innerHTML = `
            <p><strong>Category:</strong> ${getCategoryIcon(selectedLocation.category)} ${selectedLocation.category}</p>
            <p><strong>Address:</strong> ${selectedLocation.address || 'Not specified'}</p>
            <p><strong>Phone:</strong> ${selectedLocation.phone || 'Not specified'}</p>
            <p><strong>Hours:</strong> ${selectedLocation.hours || 'Not specified'}</p>
        `;
        
        // Populate services dropdown
        const serviceSelect = document.getElementById('serviceSelect');
        serviceSelect.innerHTML = selectedLocation.services.map(service => 
            `<option value="${service}">${service}</option>`
        ).join('');
        
        const modal = new bootstrap.Modal(document.getElementById('locationModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading location:', error);
        showToast('Error loading location details', 'error');
    }
}

async function joinQueue() {
    if (!selectedLocation || !currentUser) return;
    
    const serviceSelect = document.getElementById('serviceSelect');
    const selectedService = serviceSelect.value;
    
    try {
        // Generate unique ticket ID
        const ticketId = 'T' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        
        // Create queue ticket
        await db.collection('queues').doc(ticketId).set({
            ticketId: ticketId,
            userId: currentUser.uid,
            locationId: selectedLocation.id,
            locationName: selectedLocation.name,
            service: selectedService,
            status: 'waiting',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedAt: null
        });
        
        // Close modal and show success message
        const modal = bootstrap.Modal.getInstance(document.getElementById('locationModal'));
        modal.hide();
        
        showToast(`Successfully joined queue! Ticket ID: ${ticketId}`, 'success');
        
        // Optionally redirect to track page
        setTimeout(() => {
            window.location.href = `track.html?ticket=${ticketId}`;
        }, 2000);
        
    } catch (error) {
        console.error('Error joining queue:', error);
        showToast('Error joining queue. Please try again.', 'error');
    }
}

// Simple Toast notification system
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.custom-toast');
    existingToasts.forEach(toast => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });

    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `custom-toast alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    toast.style.minWidth = '300px';
    toast.style.marginBottom = '10px';
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${getToastIcon(type)} me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}