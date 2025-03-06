import { toggleMoveMode, toggleLighting, getCurrentPosRot } from './load.js';
import { uploadWorld } from './upload.js';

// Add at the top of the file, outside any function
let isUploaded = false;  // Module-level state

// Add at the top of file
const UI_POSITIONS = {
    config: { hidden: '-500px', visible: '20px', top: '60px' },
    comment: { hidden: '-500px', visible: '20px', top: '65px' },
    shortcuts: { hidden: '-500px', visible: '20px', bottom: '20px' }  // Add bottom position
};

// Add styles
const uiStyle = document.createElement('style');
uiStyle.textContent = `
    .floating-ui {
        position: fixed;
        transition: all 0.3s ease-out;
        background: rgba(248, 249, 250, 0.95);
        padding: 13px;
        gap: 10px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        max-width: 400px; /* Limit the width */
    }

    .config-ui {
        left: ${UI_POSITIONS.config.hidden};
        top: ${UI_POSITIONS.config.top};
    }

    .comment-ui {
        right: ${UI_POSITIONS.comment.hidden};
        top: ${UI_POSITIONS.config.top};
    }

    .ui-visible.config-ui {
        left: ${UI_POSITIONS.config.visible};
    }
    
    .ui-visible.shortcuts-ui {
        left: ${UI_POSITIONS.shortcuts.visible};
    }

    .ui-visible.comment-ui {
        right: ${UI_POSITIONS.comment.visible};
    }

    .shortcuts-ui {
        position: fixed;
        left: ${UI_POSITIONS.comment.hidden};
        bottom: ${UI_POSITIONS.shortcuts.bottom}; /* Position above comment UI */
        transition: left 0.3s ease-out;
        gap: 10px;
        border-radius: 8px;
    }


`;
document.head.appendChild(uiStyle);

// Function to show the loading gear
export function showLoadingGear() {
    const gear = document.createElement('div');
    gear.id = 'loadingGear';
    gear.style.width = '50px';
    gear.style.height = '50px';
    gear.style.border = '5px solid #ccc';
    gear.style.borderTop = '5px solid #333';
    gear.style.borderRadius = '50%';
    gear.style.animation = 'spin 1s linear infinite';
    gear.style.position = 'fixed';
    gear.style.top = '50%';
    gear.style.left = '50%';
    gear.style.transform = 'translate(-50%, -50%)';

    // Progress Text
    const progressText = document.createElement('div');
    progressText.id = 'loadingProgress';
    progressText.style.position = 'absolute';
    progressText.style.top = '60px';
    progressText.style.left = '50%';
    progressText.style.transform = 'translateX(-50%)';
    progressText.style.color = '#333';
    progressText.style.fontSize = '14px';
    progressText.style.fontWeight = 'bold';
    progressText.innerText = '0%';

    // Append gear and progress text
    document.body.appendChild(gear);
    document.body.appendChild(progressText);
}

// Function to hide the rotating gear
export function hideLoadingGear() {
    console.log("Trying to hide loading gear");
    const gear = document.getElementById('loadingGear');
    const progressText = document.getElementById('loadingProgress');
    const hint = document.getElementById('pointer-hint');

    if (gear) document.body.removeChild(gear);
    if (progressText) document.body.removeChild(progressText);

    // Show the pointer hint after loading gear is hidden
    if (hint) hint.classList.add('visible');
}

// Function to update the loading progression
export function updateLoadingGear(progression) {
    const progressText = document.getElementById('loadingProgress');
    if (progressText) {
        // Ensure progression is between 0 and 100
        const displayProgress = Math.min(Math.max(progression, 0), 100);
        progressText.innerText = `${displayProgress}%`;
    }
}
// CSS animation for the rotating gear
const style = document.createElement('style');
style.textContent = `
	@keyframes spin {
	  0% { transform: rotate(0deg); }
	  100% { transform: rotate(360deg); }
	}
  `;
document.head.appendChild(style);



