// Email.js Configuration
(function() {
    console.log('📧 Initializing Email.js configuration...');
    
    // Email template IDs
    const EMAIL_TEMPLATES = {
        QUEUE_JOINED: 'template_dtt62bk',      // Welcome email
        QUEUE_SERVING: 'template_q8fhnlu',     // Thank you email
    };
    
    // Service ID
    const EMAIL_SERVICE = 'service_8dgv2nb';
    
    // Public Key
    const PUBLIC_KEY = 'UPOW2HueOQf24sxui';
    
    // Email configuration
    const emailConfig = {
        serviceId: EMAIL_SERVICE,
        templates: EMAIL_TEMPLATES,
        publicKey: PUBLIC_KEY
    };
    
    // Initialize EmailJS
    try {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(PUBLIC_KEY);
            console.log('✅ Email.js initialized successfully');
        } else {
            console.error('❌ EmailJS SDK not loaded');
        }
    } catch (error) {
        console.error('❌ Email.js initialization error:', error);
    }
    
    // Make it globally available
    window.emailConfig = emailConfig;
    
    console.log('✅ Email.js configured successfully');
    console.log('📧 Available templates:', Object.keys(EMAIL_TEMPLATES));
})();