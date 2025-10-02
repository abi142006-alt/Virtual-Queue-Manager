// Admin-specific authentication
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in as admin
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const isAdmin = await checkAdminRole(user);
                if (isAdmin) {
                    // Already logged in as admin, redirect to dashboard
                    window.location.href = 'admin.html';
                } else {
                    // Logged in but not admin, show message
                    showMessage('You are logged in but do not have admin privileges. Please log out and use admin credentials.', 'warning');
                    await auth.signOut();
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
            }
        }
    });

    // Admin login form handler
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
});

async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const messageDiv = document.getElementById('loginMessage');

    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying Admin Access...';
    submitBtn.disabled = true;

    try {
        // Sign in with email and password
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Verify admin role
        const isAdmin = await checkAdminRole(user);
        
        if (isAdmin) {
            // Update last login time
            await updateLastLogin(user.uid);
            
            showMessage('✅ Admin access granted! Redirecting to dashboard...', 'success');
            
            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
        } else {
            await auth.signOut();
            showMessage('❌ Access denied. This account does not have admin privileges.', 'danger');
        }

    } catch (error) {
        console.error('Admin login error:', error);
        let errorMessage = getAdminFriendlyErrorMessage(error);
        showMessage(errorMessage, 'danger');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function checkAdminRole(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            console.log('User document not found');
            return false;
        }

        const userData = userDoc.data();
        const isAdmin = userData.role === 'admin' && userData.isActive !== false;
        
        console.log('Admin check:', { email: userData.email, role: userData.role, isActive: userData.isActive, isAdmin: isAdmin });
        
        return isAdmin;
    } catch (error) {
        console.error('Error checking admin role:', error);
        return false;
    }
}

async function updateLastLogin(userId) {
    try {
        await db.collection('users').doc(userId).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating last login:', error);
    }
}

function getAdminFriendlyErrorMessage(error) {
    const errorCode = error.code;
    
    switch (errorCode) {
        case 'auth/user-not-found':
            return '❌ No admin account found with this email.';
        case 'auth/wrong-password':
            return '❌ Incorrect password. Please try again.';
        case 'auth/invalid-email':
            return '❌ Invalid email address format.';
        case 'auth/too-many-requests':
            return '❌ Too many failed attempts. Please try again later.';
        case 'auth/user-disabled':
            return '❌ This admin account has been disabled.';
        case 'auth/network-request-failed':
            return '❌ Network error. Please check your connection.';
        default:
            return `❌ Authentication failed: ${error.message}`;
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('loginMessage');
    const alertClass = type === 'success' ? 'alert-success' : 
                      type === 'warning' ? 'alert-warning' : 'alert-danger';
    
    messageDiv.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}




// Add this to admin-login.html as a convenience button
function addDemoCredentialsButton() {
    const form = document.getElementById('adminLoginForm');
    const demoButton = document.createElement('button');
    demoButton.type = 'button';
    
    
    const messageDiv = document.getElementById('loginMessage');
    messageDiv.parentNode.insertBefore(demoButton, messageDiv);
}

