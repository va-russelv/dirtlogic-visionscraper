// Configuration
const CONFIG = {
    GHL_WEBHOOK_GET: '', // HighLevel GET webhook URL
    N8N_WEBHOOK: '', // n8n webhook URL
    GHL_MEDIA_REPO: '' // HighLevel media repository endpoint
};

// State management
let uploadedFile = null;
let uploadedImageUrl = null;

// DOM Elements
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const generateBtn = document.getElementById('generateBtn');
const designPrompt = document.getElementById('designPrompt');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const previewImage = document.getElementById('previewImage');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize
function init() {
    setupEventListeners();
    checkForGHLForm();
}

// Setup Event Listeners
function setupEventListeners() {
    // Upload box click
    uploadBox.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadBox.addEventListener('dragover', handleDragOver);
    uploadBox.addEventListener('dragleave', handleDragLeave);
    uploadBox.addEventListener('drop', handleDrop);

    // Generate button
    generateBtn.addEventListener('click', handleGenerate);
}

// Check for HighLevel form and setup listener
function checkForGHLForm() {
    // Monitor for GHL form submission
    // This will need to be adjusted based on your actual GHL form implementation
    const formContainer = document.getElementById('ghl-form-container');
    
    // If using GHL embedded form, listen for successful submission
    window.addEventListener('message', (event) => {
        // Check if message is from GHL form
        if (event.data && event.data.type === 'ghl-form-submitted') {
            handleGHLFormSubmission(event.data);
        }
    });
}

// Handle GHL Form Submission
async function handleGHLFormSubmission(data) {
    try {
        console.log('GHL Form submitted:', data);
        
        // Get the uploaded image from GHL
        const imageUrl = await fetchImageFromGHL(data.contactId, data.fileId);
        
        if (imageUrl) {
            uploadedImageUrl = imageUrl;
            displayPreviewImage(imageUrl);
        }
    } catch (error) {
        console.error('Error handling GHL form submission:', error);
        alert('Error processing upload. Please try again.');
    }
}

// Fetch image from GHL
async function fetchImageFromGHL(contactId, fileId) {
    try {
        const response = await fetch(`${CONFIG.GHL_WEBHOOK_GET}?contactId=${contactId}&fileId=${fileId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch image from GHL');
        }

        const data = await response.json();
        return data.imageUrl || data.url;
    } catch (error) {
        console.error('Error fetching image from GHL:', error);
        throw error;
    }
}

// Handle file selection (fallback/preview)
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        uploadedFile = file;
        displayPreviewFromFile(file);
    }
}

// Display preview from file
function displayPreviewFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        displayPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

// Display preview image
function displayPreviewImage(imageUrl) {
    previewPlaceholder.style.display = 'none';
    previewImage.src = imageUrl;
    previewImage.style.display = 'block';
    generateBtn.disabled = false;
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    uploadBox.classList.add('dragover');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    uploadBox.classList.remove('dragover');
}

// Handle drop
function handleDrop(event) {
    event.preventDefault();
    uploadBox.classList.remove('dragover');
    
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        uploadedFile = file;
        fileInput.files = event.dataTransfer.files;
        displayPreviewFromFile(file);
    }
}

// Handle Generate
async function handleGenerate() {
    if (!uploadedImageUrl && !uploadedFile) {
        alert('Please upload an image first');
        return;
    }

    const prompt = designPrompt.value.trim();
    if (!prompt) {
        alert('Please enter a design prompt');
        return;
    }

    // Show loading
    showLoading(true);
    generateBtn.disabled = true;

    try {
        // Prepare image data
        let imageData;
        
        if (uploadedImageUrl) {
            // Use URL from GHL
            imageData = uploadedImageUrl;
        } else if (uploadedFile) {
            // Convert file to base64 for direct upload
            imageData = await fileToBase64(uploadedFile);
        }

        // Send to n8n webhook
        const result = await sendToN8N(imageData, prompt);

        // Display result
        if (result && result.generatedImageUrl) {
            displayPreviewImage(result.generatedImageUrl);
            
            // Save to GHL media repo
            await saveToGHLMediaRepo(result.generatedImageUrl, prompt);
        } else {
            throw new Error('No generated image received');
        }

        alert('Concept generated successfully!');
    } catch (error) {
        console.error('Error generating concept:', error);
        alert('Error generating concept. Please try again.');
    } finally {
        showLoading(false);
        generateBtn.disabled = false;
    }
}

// Send to n8n webhook
async function sendToN8N(imageData, prompt) {
    try {
        const response = await fetch(CONFIG.N8N_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageData,
                prompt: prompt,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error('n8n webhook request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Error sending to n8n:', error);
        throw error;
    }
}

// Save to GHL Media Repo
async function saveToGHLMediaRepo(imageUrl, prompt) {
    try {
        const response = await fetch(CONFIG.GHL_MEDIA_REPO, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageUrl: imageUrl,
                prompt: prompt,
                timestamp: new Date().toISOString(),
                type: 'generated_concept'
            })
        });

        if (!response.ok) {
            console.warn('Failed to save to GHL media repo');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving to GHL media repo:', error);
        // Don't throw - this is not critical
    }
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Show/hide loading
function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);