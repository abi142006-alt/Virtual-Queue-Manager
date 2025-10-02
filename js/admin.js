let currentAdmin = null;
let currentLocation = null;
let currentServingTicket = null;
let charts = {};
let unsubscribeQueue = null;

// DOM Elements cache
let domElements = {};

document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    cacheDOMElements();
    
    // Show loading state
    showLoadingState();

    // Enhanced admin authentication check
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            redirectToAdminLogin();
            return;
        }

        try {
            // Verify admin role with enhanced security
            const isAdmin = await verifyAdminAccess(user);
            
            if (!isAdmin) {
                showAccessDenied();
                return;
            }

            currentAdmin = user;
            await initializeAdminDashboard();
            
        } catch (error) {
            console.error('Admin dashboard initialization error:', error);
            showError('Failed to initialize dashboard. Please refresh the page.');
        }
    });
});

function cacheDOMElements() {
    domElements = {
        loadingSpinner: document.getElementById('loadingSpinner'),
        dashboardContent: document.getElementById('dashboardContent'),
        adminWelcome: document.getElementById('adminWelcome'),
        adminEmail: document.getElementById('adminEmail'),
        locationSelect: document.getElementById('locationSelect'),
        currentQueueSection: document.getElementById('currentQueueSection'),
        currentQueueInfo: document.getElementById('currentQueueInfo'),
        waitingTicketsList: document.getElementById('waitingTicketsList'),
        waitingCount: document.getElementById('waitingCount'),
        servingCount: document.getElementById('servingCount'),
        completedCount: document.getElementById('completedCount'),
        noShowCount: document.getElementById('noShowCount'),
        ticketsChart: document.getElementById('ticketsChart'),
        waitTimeChart: document.getElementById('waitTimeChart'),
        statusChart: document.getElementById('statusChart')
    };
}

function showLoadingState() {
    if (domElements.loadingSpinner) {
        domElements.loadingSpinner.style.display = 'block';
    }
    if (domElements.dashboardContent) {
        domElements.dashboardContent.style.display = 'none';
    }
}

function showDashboard() {
    if (domElements.loadingSpinner) {
        domElements.loadingSpinner.style.display = 'none';
    }
    if (domElements.dashboardContent) {
        domElements.dashboardContent.style.display = 'block';
    }
}

async function verifyAdminAccess(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            console.warn('Admin user document not found:', user.uid);
            return false;
        }

        const userData = userDoc.data();
        const isAdmin = userData.role === 'admin' && userData.isActive !== false;
        
        if (isAdmin) {
            // Update last login
            await db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Error verifying admin access:', error);
        return false;
    }
}

async function initializeAdminDashboard() {
    try {
        // Load admin data
        const userDoc = await db.collection('users').doc(currentAdmin.uid).get();
        const adminData = userDoc.data();
        
        // Update UI with admin info
        if (domElements.adminWelcome) {
            domElements.adminWelcome.textContent = `Welcome, ${adminData.name || 'Admin'}`;
        }
        
        if (domElements.adminEmail) {
            domElements.adminEmail.textContent = currentAdmin.email;
        }

        // Initialize dashboard components
        await loadLocations();
        setupRealTimeStats();
        initializeCharts();
        loadAnalyticsData();
        
        // Show dashboard
        showDashboard();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        throw error;
    }
}

async function loadLocations() {
    try {
        if (!domElements.locationSelect) {
            console.warn('Location select element not found');
            return;
        }

        const snapshot = await db.collection('locations').get();
        
        domElements.locationSelect.innerHTML = '<option value="">Select a location</option>' +
            snapshot.docs.map(doc => {
                const location = doc.data();
                return `<option value="${doc.id}">${location.name}</option>`;
            }).join('');
            
    } catch (error) {
        console.error('Error loading locations:', error);
        showToast('Error loading locations', 'error');
    }
}

