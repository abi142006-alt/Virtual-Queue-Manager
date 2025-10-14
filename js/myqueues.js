// myqueues.js
let currentUser = null;
let activeQueues = [];
let queueHistory = [];

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = user;
        loadUserQueues();
        setupRealTimeListeners();
    });
});

function loadUserQueues() {
    showLoading(true);
    
    // Load active queues (waiting, in-progress)
    db.collection('queues')
        .where('userId', '==', currentUser.uid)
        .where('status', 'in', ['waiting', 'in-progress'])
        .orderBy('createdAt', 'desc')
        .get()
        .then((snapshot) => {
            activeQueues = [];
            snapshot.forEach(doc => {
                activeQueues.push({ id: doc.id, ...doc.data() });
            });
            displayActiveQueues();
        })
        .catch((error) => {
            console.error('Error loading active queues:', error);
            showError('Failed to load active queues');
        });

    // Load queue history (completed, cancelled)
    db.collection('queues')
        .where('userId', '==', currentUser.uid)
        .where('status', 'in', ['completed', 'cancelled'])
        .orderBy('createdAt', 'desc')
        .limit(20) // Limit to last 20 for performance
        .get()
        .then((snapshot) => {
            queueHistory = [];
            snapshot.forEach(doc => {
                queueHistory.push({ id: doc.id, ...doc.data() });
            });
            displayQueueHistory();
            showLoading(false);
        })
        .catch((error) => {
            console.error('Error loading queue history:', error);
            showError('Failed to load queue history');
            showLoading(false);
        });
}

function displayActiveQueues() {
    const activeQueuesList = document.getElementById('activeQueuesList');
    const activeCount = document.getElementById('activeCount');
    
    if (activeQueues.length === 0) {
        activeQueuesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h4 class="text-muted">No Active Queues</h4>
                <p class="text-muted">Join a queue from the map to see it here</p>
                
                  
                </a>
            </div>
        `;
        activeCount.textContent = '0';
        return;
    }

    activeCount.textContent = activeQueues.length;
    
    activeQueuesList.innerHTML = activeQueues.map(queue => `
        <div class="queue-card active-queue m-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-2 text-center">
                        <div class="position-badge">${queue.position || 'N/A'}</div>
                        <small class="text-muted">Position</small>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="card-title mb-2">${queue.service}</h5>
                        <p class="card-text mb-1">
                            <i class="fas fa-building me-2 text-muted"></i>
                            <strong>Location:</strong> ${queue.locationName}
                        </p>
                        <p class="card-text mb-1">
                            <i class="fas fa-ticket-alt me-2 text-muted"></i>
                            <strong>Ticket ID:</strong> 
                            <span class="badge bg-dark">${queue.ticketId}</span>
                        </p>
                        <p class="card-text mb-0">
                            <i class="fas fa-clock me-2 text-muted"></i>
                            <strong>Joined:</strong> 
                            ${formatDate(queue.createdAt?.toDate())}
                        </p>
                    </div>
                    
                    <div class="col-md-4 text-center">
                        <div class="mb-3">
                            <span class="wait-time">
                                <i class="fas fa-clock me-1"></i>
                                ${calculateWaitTime(queue.position)} min
                            </span>
                        </div>
                        <div class="mb-2">
                            <span class="badge status-badge bg-${getStatusColor(queue.status)}">
                                ${getStatusIcon(queue.status)} ${queue.status.toUpperCase()}
                            </span>
                        </div>
                        <button class="btn btn-outline-danger btn-sm" onclick="leaveQueue('${queue.id}')">
                            <i class="fas fa-sign-out-alt me-1"></i>Leave
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function displayQueueHistory() {
    const queueHistoryList = document.getElementById('queueHistoryList');
    const historyCount = document.getElementById('historyCount');
    
    if (queueHistory.length === 0) {
        queueHistoryList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h4 class="text-muted">No Queue History</h4>
                <p class="text-muted">Your completed queues will appear here</p>
            </div>
        `;
        historyCount.textContent = '0';
        return;
    }

    historyCount.textContent = queueHistory.length;
    
    queueHistoryList.innerHTML = queueHistory.map(queue => `
        <div class="queue-card completed-queue m-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h6 class="card-title mb-2">${queue.service}</h6>
                        <p class="card-text mb-1 small">
                            <i class="fas fa-building me-2 text-muted"></i>
                            <strong>Location:</strong> ${queue.locationName}
                        </p>
                        <p class="card-text mb-1 small">
                            <i class="fas fa-ticket-alt me-2 text-muted"></i>
                            <strong>Ticket ID:</strong> 
                            <span class="badge bg-secondary">${queue.ticketId}</span>
                        </p>
                        <p class="card-text mb-1 small">
                            <i class="fas fa-calendar me-2 text-muted"></i>
                            <strong>Completed:</strong> 
                            ${formatDate(queue.completedAt?.toDate() || queue.createdAt?.toDate())}
                        </p>
                    </div>
                    
                    <div class="col-md-4 text-end">
                        <div class="mb-2">
                            <span class="badge status-badge bg-${getStatusColor(queue.status)}">
                                ${getStatusIcon(queue.status)} ${queue.status.toUpperCase()}
                            </span>
                        </div>
                        <small class="text-muted">
                            Final Position: ${queue.position || 'N/A'}
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function leaveQueue(queueId) {
    if (!confirm('Are you sure you want to leave this queue?')) {
        return;
    }

    showLoading(true);
    
    db.collection('queues').doc(queueId).update({
        status: 'cancelled',
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        showSuccess('Successfully left the queue');
        loadUserQueues(); // Reload the lists
    })
    .catch((error) => {
        console.error('Error leaving queue:', error);
        showError('Failed to leave queue');
        showLoading(false);
    });
}

function setupRealTimeListeners() {
    // Real-time listener for active queues
    db.collection('queues')
        .where('userId', '==', currentUser.uid)
        .where('status', 'in', ['waiting', 'in-progress'])
        .onSnapshot((snapshot) => {
            const changes = snapshot.docChanges();
            if (changes.length > 0) {
                loadUserQueues(); // Reload when there are changes
            }
        });
}

// Utility Functions
function calculateWaitTime(position) {
    if (!position) return 'N/A';
    return Math.max(1, position * 5); // 5 minutes per position
}

function getStatusColor(status) {
    const colors = {
        'waiting': 'warning',
        'in-progress': 'info',
        'completed': 'success',
        'cancelled': 'secondary'
    };
    return colors[status] || 'secondary';
}

function getStatusIcon(status) {
    const icons = {
        'waiting': '⏳',
        'in-progress': '🔄',
        'completed': '✅',
        'cancelled': '❌'
    };
    return icons[status] || '📝';
}

function formatDate(date) {
    if (!date) return 'N/A';
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

function showSuccess(message) {
    alert('✅ ' + message); // You can replace with a better toast notification
}

function showError(message) {
    alert('❌ ' + message); // You can replace with a better toast notification
}

// Make functions available globally
window.leaveQueue = leaveQueue;
window.logout = logout;