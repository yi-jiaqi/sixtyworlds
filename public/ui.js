import { toggleMoveMode, toggleLighting, getCurrentPosRot } from './load.js';
import { uploadWorld } from './upload.js';

// Add at the top of the file, outside any function
let isUploaded = false;  // Module-level state

// Add at the top of file
const UI_POSITIONS = {
    config: { hidden: '-500px', visible: '20px', top: '60px' },
    comment: { hidden: '-500px', visible: '20px', top: '65px' },
    shortcuts: { hidden: '-500px', visible: '20px', bottom: '20px' },  // Add bottom position
    exit: {
        hidden: {
            mobile: '50%', // Center position for mobile
            desktop: '-150px' // Off-screen for desktop
        },
        visible: '20px',
        bottom: '20px'
    },
    joystick: {
        hidden: {
            mobile: '50px',
            desktop: '-150px'
        },
        visible: '50px',
        bottom: '50px'
    },
    action: {
        hidden: {
            mobile: '20px',
            desktop: '-150px'
        },
        visible: '20px',
        bottom: '50px',
        right: '50px'  // Position on right side, opposite to joystick
    }
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
        max-width: 400px;
        user-select: none;          /* Prevent text selection */
        -webkit-user-select: none;  /* Safari specific */
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-tap-highlight-color: transparent; /* Remove tap highlight on mobile */
        touch-action: none;         /* Prevent default touch actions */
        pointer-events: auto;       /* Ensure UI elements still receive events */
    }

    /* Allow pointer events on specific interactive elements */
    .floating-ui button,
    .floating-ui input,
    .floating-ui .clickable {
        pointer-events: auto;
        touch-action: manipulation; /* Optimize touch behavior */
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
        // Ensure progression is between 0 and 100 and round to integer
        const displayProgress = Math.round(Math.min(Math.max(progression, 0), 100));
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
    configUI.className = "floating-ui config-ui ui-visible";

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
        `;
    }

    const container = document.getElementById("container");
    container.appendChild(configUI);

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
    commentUI.className = "floating-ui comment-ui ui-visible";


    commentUI.addEventListener('mousedown', (e) => e.stopPropagation());
    commentUI.addEventListener('click', (e) => e.stopPropagation());

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
        <div class="comment-item">
		  <span class="username">Jiaqi(Author):</span> <span class="comment-content">The next prototype will be on March 19!</span>
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
    shortcutsUI.className = 'floating-ui shortcuts-ui ui-visible';


    shortcutsUI.addEventListener('mousedown', (e) => e.stopPropagation());
    shortcutsUI.addEventListener('click', (e) => e.stopPropagation());

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
                        <path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>
                    </svg>
                    <span>Save the Scene</span>
                </div>
                <span class="shortcut-key">P</span>
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

    // const flyWalkButton = document.getElementById("fly-walk");
    // const dayNightButton = document.getElementById("day-night");

    // flyWalkButton.addEventListener("click", () => {
    //     const mode = toggleMoveMode();
    //     flyWalkButton.textContent = mode.charAt(0).toUpperCase() + mode.slice(1); // Capitalize first letter
    // });

    // dayNightButton.addEventListener("click", () => {
    //     const mode = toggleLighting();
    //     switch (mode) {
    //         case 'HIGH':
    //             dayNightButton.textContent = 'Bright';
    //             break;
    //         case 'STANDARD':
    //             dayNightButton.textContent = 'Normal';
    //             break;
    //         case 'DARK':
    //             dayNightButton.textContent = 'Dark';
    //             break;
    //     }
    // });

    // Get container and append shortcutsUI
    const container = document.getElementById('container');
    container.appendChild(shortcutsUI);

    // Toggle visibility based on pointer lock
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        shortcutsUI.classList.toggle('ui-visible', !isLocked);
    });
    // Set initial button text
    // flyWalkButton.textContent = 'Walk'; // Initial state is WALK
    // dayNightButton.textContent = 'Normal'; // Initial state is STANDARD

    return shortcutsUI;
}

export 	function showMessage(text) {
    const container = document.querySelector('.notification-container');
    const hint = document.createElement('div');
    hint.className = 'pointer-hint';
    hint.textContent = text;
    container.appendChild(hint);

    // Show message
    setTimeout(() => hint.classList.add('visible'), 10);

    // Remove message after 3 seconds
    setTimeout(() => {
        hint.classList.remove('visible');
        setTimeout(() => hint.remove(), 300); // Wait for fade out animation
    }, 3060);
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

// Add mobile detection function
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

// Add exit UI creation function
export function createExitUI() {
    const exitUI = document.createElement('div');
    exitUI.className = 'floating-ui exit-ui';
    const isMobile = isMobileDevice();

    exitUI.addEventListener('mousedown', (e) => e.stopPropagation());
    exitUI.addEventListener('click', (e) => e.stopPropagation());

    // Create button with initial state
    exitUI.innerHTML = `
        <button class="exit-button" id="exitButton">Show</button>
    `;

    const exitStyles = `
        .exit-ui {
            position: fixed;
            right: ${isMobile ? UI_POSITIONS.exit.hidden.mobile : UI_POSITIONS.exit.hidden.desktop};
            bottom: ${UI_POSITIONS.exit.bottom};
            transition: all 0.3s ease-out;
            z-index: 1000;
            ${isMobile ? 'transform: translateX(50%);' : ''} 
        }

        .exit-ui.ui-visible {
            right: ${UI_POSITIONS.exit.visible};
            transform: translateX(0);
        }

        .exit-button {
            background-color: rgba(255, 75, 75, 0.9);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.2s ease;
        }

        .exit-button:hover {
            background-color: rgba(255, 45, 45, 0.9);
        }
    `;

    if (!document.querySelector('#exit-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'exit-styles';
        styleElement.textContent = exitStyles;
        document.head.appendChild(styleElement);
    }

    const exitButton = exitUI.querySelector('#exitButton');
    
    // Handle button click based on current state
    exitButton.addEventListener('click', () => {
        const isLocked = document.pointerLockElement !== null;
        if (isLocked) {
            // If in pointer lock (hidden state), exit pointer lock
            document.exitPointerLock();
        } else {
            // If not in pointer lock (visible state), exit to home
            window.location.href = '/';
        }
    });

    // Update button text based on pointer lock state
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        exitButton.textContent = isLocked ? 'Show' : 'Exit';
        exitUI.classList.toggle('ui-visible', !isLocked);
    });

    const container = document.getElementById('container');
    container.appendChild(exitUI);

    return exitUI;
}

export function createJoystickUI() {
    const isMobile = isMobileDevice();
    if (!isMobile) return null; // Only create joystick for mobile devices

    const joystickUI = document.createElement('div');
    joystickUI.className = 'floating-ui joystick-ui';
    joystickUI.id = 'joystick';

    const joystickStyles = `
        .joystick-ui {
            position: fixed;
            left: ${UI_POSITIONS.joystick.hidden.mobile};
            bottom: ${UI_POSITIONS.joystick.bottom};
            width: 150px;
            height: 150px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 50%;
            z-index: 1000;
            transition: opacity 0.3s ease;
            opacity: 0.5;
            touch-action: none;
        }

        .joystick-ui.ui-visible {
            opacity: 1;
        }

        .joystick-ui:active {
            opacity: 0.8;
        }
    `;

    if (!document.querySelector('#joystick-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'joystick-styles';
        styleElement.textContent = joystickStyles;
        document.head.appendChild(styleElement);
    }

    const container = document.getElementById('container');
    container.appendChild(joystickUI);

    // Initialize nipplejs
    const joystick = nipplejs.create({
        zone: joystickUI,
        mode: 'static',
        position: { left: '50%', bottom: '50%' },
        color: 'white',
        size: 100
    });

    // Connect to camera movement
    joystick.on('move', (evt, data) => {
        // Forward/backward movement
        // Left/right movement
        const cap = 50
        const forward = Math.min(data.vector.y, cap);
        const side = Math.min(data.vector.x, cap);


        // Update camera movement through a custom event
        const moveEvent = new CustomEvent('joystickMove', {
            detail: {
                forward: forward,
                side: side,
                force: Math.min(data.force, 1.2) // Optional: for speed control
            }
        });
        document.dispatchEvent(moveEvent);
    });

    // Add normalization function
    function normalizeJoystickValue(value, force) {
        // Cap the maximum force at 1.0
        const normalizedForce = Math.min(force, 1.0);
        // Normalize and cap the value between -1 and 1
        return Math.max(Math.min(value * normalizedForce, 1.0), -1.0);
    }

    // Update the joystick event handler
    joystick.on('move', (evt, data) => {
        // Normalize the vectors with force cap
        const forward = normalizeJoystickValue(data.vector.y, data.force);
        const side = normalizeJoystickValue(data.vector.x, data.force);

        const moveEvent = new CustomEvent('joystickMove', {
            detail: {
                forward: forward,
                side: side,
                force: Math.min(data.force, 1.0) // Cap maximum force
            }
        });
        document.dispatchEvent(moveEvent);
    });

    // Add handler for joystick release
    joystick.on('end', () => {
        const moveEvent = new CustomEvent('joystickMove', {
            detail: {
                forward: 0,
                side: 0,
                force: 0
            }
        });
        document.dispatchEvent(moveEvent);
    });

    // Handle pointer lock visibility
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        joystickUI.classList.toggle('ui-visible', !isLocked);
    });

    return joystickUI;
}

// Add new function for action UI
export function createActionUI() {
    const isMobile = isMobileDevice();
    if (!isMobile) return null; // Only create action UI for mobile devices

    const actionUI = document.createElement('div');
    actionUI.className = 'floating-ui action-ui';
    actionUI.id = 'action';

    const actionStyles = `
        .action-ui {
            position: fixed;
            right: ${UI_POSITIONS.action.hidden.mobile};
            bottom: ${UI_POSITIONS.action.bottom};
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            z-index: 1000;
            transition: opacity 0.3s ease;
            opacity: 0.5;
            touch-action: none;
        }

        .action-ui.ui-visible {
            opacity: 0.6;
        }

        .jump-button {
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .jump-button:active {
            background: rgba(255, 255, 255, 0.5);
            transform: scale(0.95);
        }
    `;

    if (!document.querySelector('#action-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'action-styles';
        styleElement.textContent = actionStyles;
        document.head.appendChild(styleElement);
    }

    actionUI.innerHTML = `<button class="jump-button" id="jumpButton"></button>`;

    const container = document.getElementById('container');
    container.appendChild(actionUI);

    // Add jump event
    const jumpButton = actionUI.querySelector('#jumpButton');
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const jumpEvent = new CustomEvent('jumpAction', {
            detail: { jump: true }
        });
        document.dispatchEvent(jumpEvent);
    });

    jumpButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        const jumpEvent = new CustomEvent('jumpAction', {
            detail: { jump: false }
        });
        document.dispatchEvent(jumpEvent);
    });

    // Handle pointer lock visibility
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        actionUI.classList.toggle('ui-visible', !isLocked);
    });

    return actionUI;
}


function createScenesUI(){

}

function addSceneCapsule(){
    
}