async function loadLocationQueues() {
    if (!domElements.locationSelect) return;
    
    const locationId = domElements.locationSelect.value;
    if (!locationId) return;

    currentLocation = locationId;
    
    try {
        // Get location details
        const locationDoc = await db.collection('locations').doc(locationId).get();
        if (!locationDoc.exists) {
            showToast('Location not found', 'error');
            return;
        }

        const location = locationDoc.data();

        // Load current serving ticket
        const servingSnapshot = await db.collection('queues')
            .where('locationId', '==', locationId)
            .where('status', '==', 'serving')
            .limit(1)
            .get();

        if (!servingSnapshot.empty) {
            const servingDoc = servingSnapshot.docs[0];
            currentServingTicket = { 
                id: servingDoc.id, 
                ...servingDoc.data() 
            };
            await displayCurrentQueueInfo(currentServingTicket, location); // Added await here
        } else {
            // No one currently being served
            currentServingTicket = null;
            if (domElements.currentQueueSection) {
                domElements.currentQueueSection.style.display = 'block';
            }
            if (domElements.currentQueueInfo) {
                domElements.currentQueueInfo.innerHTML = `
                    <p class="mb-0"><strong>No one currently being served.</strong></p>
                    <p class="mb-0">Click "Call Next" to start serving the next customer.</p>
                `;
            }
        }

        // Load waiting list
        await loadWaitingList(locationId);

    } catch (error) {
        console.error('Error loading location queues:', error);
        showToast('Error loading queue data', 'error');
    }
}

