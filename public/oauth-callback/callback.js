(function() {
    const messageEl = document.getElementById('message');
    const detailsEl = document.getElementById('details');
    const spinnerEl = document.querySelector('.spinner');
    
    function updateUI(success, error) {
        spinnerEl.style.display = 'none';
        
        if (success) {
            messageEl.textContent = 'Authorization successful!';
            messageEl.className = 'message success';
            detailsEl.textContent = 'Returning to Telebiz...';
        } else if (error) {
            messageEl.textContent = 'Authorization failed';
            messageEl.className = 'message error';
            detailsEl.textContent = `Error: ${error}`;
        } else {
            messageEl.textContent = 'Authorization completed';
            messageEl.className = 'message';
            detailsEl.textContent = 'Returning to Telebiz...';
        }
    }
    
    try {
        console.log('OAuth callback processing started');
        console.log('Current URL:', window.location.href);
        console.log('Window opener exists:', !!window.opener);
        console.log('Window opener closed:', window.opener?.closed);
        
        // Extract result from URL params and hash
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        
        console.log('URL params:', Object.fromEntries(urlParams.entries()));
        console.log('Hash params:', Object.fromEntries(hashParams.entries()));
        
        // Check for success/error indicators
        const hasCode = urlParams.has('code') || hashParams.has('code');
        const hasAccessToken = hashParams.has('access_token');
        const explicitSuccess = urlParams.get('success') === 'true';
        const success = explicitSuccess || hasCode || hasAccessToken;
        
        const error = urlParams.get('error') || 
                     urlParams.get('error_description') || 
                     hashParams.get('error') ||
                     hashParams.get('error_description');
        
        console.log('Parsed results:', { success, error, hasCode, hasAccessToken });
        
        // Update UI immediately
        updateUI(success, error);
        
        // Send result to parent window via postMessage
        if (window.opener && !window.opener.closed) {
            try {
                const messageData = {
                    type: 'OAUTH_CALLBACK',
                    success: success,
                    error: error,
                    url: window.location.href,
                    params: {
                        code: urlParams.get('code') || hashParams.get('code'),
                        state: urlParams.get('state') || hashParams.get('state'),
                        access_token: hashParams.get('access_token'),
                        token_type: hashParams.get('token_type'),
                        expires_in: hashParams.get('expires_in')
                    }
                };
                
                console.log('Sending postMessage:', messageData);
                console.log('Target origin:', window.location.origin);
                
                window.opener.postMessage(messageData, window.location.origin);
                console.log('PostMessage sent successfully');
            } catch (postMessageError) {
                console.warn('Failed to send postMessage:', postMessageError);
            }
        } else {
            console.warn('No valid window opener found');
        }
        
        // Close popup after a brief delay
        setTimeout(() => {
            try {
                console.log('Attempting to close window');
                window.close();
            } catch (closeError) {
                console.warn('Failed to close window:', closeError);
                // Fallback: try to redirect back to main app
                window.location.href = '/';
            }
        }, success ? 1500 : 3000);
        
    } catch (err) {
        console.error('OAuth callback error:', err);
        updateUI(false, 'Processing error occurred');
        
        // Still try to close the popup
        setTimeout(() => {
            try {
                window.close();
            } catch (closeError) {
                window.location.href = '/';
            }
        }, 3000);
    }
})();
