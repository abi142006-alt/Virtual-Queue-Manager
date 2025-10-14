// Enhanced authentication with better error handling and email integration
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on auth page - if already logged in, redirect
    if (window.location.pathname.includes('auth.html')) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                // User is logged in, check role and redirect
                checkUserRoleAndRedirect(user);
            }
        });
    } else {
        // For other pages, check authentication
        auth.onAuthStateChanged((user) => {
            if (!user && !window.location.pathname.includes('index.html') && 
                !window.location.pathname.includes('auth.html')) {
                window.location.href = 'auth.html';
            }
        });
    }

    // Tab switching (only on auth page)
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginTab && registerTab) {
        loginTab.addEventListener('click', (e) => {
            e.preventDefault();
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            if (loginForm) loginForm.style.display = 'block';
            if (registerForm) registerForm.style.display = 'none';
        });

        registerTab.addEventListener('click', (e) => {
            e.preventDefault();
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            if (registerForm) registerForm.style.display = 'block';
            if (loginForm) loginForm.style.display = 'none';
        });
    }

    // Form handlers
    const loginFormElement = document.getElementById('loginFormElement');
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', handleLogin);
    }

    const registerFormElement = document.getElementById('registerFormElement');
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', handleRegister);
    }
});

async function checkUserRoleAndRedirect(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            // Default to customer role if role is not set
            const userRole = userData.role || 'customer';
            
            if (userRole === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'user-dashboard.html';
            }
        } else {
            // User document doesn't exist, create one
            await createUserDocument(user);
            window.location.href = 'user-dashboard.html';
        }
    } catch (error) {
        console.error('Error checking user role:', error);
        // Default redirect to dashboard page on error
        window.location.href = 'user-dashboard.html';
    }
}

async function createUserDocument(user, additionalData = {}) {
    try {
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: user.displayName || additionalData.name || 'User',
            email: user.email,
            role: additionalData.role || 'customer',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ...additionalData
        });
    } catch (error) {
        console.error('Error creating user document:', error);
        throw error;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageDiv = document.getElementById('authMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitBtn.disabled = true;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Get user role from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // Create user document if it doesn't exist
            await createUserDocument(user, { name: email.split('@')[0] });
            messageDiv.innerHTML = `<div class="alert alert-success">Welcome! Account setup complete. Redirecting...</div>`;
        } else {
            const userData = userDoc.data();
            messageDiv.innerHTML = `<div class="alert alert-success">Login successful! Redirecting...</div>`;
        }
        
        // Redirect after a short delay
        setTimeout(() => {
            checkUserRoleAndRedirect(user);
        }, 1000);

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = error.message;
        
        // User-friendly error messages
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        }
        
        messageDiv.innerHTML = `<div class="alert alert-danger">${errorMessage}</div>`;
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const messageDiv = document.getElementById('authMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    submitBtn.disabled = true;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Store user data in Firestore
        await createUserDocument(user, { name: name });

        // Send welcome email
        if (window.emailService && window.emailService.isInitialized) {
            const emailResult = await emailService.sendWelcomeEmail(email, name);
            if (emailResult.success) {
                console.log('Welcome email sent successfully');
            } else {
                console.warn('Failed to send welcome email:', emailResult.error);
            }
        }

        messageDiv.innerHTML = `<div class="alert alert-success">Registration successful! Redirecting...</div>`;
        
        setTimeout(() => {
            window.location.href = 'user-dashboard.html';
        }, 1000);

    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = error.message;
        
        // User-friendly error messages
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'An account with this email already exists.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Email/password accounts are not enabled. Please contact administrator.';
        }
        
        messageDiv.innerHTML = `<div class="alert alert-danger">${errorMessage}</div>`;
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const messageDiv = document.getElementById('authMessage');
    const googleBtn = document.querySelector('.btn-outline-danger');

    // Show loading state
    const originalText = googleBtn.innerHTML;
    googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    googleBtn.disabled = true;

    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // Check if user exists in Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // Create new user document
            await createUserDocument(user);
            
            // Send welcome email for Google signup
            if (window.emailService && window.emailService.isInitialized) {
                const emailResult = await emailService.sendWelcomeEmail(user.email, user.displayName);
                if (emailResult.success) {
                    console.log('Welcome email sent to Google user');
                }
            }
            
            messageDiv.innerHTML = `<div class="alert alert-success">Registration successful! Redirecting...</div>`;
        } else {
            messageDiv.innerHTML = `<div class="alert alert-success">Login successful! Redirecting...</div>`;
        }

        // Redirect after successful login
        setTimeout(() => {
            checkUserRoleAndRedirect(user);
        }, 1000);

    } catch (error) {
        console.error('Google login error:', error);
        let errorMessage = error.message;
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in was cancelled.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Sign-in popup was blocked. Please allow popups for this site.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized for Google sign-in.';
        }
        
        messageDiv.innerHTML = `<div class="alert alert-danger">${errorMessage}</div>`;
    } finally {
        // Reset button state
        googleBtn.innerHTML = originalText;
        googleBtn.disabled = false;
    }
}

// Utility function to check if user is admin
async function isUserAdmin(user) {
    try {
        if (!user) return false;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            return userData.role === 'admin';
        }
        return false;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Utility function to get current user data
async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        window.location.href = 'index.html';
    });
}