// FIXED: Added async keyword to this function
async function displayCurrentQueueInfo(ticket, location) {
    if (domElements.currentQueueSection) {
        domElements.currentQueueSection.style.display = 'block';
    }
    
    if (!domElements.currentQueueInfo) return;
    
    const waitTime = ticket.createdAt ? 
        Math.round((new Date() - ticket.createdAt.toDate()) / 60000) : 'Unknown';
    
    let customerInfo = '';
    if (ticket.customerName) {
        customerInfo = `<p class="mb-1"><strong>Customer:</strong> ${ticket.customerName}</p>`;
    } else if (ticket.userId) {
        // Try to fetch user name if not directly stored
        try {
            const userDoc = await db.collection('users').doc(ticket.userId).get(); // This needs await
            if (userDoc.exists) {
                const userData = userDoc.data();
                customerInfo = `<p class="mb-1"><strong>Customer:</strong> ${userData.name || 'Unknown'}</p>`;
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }
    
    domElements.currentQueueInfo.innerHTML = `
        <p class="mb-1"><strong>Currently Serving:</strong> ${ticket.service}</p>
        <p class="mb-1"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
        ${customerInfo}
        <p class="mb-1"><strong>Customer Wait Time:</strong> ${waitTime} minutes</p>
        <p class="mb-0"><strong>Started Serving:</strong> ${formatDate(new Date())}</p>
    `;
}

async function loadWaitingList(locationId) {
    try {
        if (!domElements.waitingTicketsList) {
            console.warn('Waiting tickets list element not found');
            return;
        }

        const snapshot = await db.collection('queues')
            .where('locationId', '==', locationId)
            .where('status', '==', 'waiting')
            .orderBy('createdAt', 'asc')
            .get();

        const waitingList = domElements.waitingTicketsList;
        
        if (snapshot.empty) {
            waitingList.innerHTML = '<div class="alert alert-info">No customers waiting</div>';
            return;
        }

        // Fetch user details for each ticket if customerName is not available
        const ticketsWithUserData = await Promise.all(
            snapshot.docs.map(async (doc, index) => {
                const ticket = { 
                    id: doc.id, 
                    position: index + 1, 
                    ...doc.data() 
                };
                
                // If customerName is not available but userId exists, fetch user details
                if (!ticket.customerName && ticket.userId) {
                    try {
                        const userDoc = await db.collection('users').doc(ticket.userId).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            ticket.customerName = userData.name || 'Unknown Customer';
                        }
                    } catch (error) {
                        console.error('Error fetching user data:', error);
                        ticket.customerName = 'Unknown Customer';
                    }
                } else if (!ticket.customerName) {
                    ticket.customerName = 'Walk-in Customer';
                }
                
                return ticket;
            })
        );

        waitingList.innerHTML = ticketsWithUserData.map(ticket => `
            <div class="card mb-2">
                <div class="card-body py-2">
                    <div class="row align-items-center">
                        <div class="col-1">
                            <span class="badge bg-primary">${ticket.position}</span>
                        </div>
                        <div class="col-5">
                            <small class="d-block"><strong>${ticket.service}</strong></small>
                            <small class="d-block text-muted">Ticket: ${ticket.ticketId}</small>
                            <small class="d-block"><strong>Customer:</strong> ${ticket.customerName}</small>
                        </div>
                        <div class="col-3">
                            <small class="text-muted">
                                Wait: ${Math.round((new Date() - ticket.createdAt.toDate()) / 60000)}min
                            </small>
                        </div>
                        <div class="col-3">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="serveTicket('${ticket.id}', '${ticket.ticketId}')">
                                Serve
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading waiting list:', error);
        showToast('Error loading waiting list', 'error');
    }
}

async function callNext() {
    if (!currentLocation) {
        showToast('Please select a location first', 'warning');
        return;
    }

    try {
        // Get the next waiting ticket
        const nextTicketSnapshot = await db.collection('queues')
            .where('locationId', '==', currentLocation)
            .where('status', '==', 'waiting')
            .orderBy('createdAt', 'asc')
            .limit(1)
            .get();

        if (nextTicketSnapshot.empty) {
            showToast('No customers waiting in queue', 'info');
            return;
        }

        const nextTicketDoc = nextTicketSnapshot.docs[0];
        const nextTicket = nextTicketDoc.data();

        // Verify document still exists before updating
        const ticketRef = db.collection('queues').doc(nextTicketDoc.id);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists) {
            showToast('Ticket no longer exists', 'error');
            await loadLocationQueues();
            return;
        }

        // Update ticket status to serving
        await ticketRef.update({
            status: 'serving',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            servedBy: currentAdmin.email,
            servedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        currentServingTicket = { 
            id: nextTicketDoc.id, 
            ...nextTicket, 
            status: 'serving' 
        };
        
        // Reload queue display
        const locationDoc = await db.collection('locations').doc(currentLocation).get();
        await displayCurrentQueueInfo(currentServingTicket, locationDoc.data());
        await loadWaitingList(currentLocation);

        showToast(`Now serving: ${nextTicket.service} - Ticket ${nextTicket.ticketId} - ${nextTicket.customerName || 'Customer'}`, 'success');

    } catch (error) {
        console.error('Error calling next ticket:', error);
        if (error.code === 'not-found') {
            showToast('Ticket was deleted or does not exist', 'error');
            await loadLocationQueues();
        } else {
            showToast('Error calling next ticket', 'error');
        }
    }
}

async function serveTicket(ticketId, ticketNumber) {
    try {
        // Verify document exists before updating
        const ticketRef = db.collection('queues').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists) {
            showToast(`Ticket ${ticketNumber} no longer exists`, 'error');
            await loadLocationQueues();
            return;
        }

        const ticket = ticketDoc.data();

        // Update ticket status to serving
        await ticketRef.update({
            status: 'serving',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            servedBy: currentAdmin.email,
            servedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        currentServingTicket = { 
            id: ticketId, 
            ...ticket, 
            status: 'serving' 
        };
        
        // Reload queue display
        const locationDoc = await db.collection('locations').doc(currentLocation).get();
        await displayCurrentQueueInfo(currentServingTicket, locationDoc.data());
        await loadWaitingList(currentLocation);

        showToast(`Now serving: ${ticket.service} - Ticket ${ticket.ticketId} - ${ticket.customerName || 'Customer'}`, 'success');

    } catch (error) {
        console.error('Error serving ticket:', error);
        if (error.code === 'not-found') {
            showToast('Ticket was deleted or does not exist', 'error');
            await loadLocationQueues();
        } else {
            showToast('Error serving ticket', 'error');
        }
    }
}

async function completeCurrent() {
    if (!currentServingTicket) {
        showToast('No ticket currently being served', 'warning');
        return;
    }

    try {
        // Verify document exists before updating
        const ticketRef = db.collection('queues').doc(currentServingTicket.id);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists) {
            showToast('Ticket no longer exists', 'error');
            currentServingTicket = null;
            await loadLocationQueues();
            return;
        }

        await ticketRef.update({
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedBy: currentAdmin.email
        });

        showToast(`Completed: ${currentServingTicket.service} - Ticket ${currentServingTicket.ticketId} - ${currentServingTicket.customerName || 'Customer'}`, 'success');
        currentServingTicket = null;
        await loadLocationQueues();

    } catch (error) {
        console.error('Error completing ticket:', error);
        if (error.code === 'not-found') {
            showToast('Ticket was deleted or does not exist', 'error');
            currentServingTicket = null;
            await loadLocationQueues();
        } else {
            showToast('Error completing ticket', 'error');
        }
    }
}

async function markNoShow() {
    if (!currentServingTicket) {
        showToast('No ticket currently being served', 'warning');
        return;
    }

    try {
        // Verify document exists before updating
        const ticketRef = db.collection('queues').doc(currentServingTicket.id);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists) {
            showToast('Ticket no longer exists', 'error');
            currentServingTicket = null;
            await loadLocationQueues();
            return;
        }

        await ticketRef.update({
            status: 'no-show',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedBy: currentAdmin.email
        });

        showToast(`Marked as no-show: ${currentServingTicket.service} - Ticket ${currentServingTicket.ticketId} - ${currentServingTicket.customerName || 'Customer'}`, 'success');
        currentServingTicket = null;
        await loadLocationQueues();

    } catch (error) {
        console.error('Error marking no-show:', error);
        if (error.code === 'not-found') {
            showToast('Ticket was deleted or does not exist', 'error');
            currentServingTicket = null;
            await loadLocationQueues();
        } else {
            showToast('Error marking no-show', 'error');
        }
    }
}

function setupRealTimeStats() {
    // Real-time listener for queue statistics
    db.collection('queues').onSnapshot((snapshot) => {
        const stats = {
            waiting: 0,
            serving: 0,
            completed: 0,
            'no-show': 0
        };

        snapshot.forEach(doc => {
            const ticket = doc.data();
            if (stats.hasOwnProperty(ticket.status)) {
                stats[ticket.status]++;
            }
        });

        // Update UI with null checks
        if (domElements.waitingCount) domElements.waitingCount.textContent = stats.waiting;
        if (domElements.servingCount) domElements.servingCount.textContent = stats.serving;
        if (domElements.completedCount) domElements.completedCount.textContent = stats.completed;
        if (domElements.noShowCount) domElements.noShowCount.textContent = stats['no-show'];
    }, (error) => {
        console.error('Error in real-time stats:', error);
    });
}

function initializeCharts() {
    // Tickets per day chart
    if (domElements.ticketsChart) {
        charts.tickets = new Chart(domElements.ticketsChart, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Tickets per Day',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Average wait time chart
    if (domElements.waitTimeChart) {
        charts.waitTime = new Chart(domElements.waitTimeChart, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Average Wait Time (minutes)',
                    data: [],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Status distribution chart
    if (domElements.statusChart) {
        charts.status = new Chart(domElements.statusChart, {
            type: 'pie',
            data: {
                labels: ['Waiting', 'Serving', 'Completed', 'No-Show'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(255, 205, 86, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(255, 99, 132, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 205, 86, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true
            }
        });
    }
}

async function loadAnalyticsData() {
    try {
        // Load last 7 days of data
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const snapshot = await db.collection('queues')
            .where('createdAt', '>=', sevenDaysAgo)
            .get();

        const ticketsByDay = {};
        const waitTimesByDay = {};
        const statusCounts = { waiting: 0, serving: 0, completed: 0, 'no-show': 0 };

        snapshot.forEach(doc => {
            const ticket = doc.data();
            const date = ticket.createdAt.toDate().toLocaleDateString();
            
            // Count tickets per day
            ticketsByDay[date] = (ticketsByDay[date] || 0) + 1;

            // Calculate wait times for completed tickets
            if (ticket.status === 'completed' && ticket.createdAt && ticket.completedAt) {
                const waitTime = (ticket.completedAt.toDate() - ticket.createdAt.toDate()) / 60000; // minutes
                waitTimesByDay[date] = waitTimesByDay[date] || [];
                waitTimesByDay[date].push(waitTime);
            }

            // Count statuses
            if (statusCounts.hasOwnProperty(ticket.status)) {
                statusCounts[ticket.status]++;
            }
        });

        // Update charts
        updateTicketsChart(ticketsByDay);
        updateWaitTimeChart(waitTimesByDay);
        updateStatusChart(statusCounts);

    } catch (error) {
        console.error('Error loading analytics data:', error);
    }
}

function updateTicketsChart(ticketsByDay) {
    if (!charts.tickets) return;
    
    const labels = Object.keys(ticketsByDay).sort();
    const data = labels.map(date => ticketsByDay[date]);

    charts.tickets.data.labels = labels;
    charts.tickets.data.datasets[0].data = data;
    charts.tickets.update();
}

function updateWaitTimeChart(waitTimesByDay) {
    if (!charts.waitTime) return;
    
    const labels = Object.keys(waitTimesByDay).sort();
    const data = labels.map(date => {
        const times = waitTimesByDay[date];
        return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    });

    charts.waitTime.data.labels = labels;
    charts.waitTime.data.datasets[0].data = data;
    charts.waitTime.update();
}

function updateStatusChart(statusCounts) {
    if (!charts.status) return;
    
    charts.status.data.datasets[0].data = [
        statusCounts.waiting,
        statusCounts.serving,
        statusCounts.completed,
        statusCounts['no-show']
    ];
    charts.status.update();
}

function formatDate(date) {
    if (!date) return 'N/A';
    return date.toLocaleString();
}

// Simple Toast notification system (without Bootstrap dependency)
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
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${getToastIcon(type)} me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
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
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

function redirectToAdminLogin() {
    window.location.href = 'admin-login.html';
}

function showAccessDenied() {
    document.body.innerHTML = `
        <div class="container-fluid vh-100 d-flex align-items-center justify-content-center bg-light">
            <div class="card shadow-lg border-0" style="max-width: 400px;">
                <div class="card-body text-center p-5">
                    <div class="text-danger mb-4">
                        <i class="fas fa-ban fa-4x"></i>
                    </div>
                    <h3 class="text-danger mb-3">Access Denied</h3>
                    <p class="text-muted mb-4">
                        You don't have permission to access the admin dashboard. 
                        Please use an admin account to continue.
                    </p>
                    <div class="d-grid gap-2">
                        <a href="admin-login.html" class="btn btn-primary">
                            <i class="fas fa-sign-in-alt me-2"></i>Go to Admin Login
                        </a>
                        <a href="index.html" class="btn btn-outline-secondary">
                            <i class="fas fa-home me-2"></i>Back to Home
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showError(message) {
    document.body.innerHTML = `
        <div class="container-fluid vh-100 d-flex align-items-center justify-content-center bg-light">
            <div class="card shadow-lg border-0" style="max-width: 400px;">
                <div class="card-body text-center p-5">
                    <div class="text-warning mb-4">
                        <i class="fas fa-exclamation-triangle fa-4x"></i>
                    </div>
                    <h3 class="text-warning mb-3">System Error</h3>
                    <p class="text-muted mb-4">${message}</p>
                    <div class="d-grid gap-2">
                        <button onclick="window.location.reload()" class="btn btn-primary">
                            <i class="fas fa-redo me-2"></i>Refresh Page
                        </button>
                        <a href="admin-login.html" class="btn btn-outline-secondary">
                            <i class="fas fa-sign-in-alt me-2"></i>Back to Login
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function adminLogout() {
    auth.signOut().then(() => {
        window.location.href = 'admin-login.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        window.location.href = 'admin-login.html';
    });
}