export function createConfigUI(model_Object, editMode = false, author_UID = "", blobUrl = "") {
    /*
    This is a temporaty Winter Show adaptation
    */

    // Parse keywords string into an array
    let keywordsArray = [];
    if (!editMode) {
        try {
            keywordsArray = JSON.parse(model_Object.keywords.replace(/'/g, '"'));
        } catch (error) {
            console.error("Failed to parse keywords:", error);
            keywordsArray = ["Invalid format"];
        }
    }
    const keywordsString = keywordsArray.join(", ");

    const configUI = document.createElement("div");
    configUI.className = "floating-ui config-ui";

    // Add these styles to prioritize the UI
    configUI.style.zIndex = "1000"; // High z-index to stay on top
    configUI.style.pointerEvents = "auto"; // Ensures UI catches events first

    // Add event listeners to prevent canvas from capturing UI events
    configUI.addEventListener('mousedown', (e) => e.stopPropagation());
    configUI.addEventListener('click', (e) => e.stopPropagation());

    // Add pointer lock event listeners
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        configUI.classList.toggle('ui-visible', !isLocked);
    });

    if (editMode) {
        configUI.innerHTML = `
            <h3  style="margin: 0">Edit Model Details</h3>
            <div class="config-details">
                <div class="form-group">
                    <label for="model-name"><strong>Model Name:</strong></label>
                    <input type="text" id="model-name" placeholder="${model_Object.model_name.replace(/\.[^/.]+$/, '')}" class="input-field" />
                </div>
                <div class="form-group">
                    <label for="author-name"><strong>Author:</strong></label>
                    <input type="text" id="author-name" placeholder="${model_Object.author_name}" class="input-field" />
                </div>
                <div class="form-group">
                    <label for="keywords"><strong>Keywords:</strong></label>
                    <input type="text" id="keywords" placeholder="Original,Creative" class="input-field" />
                </div>
            </div>
            <div class="button-group">
                <button class="main-button" id="upload">Upload</button>
                <button class="config-button" id="fly-walk">Walk</button>
                <button class="config-button" id="day-night">Normal</button>
                <button class="cancel-button" id="cancel">Cancel</button>
            </div>
        `;
    } else {
        configUI.innerHTML = `
            <h3  style="margin: 0">${model_Object.model_name || "Untitled"}</h3>
            <div class="config-details">
                <p><strong>Author:</strong> <span class="config-value">${model_Object.author_name || "Anonymous"}</span></p>
                <p><strong>Upload Date:</strong> <span class="config-value">${model_Object.upload_date || "yyyy.mm.dd"}</span></p>
                <p><strong>Keywords:</strong> <span class="config-value">${keywordsString}</span></p>
                <p><strong>Likes:</strong> <span class="config-value">${model_Object.likes || 0}</span></p>
            </div>
            <div class="button-group">
                <button class="config-button" id="fly-walk">Walk</button>
                <button class="config-button" id="day-night">Normal</button>
                <button class="cancel-button" id="back">Back</button>
            </div>
        `;
    }

    const container = document.getElementById("container");
    container.appendChild(configUI);

    // Add event listeners for the toggle buttons
    const flyWalkButton = document.getElementById("fly-walk");
    const dayNightButton = document.getElementById("day-night");

    flyWalkButton.addEventListener("click", () => {
        const mode = toggleMoveMode();
        flyWalkButton.textContent = mode.charAt(0).toUpperCase() + mode.slice(1); // Capitalize first letter
    });

    dayNightButton.addEventListener("click", () => {
        const mode = toggleLighting();
        switch (mode) {
            case 'HIGH':
                dayNightButton.textContent = 'Bright';
                break;
            case 'STANDARD':
                dayNightButton.textContent = 'Normal';
                break;
            case 'DARK':
                dayNightButton.textContent = 'Dark';
                break;
        }
    });
    let uploaded = false;
    if (editMode) {
        console.log("Edit Mode, adding upload")
        const uploadButton = document.getElementById("upload");


        uploadButton.addEventListener("click", () => {
            if (isUploaded) {
                console.log("Model already uploaded");
                uploadButton.textContent = 'Uploaded!';
                return;
            }

            const modelNameInput = document.getElementById("model-name");
            const authorNameInput = document.getElementById("author-name");
            const keywordsInput = document.getElementById("keywords");

            const formData = {
                modelName: modelNameInput.value || modelNameInput.placeholder || "Untitled",
                authorName: authorNameInput.value || authorNameInput.placeholder || "Anonymous",
                keywords: keywordsInput.value || keywordsInput.placeholder || "none"
            };
            console.log("formData", formData);

            isUploaded = true;  // Set before upload to prevent race conditions
            uploadButton.disabled = true;  // Visual feedback
            uploadButton.textContent = 'Uploading...';

            uploadWorld(author_UID, formData, blobUrl)
                .then(() => {
                    uploadButton.textContent = 'Uploaded!';
                })
                .catch((error) => {
                    console.error('Upload failed:', error);
                    isUploaded = false;  // Reset flag on failure
                    uploadButton.disabled = false;
                    uploadButton.textContent = 'Upload Failed';
                });

            uploadButton.textContent = 'Uploaded!';
            uploadButton.disabled = true;
        });
    }

    // Set initial button text
    flyWalkButton.textContent = 'Walk'; // Initial state is WALK
    dayNightButton.textContent = 'Normal'; // Initial state is STANDARD
}




