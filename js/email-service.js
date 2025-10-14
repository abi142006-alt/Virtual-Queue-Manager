// js/email-service.js - Email Service for QueueManager
class EmailService {
    constructor() {
        this.isInitialized = false;
        this.serviceId = 'service_8dgv2nb';
        this.publicKey = 'UPOW2HueOQf24sxui';
        this.welcomeTemplateId = 'template_q8fhnlu';
        this.thankYouTemplateId = 'template_dtt62bk';
        this.init();
    }

    init() {
        console.log('📧 Initializing EmailService...');
        
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS SDK not loaded');
            this.isInitialized = true; // Mark as initialized for fallback
            console.log('✅ Fallback email service ready (emails will be simulated)');
            return;
        }

        try {
            console.log('📧 Initializing EmailJS...');
            emailjs.init(this.publicKey);
            this.isInitialized = true;
            console.log('✅ Email service initialized successfully with EmailJS');
            
        } catch (error) {
            console.error('❌ Email service initialization failed:', error);
            this.isInitialized = true; // Fallback to simulated emails
        }
    }

    async sendWelcomeAndQueueEmail(userEmail, userName, queueData) {
        console.log('📧 Attempting to send welcome email to:', userEmail);
        
        // Try EmailJS first if available
        if (this.isInitialized && typeof emailjs !== 'undefined') {
            try {
                const templateParams = {
                    to_email: userEmail,
                    to_name: userName,
                    from_name: 'QueueManager Team',
                    app_name: queueData.app_name || 'QueueManager',
                    is_first_queue: queueData.isFirstQueue || false,
                    service_name: queueData.service,
                    location_name: queueData.locationName,
                    ticket_id: queueData.ticketId,
                    queue_position: queueData.position,
                    estimated_wait: queueData.estimatedWait,
                    join_time: new Date().toLocaleString(),
                    current_year: queueData.current_year || new Date().getFullYear(),
                    support_email: queueData.support_email || 'support@queuemanager.com'
                };

                console.log('📧 Sending via EmailJS...');
                
                const result = await emailjs.send(
                    this.serviceId,
                    this.welcomeTemplateId,
                    templateParams
                );

                console.log('✅ Email sent successfully via EmailJS!');
                return { 
                    success: true, 
                    result: result,
                    provider: 'EmailJS'
                };

            } catch (error) {
                console.error('❌ EmailJS failed:', error);
                // Fallback to simulated email
            }
        }

        // Fallback to simulated email
        return this.sendWelcomeFallback(userEmail, userName, queueData);
    }

    async sendThankYouEmail(userEmail, userName, completionData) {
        console.log('📧 Attempting to send thank you email to:', userEmail);
        
        if (this.isInitialized && typeof emailjs !== 'undefined') {
            try {
                const templateParams = {
                    to_email: userEmail,
                    to_name: userName,
                    from_name: 'QueueManager Team',
                    app_name: completionData.app_name || 'QueueManager',
                    service_name: completionData.service,
                    location_name: completionData.locationName,
                    ticket_id: completionData.ticketId,
                    total_wait_time: completionData.totalWaitTime,
                    served_by: completionData.servedBy || 'Staff',
                    completion_time: completionData.completionTime || new Date().toLocaleString(),
                    current_year: completionData.current_year || new Date().getFullYear(),
                    support_email: completionData.support_email || 'support@queuemanager.com'
                };

                const result = await emailjs.send(
                    this.serviceId,
                    this.thankYouTemplateId,
                    templateParams
                );

                console.log('✅ Thank you email sent successfully via EmailJS!');
                return { 
                    success: true, 
                    result: result,
                    provider: 'EmailJS'
                };

            } catch (error) {
                console.error('❌ Thank you email failed:', error);
            }
        }

        return this.sendThankYouFallback(userEmail, userName, completionData);
    }

    // Fallback implementations
    async sendWelcomeFallback(userEmail, userName, queueData) {
        console.log('📧 [SIMULATED] Sending welcome email to:', userEmail);
        console.log('📋 Email data:', {
            userName: userName,
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
                    message: 'Welcome email sent (simulated)',
                    provider: 'Fallback'
                });
            }, 1000);
        });
    }

    async sendThankYouFallback(userEmail, userName, completionData) {
        console.log('📧 [SIMULATED] Sending thank you email to:', userEmail);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('✅ [SIMULATED] Thank you email sent successfully');
                resolve({ 
                    success: true, 
                    simulated: true,
                    message: 'Thank you email sent (simulated)',
                    provider: 'Fallback'
                });
            }, 1000);
        });
    }
}

// Initialize email service globally
console.log('📧 Loading EmailService...');
window.EmailService = EmailService;

// Only create instance if not already exists
if (typeof window.emailService === 'undefined') {
    window.emailService = new EmailService();
    console.log('✅ EmailService instance created');
} else {
    console.log('✅ EmailService instance already exists');
}