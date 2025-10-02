let currentUser = null;
let unsubscribeQueue = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (!user) {
            // Allow tracking by ticket ID without login
            return;
        }
        
        // Check for ticket ID in URL
        const urlParams = new URLSearchParams(window.location.search);
        const ticketId = urlParams.get('ticket');
        if (ticketId) {
            document.getElementById('ticketIdInput').value = ticketId;
            trackTicket();
        }
    });
});

async function trackTicket() {
    const ticketId = document.getElementById('ticketIdInput').value.trim();
    
    if (!ticketId) {
        alert('Please enter a ticket ID');
        return;
    }

    try {
        // Unsubscribe from previous listener
        if (unsubscribeQueue) {
            unsubscribeQueue();
        }

        // Set up real-time listener for this ticket
        unsubscribeQueue = db.collection('queues').doc(ticketId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const ticket = doc.data();
                    displayTicketInfo(ticket);
                } else {
                    document.getElementById('queueInfo').style.display = 'none';
                    alert('Ticket not found. Please check your ticket ID.');
                }
            }, (error) => {
                console.error('Error tracking ticket:', error);
                alert('Error tracking ticket. Please try again.');
            });

    } catch (error) {
        console.error('Error tracking ticket:', error);
        alert('Error tracking ticket. Please try again.');
    }
}

function displayTicketInfo(ticket) {
    const queueInfo = document.getElementById('queueInfo');
    const ticketDetails = document.getElementById('ticketDetails');
    const queueProgress = document.getElementById('queueProgress');
    const queueStats = document.getElementById('queueStats');

    // Hide other sections
    document.getElementById('myTicketsSection').style.display = 'none';
    document.getElementById('noTicketsMessage').style.display = 'none';
    
    // Show queue info section
    queueInfo.style.display = 'block';

    // Update ticket details
    ticketDetails.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                <p><strong>Location:</strong> ${ticket.locationName}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Service:</strong> ${ticket.service}</p>
                <p><strong>Status:</strong> 
                    <span class="badge ${getStatusBadgeClass(ticket.status)}">
                        ${ticket.status.toUpperCase()}
                    </span>
                </p>
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-12">
                <p><strong>Joined:</strong> ${formatDate(ticket.createdAt?.toDate())}</p>
            </div>
        </div>
    `;

    // Update progress bar based on status
    let progressWidth = 0;
    let progressClass = 'bg-warning';
    
    switch (ticket.status) {
        case 'waiting':
            progressWidth = 33;
            progressClass = 'bg-warning';
            break;
        case 'serving':
            progressWidth = 66;
            progressClass = 'bg-info';
            break;
        case 'completed':
            progressWidth = 100;
            progressClass = 'bg-success';
            break;
        case 'no-show':
            progressWidth = 100;
            progressClass = 'bg-danger';
            break;
    }

    queueProgress.style.width = `${progressWidth}%`;
    queueProgress.className = `progress-bar ${progressClass}`;

    // Update queue statistics
    if (ticket.status === 'waiting') {
        // Get position in queue
        getQueuePosition(ticket.locationId, ticket.service, ticket.createdAt)
            .then(position => {
                queueStats.innerHTML = `
                    <p class="mb-1"><strong>Your position in queue:</strong> ${position}</p>
                    <small class="text-muted">Estimated wait time: ${estimateWaitTime(position)} minutes</small>
                `;
            });
    } else {
        queueStats.innerHTML = `
            <p class="mb-1"><strong>Current Status:</strong> ${ticket.status.toUpperCase()}</p>
            ${ticket.completedAt ? 
                `<small class="text-muted">Completed: ${formatDate(ticket.completedAt.toDate())}</small>` : 
                ''
            }
        `;
    }
}

async function getQueuePosition(locationId, service, createdAt) {
    try {
        const snapshot = await db.collection('queues')
            .where('locationId', '==', locationId)
            .where('service', '==', service)
            .where('status', '==', 'waiting')
            .orderBy('createdAt', 'asc')
            .get();

        const waitingTickets = snapshot.docs.map(doc => doc.data());
        const position = waitingTickets.findIndex(ticket => 
            ticket.createdAt.seconds === createdAt.seconds
        ) + 1;

        return position > 0 ? position : 'Unknown';
    } catch (error) {
        console.error('Error getting queue position:', error);
        return 'Unknown';
    }
}

function estimateWaitTime(position) {
    // Simple estimation: 5 minutes per person in front
    return Math.max(1, (position - 1) * 5);
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

async function loadMyTickets() {
    if (!currentUser) {
        alert('Please log in to view your tickets');
        window.location.href = 'auth.html';
        return;
    }

    try {
        const snapshot = await db.collection('queues')
            .where('userId', '==', currentUser.uid)
            .where('status', 'in', ['waiting', 'serving'])
            .orderBy('createdAt', 'desc')
            .get();

        const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const myTicketsSection = document.getElementById('myTicketsSection');
        const myTicketsList = document.getElementById('myTicketsList');
        const noTicketsMessage = document.getElementById('noTicketsMessage');

        // Hide other sections
        document.getElementById('queueInfo').style.display = 'none';

        if (tickets.length === 0) {
            myTicketsSection.style.display = 'none';
            noTicketsMessage.style.display = 'block';
            return;
        }

        myTicketsSection.style.display = 'block';
        noTicketsMessage.style.display = 'none';

        myTicketsList.innerHTML = tickets.map(ticket => `
            <div class="card mb-2">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <h6 class="mb-1">${ticket.service}</h6>
                            <p class="mb-1 text-muted">${ticket.locationName}</p>
                            <small class="text-muted">Ticket: ${ticket.ticketId}</small>
                        </div>
                        <div class="col-md-4">
                            <span class="badge ${getStatusBadgeClass(ticket.status)}">
                                ${ticket.status.toUpperCase()}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="trackTicketById('${ticket.ticketId}')">
                                Track
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading tickets:', error);
        alert('Error loading your tickets');
    }
}

function trackTicketById(ticketId) {
    document.getElementById('ticketIdInput').value = ticketId;
    trackTicket();
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}