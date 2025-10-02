let currentUser = null;
let unsubscribeActive = null;
let unsubscribeHistory = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        currentUser = user;
        loadActiveTickets();
        setupTabListeners();
    });
});

function setupTabListeners() {
    // Load history when history tab is clicked
    document.querySelector('a[href="#history"]').addEventListener('shown.bs.tab', function() {
        loadHistoryTickets();
    });
}

function loadActiveTickets() {
    const activeTicketsList = document.getElementById('activeTicketsList');
    
    // Set up real-time listener for active tickets
    unsubscribeActive = db.collection('queues')
        .where('userId', '==', currentUser.uid)
        .where('status', 'in', ['waiting', 'serving'])
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayActiveTickets(tickets);
        }, (error) => {
            console.error('Error loading active tickets:', error);
            activeTicketsList.innerHTML = '<div class="alert alert-danger">Error loading tickets</div>';
        });
}

function displayActiveTickets(tickets) {
    const activeTicketsList = document.getElementById('activeTicketsList');
    
    if (tickets.length === 0) {
        activeTicketsList.innerHTML = `
            <div class="alert alert-info text-center">
                <i class="fas fa-info-circle"></i> No active tickets found.
            </div>
        `;
        return;
    }

    activeTicketsList.innerHTML = tickets.map(ticket => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h5 class="card-title">${ticket.service}</h5>
                        <p class="card-text mb-1">
                            <strong>Location:</strong> ${ticket.locationName}
                        </p>
                        <p class="card-text mb-1">
                            <strong>Ticket ID:</strong> ${ticket.ticketId}
                        </p>
                        <p class="card-text mb-1">
                            <strong>Joined:</strong> ${formatDate(ticket.createdAt?.toDate())}
                        </p>
                        <p class="card-text">
                            <strong>Wait Time:</strong> ${calculateWaitTime(ticket.createdAt)} minutes
                        </p>
                    </div>
                    <div class="col-md-2 text-center">
                        <span class="badge ${getStatusBadgeClass(ticket.status)} fs-6">
                            ${ticket.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="col-md-2">
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary btn-sm" 
                                    onclick="trackTicket('${ticket.ticketId}')">
                                <i class="fas fa-eye"></i> Track
                            </button>
                        </div>
                    </div>
                </div>
                ${ticket.status === 'waiting' ? `
                    <div class="mt-3">
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                 style="width: 33%"></div>
                        </div>
                        <small class="text-muted">Waiting in queue...</small>
                    </div>
                ` : ''}
                ${ticket.status === 'serving' ? `
                    <div class="mt-3">
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar bg-info" style="width: 66%"></div>
                        </div>
                        <small class="text-muted">Currently being served</small>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function loadHistoryTickets() {
    const historyTicketsList = document.getElementById('historyTicketsList');
    
    // Unsubscribe from previous listener
    if (unsubscribeHistory) {
        unsubscribeHistory();
    }

    // Set up real-time listener for history tickets
    unsubscribeHistory = db.collection('queues')
        .where('userId', '==', currentUser.uid)
        .where('status', 'in', ['completed', 'no-show'])
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayHistoryTickets(tickets);
        }, (error) => {
            console.error('Error loading history tickets:', error);
            historyTicketsList.innerHTML = '<div class="alert alert-danger">Error loading history</div>';
        });
}

function displayHistoryTickets(tickets) {
    const historyTicketsList = document.getElementById('historyTicketsList');
    
    if (tickets.length === 0) {
        historyTicketsList.innerHTML = `
            <div class="alert alert-info text-center">
                <i class="fas fa-info-circle"></i> No history tickets found.
            </div>
        `;
        return;
    }

    historyTicketsList.innerHTML = tickets.map(ticket => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h5 class="card-title">${ticket.service}</h5>
                        <p class="card-text mb-1">
                            <strong>Location:</strong> ${ticket.locationName}
                        </p>
                        <p class="card-text mb-1">
                            <strong>Ticket ID:</strong> ${ticket.ticketId}
                        </p>
                        <p class="card-text mb-1">
                            <strong>Joined:</strong> ${formatDate(ticket.createdAt?.toDate())}
                        </p>
                        <p class="card-text mb-1">
                            <strong>Completed:</strong> ${formatDate(ticket.completedAt?.toDate())}
                        </p>
                        ${ticket.status === 'completed' ? `
                            <p class="card-text">
                                <strong>Total Wait Time:</strong> ${calculateTotalWaitTime(ticket)} minutes
                            </p>
                        ` : ''}
                    </div>
                    <div class="col-md-2 text-center">
                        <span class="badge ${getStatusBadgeClass(ticket.status)} fs-6">
                            ${ticket.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="col-md-2">
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar ${ticket.status === 'completed' ? 'bg-success' : 'bg-danger'}" 
                                 style="width: 100%"></div>
                        </div>
                        <small class="text-muted">
                            ${ticket.status === 'completed' ? 'Completed' : 'No Show'}
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function calculateWaitTime(createdAt) {
    if (!createdAt) return 'Unknown';
    const created = createdAt.toDate();
    const now = new Date();
    return Math.round((now - created) / 60000); // minutes
}

function calculateTotalWaitTime(ticket) {
    if (!ticket.createdAt || !ticket.completedAt) return 'Unknown';
    const created = ticket.createdAt.toDate();
    const completed = ticket.completedAt.toDate();
    return Math.round((completed - created) / 60000); // minutes
}

function getStatusBadgeClass(status) {
    const classes = {
        waiting: 'bg-warning',
        serving: 'bg-info',
        completed: 'bg-success',
        'no-show': 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

function formatDate(date) {
    if (!date) return 'N/A';
    return date.toLocaleString();
}

function trackTicket(ticketId) {
    window.location.href = `track.html?ticket=${ticketId}`;
}

function logout() {
    // Clean up listeners
    if (unsubscribeActive) unsubscribeActive();
    if (unsubscribeHistory) unsubscribeHistory();
    
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Clean up listeners when leaving page
window.addEventListener('beforeunload', () => {
    if (unsubscribeActive) unsubscribeActive();
    if (unsubscribeHistory) unsubscribeHistory();
});