export function updateMyWorldsButton(isAuthenticated, userInfo) {
    const myWorldsButton = document.getElementById('myWorldsButton');

    if (isAuthenticated) {
        myWorldsButton.textContent = userInfo.nickname || 'My Worlds';
        myWorldsButton.href = '/profile';
    } else {
        myWorldsButton.textContent = 'Sign In / Sign Up';
        myWorldsButton.href = '/login';
    }
}

export const dynamicMargin = () => {
    const viewportHeight = window.innerHeight;
    return viewportHeight / -5 // Adjust for smaller screens
};


export function createCommentUI() {
    // Create the comment UI element
    const commentUI = document.createElement("div");
    commentUI.className = "floating-ui comment-ui";

    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        commentUI.classList.toggle('ui-visible', !isLocked);
    });

    commentUI.innerHTML = `
        <h3  style="margin: 0">Comments</h3>
	  <div class="comments" style="gap:12px">
		<div class="comment-item">
		  <span class="username">Jiaqi(Author):</span> <span class="comment-content">Thank you for visiting my website!</span>
		</div>
		<div class="comment-item">
		  <span class="username">Jiaqi(Author):</span> <span class="comment-content">It is still under construction!</span>
		</div>
		<div class="comment-input">
		  <input type="text" placeholder="Commenting will be soon available" class="comment-box" />
		  <button class="minor-btn">Send</button>
		</div>
	  </div>
	`;

    const container = document.getElementById("container");
    container.appendChild(commentUI);
}

function commentWrapper() {
    const currentPosRot = getCurrentPosRot();
    const comment = getElementById('comment');
    let commentText = comment.value;
}

export function createShortcutsUI() {
    const shortcutsUI = document.createElement('div');
    shortcutsUI.className = 'floating-ui shortcuts-ui';

    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        shortcutsUI.classList.toggle('ui-visible', !isLocked);
    });

    shortcutsUI.innerHTML = `
        <h4>Navigation</h4>
        <div class="shortcuts-list">
            <div class="shortcut-item">
                <div class="shortcut-info">
                    <svg class="shortcut-icon" viewBox="0 0 24 24">
                        <path d="M12 16l-6-6h12l-6 6z"/>
                    </svg>
                    <span>Walk/Fly Mode</span>
                </div>
                <span class="shortcut-key">F</span>
            </div>
            <div class="shortcut-item">
                <div class="shortcut-info">
                    <svg class="shortcut-icon" viewBox="0 0 24 24">
                        <path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>
                    </svg>
                    <span>Day/Night Toggle</span>
                </div>
                <span class="shortcut-key">N</span>
            </div>
            <div class="shortcut-item">
                <div class="shortcut-info">
                    <svg class="shortcut-icon" viewBox="0 0 24 24">
                        <path d="M13 6v12l-6-6 6-6zm6 0v12l-6-6 6-6z"/>
                    </svg>
                    <span>View Control</span>
                </div>
                <span class="shortcut-key">Mouse</span>
            </div>
            <div class="shortcut-item">
                <div class="shortcut-info">
                    <span>Exit Control Mode</span>
                </div>
                <span class="shortcut-key">ESC</span>
            </div>
        </div>
    `;

    // Get container and append shortcutsUI
    const container = document.getElementById('container');
    container.appendChild(shortcutsUI);

    // Toggle visibility based on pointer lock
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        shortcutsUI.classList.toggle('ui-visible', !isLocked);
    });

    return shortcutsUI;
}


export function checkUIExistence() {
    // Update selectors to match multiple classes
    const configUI = document.querySelector('.floating-ui.config-ui');
    const commentUI = document.querySelector('.floating-ui.comment-ui');
    const shortcutsUI = document.querySelector('.floating-ui.shortcuts-ui');

    console.group('UI Elements Status:');
    console.log('Config UI:', configUI ? '✅ Present' : '❌ Missing', configUI);
    console.log('Comment UI:', commentUI ? '✅ Present' : '❌ Missing', commentUI);
    console.log('Shortcuts UI:', shortcutsUI ? '✅ Present' : '❌ Missing', shortcutsUI);

    if (configUI && commentUI && shortcutsUI) {
        console.log('All UIs positioned correctly');
        // Check for overlaps
        const configRect = configUI.getBoundingClientRect();
        const commentRect = commentUI.getBoundingClientRect();
        const shortcutsRect = shortcutsUI.getBoundingClientRect();

        // Log positions for debugging
        console.log('Config UI position:', {
            top: configRect.top,
            right: configRect.right
        });
        console.log('Comment UI position:', {
            bottom: commentRect.bottom,
            left: commentRect.left
        });
        console.log('Shortcuts UI position:', {
            bottom: shortcutsRect.bottom,
            left: shortcutsRect.left
        });
    }
    console.groupEnd();
}