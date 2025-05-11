import { updateCameraPosition, getCurrentPosRot } from './load.js';
import { uploadWorld } from './upload.js';
import { fetchUserState, getAuthorNameByUID } from './script.js';
let isUploaded = false;
let visiActive = true; // Global visibility state

/* 
UI_POSITIONS
    Positions for different UI elements;
    Starting status for each UI element;
    Dynamically appllied.
*/
const UI_POSITIONS = {
    /*
    1. hidden: Off-screen position
        If have 'mobile'&'desktop', it is actually not 'hidden' in pointer-lock mode by isMobileDevice();
        If doesn't have 'mobile'&'desktop', it means it's only in mobile, or only in desktop;

    2. visible: On-screen position


    3. when have 'top', it is calculated from the top, vice versa.
        top: Top position
        bottom: Bottom position
        left: Left position
        right: Right position
    */
    config: { hidden: '-500px', visible: '20px', top: '60px' },
    // config is both in desktop and mobile;

    comment: { hidden: '-500px', visible: '20px', top: '65px' },
    // comment is both in desktop and mobile;

    shortcuts: { hidden: '-500px', visible: '20px', bottom: '20px' },
    // shortcuts is ONLY IN DESKTOP;

    exit: {
        hidden: {
            mobile: '50%', // Center position for mobile
            desktop: '-250px' // Off-screen for desktop
        },
        visible: '20px',
        bottom: '20px'
    },
    // exit is both in desktop and mobile;

    joystick: {
        hidden: {
            mobile: '20%',
            desktop: '-150px'
        },
        visible: {
            mobile: '50px',
            desktop: '-150px'
        },
        bottom: '10%'
    },
    // joystick is ONLY IN MOBILE;

    action: {
        hidden: {
            mobile: '20%',
            desktop: '-150px'
        },
        visible: {
            mobile: '50px',
            desktop: '-150px'
        },
        bottom: '10%',
    },
    // action is ONLY IN MOBILE;

    guide: {
        hidden: '-500px',
        visible: '50%',
        top: '50%'
    },
    // guide is both in desktop and mobile;

    scene: {
        hidden: '-500px',
        visible: '50%',
        bottom: '10%'
    }
    // scene is both in desktop and mobile;
};
const uiStyle = document.createElement('style');
uiStyle.textContent = `
    .config-ui {
        left: ${UI_POSITIONS.config.hidden};
        top: ${UI_POSITIONS.config.top};
    }

    .comment-ui {
        right: ${UI_POSITIONS.comment.hidden};
        top: ${UI_POSITIONS.config.top};
    }

    .shortcuts-ui {
        left: ${UI_POSITIONS.comment.hidden};
        bottom: ${UI_POSITIONS.shortcuts.bottom};
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




`;
document.head.appendChild(uiStyle);

/*
   ###
  ####
 ## ##
    ##
    ##
    ##
 #########
LOADING GEAR
*/
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
export function updateLoadingGear(progression) {
    const progressText = document.getElementById('loadingProgress');
    if (progressText) {
        // Ensure progression is between 0 and 100 and round to integer
        const displayProgress = Math.round(Math.min(Math.max(progression, 0), 100));
        progressText.innerText = `${displayProgress}%`;
    }
}


/*
ALL UI ELEMENTS:
    ConfigUI - title
    CommentUI
    ShortcutsUI
    ExitUI - show
    JoystickUI
    ActionUI - jump
    GuideUI (TBD)
    ScenesUI (TBD)
*/



/* 
   #####
  ##   ##
       ##
      ##
    ##
   ##
  #########
ConfigUI 
    Title, Author, Keywords;
    Hidden in mobile;
    Editable in edit mode;
*/
export function createConfigUI(model_Object, editMode = false, author_UID = "", blobUrl = "") {

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
            <h2  style="margin: 0">${model_Object.model_name || "Untitled"}</h2>
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
            // console.log("formData", formData);

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



/* 
   #####
  ##   ##
       ##
    ####
       ##
  ##   ##
   #####
UI Updates for home.html
*/
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

/* 
     ##
    ###
   # ##
  #  ##
 #######
     ##
     ##
CommentUI
    Comments, Likes[TBD], and Share[TBD];
    Hidden in mobile;
*/
export function createCommentUI(model_Object) {
    const commentUI = document.createElement("div");
    commentUI.className = "floating-ui comment-ui ui-visible";

    commentUI.addEventListener('mousedown', (e) => e.stopPropagation());
    commentUI.addEventListener('click', (e) => e.stopPropagation());
    let attachScene = false;
    // Initial HTML structure
    commentUI.innerHTML = `
    <h4 style="margin: 0 0 10px 0;">Comments</h4>
    <div class="comments" style="gap:12px">
        <!-- Comments will be dynamically added here -->
    </div>
    <div class="comment-input" style="display: flex; align-items: center; gap: 8px;">
        <input type="text" id="comment-box" placeholder="Add a comment..." class="comment-box" style="flex-grow: 1;" />
        
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <label class="scene-attach-toggle" style="display: flex; align-items: center;">
                <input type="checkbox" id="attach-scene-toggle" ${attachScene ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
            <span style="font-size: 0.8em; color: #666;">Attach Scene</span>
        </div>
        
        <button class="minor-btn" id="send-comment">Send</button>
    </div>
`;

    // Add function to load and show comments
    async function loadComments() {
        try {
            const response = await fetch(`/api/comments?serial=${model_Object.serial}`);
            console.log("Response: ", response);
            if (!response.ok) throw new Error('Failed to fetch comments');

            const comments = await response.json();
            const commentsContainer = commentUI.querySelector('.comments');
            const inputBox = commentsContainer.querySelector('.comment-input');

            // Clear existing comments
            commentsContainer.innerHTML = '';

            // Add comments in reverse chronological order
            comments.forEach(comment => {
                const commentElement = document.createElement('div');

                commentElement.className = 'comment-item';
                commentElement.innerHTML = `
                    <span class="comment-name">${comment.username}:</span>
                    <span class="comment-content">${comment.content}</span>
                    <div class="comment-meta">
                        <span class="comment-date">${new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                `;
                commentsContainer.appendChild(commentElement);
            });

            // Re-add the input box at the bottom
            commentsContainer.appendChild(inputBox);
        } catch (error) {
            console.error('Error loading comments:', error);
            showMessage('Failed to load comments');
        }
    }

    function makeCommentWrapper() {
        const commentBox = commentUI.querySelector('#comment-box');
        const sendButton = commentUI.querySelector('#send-comment');
        // Add event listeners to prevent control triggers
        commentBox.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Prevent keydown from reaching the document
        });

        commentBox.addEventListener('keyup', (e) => {
            e.stopPropagation(); // Prevent keyup from reaching the document
        });

        // Exit pointer lock when focusing on comment box
        commentBox.addEventListener('focus', () => {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        });

        sendButton.addEventListener('click', async () => {
            const commentText = commentBox.value.trim();
            if (!commentText) return;

            // Get the checkbox state
            const attachSceneCheckbox = commentUI.querySelector('#attach-scene-toggle');
            const attachScene = attachSceneCheckbox.checked;

            try {
                // Check authentication first
                const { isAuthenticated, userInfo } = await fetchUserState();

                if (!isAuthenticated) {
                    showMessage('Please sign in to comment');
                    return;
                }

                const positionArray = getCurrentPosRot();

                const response = await fetch('/api/comments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        serial: model_Object.serial,
                        content: commentText,
                        positionArray: JSON.stringify(positionArray),
                        attachScene: attachScene, // Add this line
                        parentId: null,
                        userId: userInfo.sub,
                        userName: userInfo.nickname || 'Anonymous'
                    })
                });

                if (response.ok) {
                    commentBox.value = '';
                    await loadComments();
                    showMessage('Comment posted successfully');
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to post comment');
                }
            } catch (error) {
                console.error('Error posting comment:', error);
                showMessage(error.message);
            }
        });
    }

    // Initialize comment functionality
    makeCommentWrapper();
    loadComments(); // Load initial comments

    const container = document.getElementById("container");
    container.appendChild(commentUI);

    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        commentUI.classList.toggle('ui-visible', !isLocked);
    });

    return commentUI;
}


/* 

  #######
  ##
  ##
  ######
       ##
  ##   ##
   #####
ShortcutsUI (sometimes "ShortcutUI")
*/
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

/*
   #####
  ##
  ##
  ######
  ##   ##
  ##   ##
   #####
Show temp messages at the bottom-right side;
Helper functions
*/
export function showMessage(text) {
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
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

function toggleVisibilityActiveness(force = null) {
    const isMobile = isMobileDevice();

    if (force !== null) {
        visiActive = force;
    } else if (isMobile) {
        visiActive = !visiActive; // Toggle for mobile
    } else {
        visiActive = !document.pointerLockElement; // Based on pointer lock for desktop
    }

    // Update all UI elements
    document.querySelectorAll('.floating-ui').forEach(ui => {
        ui.classList.toggle('ui-visible', visiActive);
    });
}

/* 
  #########
       ##
      ##
     ##
    ##
   ##
  ##
ExitUI
    have the "show" button when isMobileDevice();
*/
export function createExitUI() {
    const exitUI = document.createElement('div');
    exitUI.className = 'floating-ui exit-ui';
    const isMobile = isMobileDevice();

    exitUI.addEventListener('mousedown', (e) => e.stopPropagation());
    exitUI.addEventListener('click', (e) => e.stopPropagation());

    // Create both buttons
    exitUI.innerHTML = `
        <div class="exit-buttons">
            <button class="exit-button show-button" id="showButton">Show</button>
            <button class="exit-button exit-button-red" id="exitButton">Exit</button>
        </div>
    `;

    const exitStyles = `
        .exit-ui {
            right: ${isMobile ? UI_POSITIONS.exit.hidden.mobile : UI_POSITIONS.exit.hidden.desktop};
            bottom: ${UI_POSITIONS.exit.bottom};
            ${isMobile ? 'transform: translateX(50%);' : ''} 
        }

        .exit-ui.ui-visible {
            right: ${UI_POSITIONS.exit.visible};
            transform: translateX(0);
        }
    `;

    if (!document.querySelector('#exit-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'exit-styles';
        styleElement.textContent = exitStyles;
        document.head.appendChild(styleElement);
    }

    const showButton = exitUI.querySelector('#showButton');
    const exitButton = exitUI.querySelector('#exitButton');

    // Handle show button - only quits pointer lock
    showButton.addEventListener('click', () => {
        if (isMobileDevice()) {
            toggleVisibilityActiveness();
        } else if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    });

    // Handle exit button - returns to home
    exitButton.addEventListener('click', () => {
        window.location.href = '/';
    });

    // Update visibility based on pointer lock state
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        exitUI.classList.toggle('ui-visible', !isLocked);
    });

    const container = document.getElementById('container');
    container.appendChild(exitUI);

    return exitUI;
}

/* 
JoystickUI
*/
export function createJoystickUI() {
    const isMobile = isMobileDevice();
    if (!isMobile) return null; // Only create joystick for mobile devices

    const joystickUI = document.createElement('div');
    joystickUI.className = 'floating-ui joystick-ui';
    joystickUI.id = 'joystick';

    const joystickStyles = `
        .joystick-ui {
            left: ${UI_POSITIONS.joystick.hidden.mobile};
            bottom: ${UI_POSITIONS.joystick.bottom};
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

/* 
ActionUI
*/
export function createActionUI() {
    const isMobile = isMobileDevice();
    if (!isMobile) return null; // Only create action UI for mobile devices

    const actionUI = document.createElement('div');
    actionUI.className = 'floating-ui action-ui';
    actionUI.id = 'action';

    const actionStyles = `
        .action-ui {
            right: ${UI_POSITIONS.action.hidden.mobile};
            bottom: ${UI_POSITIONS.action.bottom};
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

    // Hitting ESC / Tapping "Show" => pointerlockchange => ui-visible
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        actionUI.classList.toggle('ui-visible', !isLocked);
    });

    return actionUI;
}

/* 
   #####
  ##   ##
  ##   ##
   #####
  ##   ##
  ##   ##
   #####
Scenes UI
    1. Class Scene;
    2. CreateSceneKey;
    3. Scenes UI;


TBD:
    Questions:
    1. How to add a scene? (configUI => Edit Mode / Make a comment)
    2. How to delete a scene?
    3. How to teleport to a scene? (reference to load.js)
    4. Databases for the scenes? How to imitiate the scenesInThisWorld?
    5. Adding the scene in the commentUI?
*/
export class Scene {
    constructor(data = [0, 1, 0, 0, 0, 0], name = "Original Scene") {
        this.position = data.slice(0, 3); // First 3 elements are position
        this.rotation = data.slice(3, 6); // Next 3 elements are rotation
        this.name = name;
    }

    export() {
        return [...this.position, ...this.rotation];
    }

    async save() {
        const response = await addSceneToServer(this);
        this.serial = response.serial; // Store the DB-assigned ID
        return response;
    }

    async delete() {
        if (!this.serial) throw new Error("Scene has no serial ID");
        await deleteSceneOnServer(this.serial);
    }
}


function createCameraUpdateButton(name, position, rotation) {
    const button = document.createElement('button');
    button.className = 'camera-update-btn';
    button.textContent = name || 'Default Scene';

    button.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('teleportToScene', {
            detail: { position, rotation }
        }));
    });

    return button;
}

// Modified scene key element
function createSceneKeyElement(scene) {
    const element = document.createElement('div');
    element.className = 'scene-key';
    console.log("Scene Key Element: ", scene.position, scene.rotation);
    // Add camera update button to each scene key
    const updateBtn = createCameraUpdateButton(scene.name, scene.position, scene.rotation);
    element.appendChild(updateBtn);

    return element;
}

//need to make sure if there should be an input for the model;
export function teleport(position, rotation) {
    console.log(`Teleporting to position: [${position}] and rotation: [${rotation}]`);

}

export function createScenesUI(scenesInThisWorld = []) {
    const scenesUI = document.createElement('div');
    scenesUI.className = 'floating-ui scenes-ui ui-visible';

    // Prevent event propagation
    scenesUI.addEventListener('mousedown', (e) => e.stopPropagation());
    scenesUI.addEventListener('click', (e) => e.stopPropagation());

    // Create base structure
    scenesUI.innerHTML = `
        <h4>Scenes</h4>
        <div class="scenes-container"></div>
    `;

    // Add styles
    const scenesStyles = `
        .scenes-ui {
            left: ${UI_POSITIONS.scene.hidden};
            bottom: ${UI_POSITIONS.scene.bottom};
            transform: translateX(-50%);
        }

        .scenes-ui.ui-visible {
            left: ${UI_POSITIONS.scene.visible};
        }


    `;

    if (!document.querySelector('#scenes-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'scenes-styles';
        styleElement.textContent = scenesStyles;
        document.head.appendChild(styleElement);
    }

    const scenesContainer = scenesUI.querySelector('.scenes-container');

    // If no scenes, create default scene
    if (!scenesInThisWorld || scenesInThisWorld.length === 0) {
        const defaultScene = new Scene();
        scenesContainer.appendChild(createSceneKeyElement(defaultScene));
    } else {
        // Create scene keys for each scene
        scenesInThisWorld.forEach(scene => {
            scenesContainer.appendChild(createSceneKeyElement(scene));
        });
    }

    // Add to container
    const container = document.getElementById('container');
    container.appendChild(scenesUI);

    // Handle visibility toggling
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement !== null;
        scenesUI.classList.toggle('ui-visible', !isLocked);
    });

    return scenesUI;
}



/*
   #####
  ##   ##
  ##   ##
   ######
       ##
      ##
   #####
Guide UI
    Simplest one: just one image; Scalable.
*/
export function createGuideUI() {
    const guideUI = document.createElement('div');
    guideUI.className = 'floating-ui guide-ui ui-visible';
    const isMobile = isMobileDevice();

    // Prevent event propagation
    guideUI.addEventListener('mousedown', (e) => e.stopPropagation());
    guideUI.addEventListener('click', (e) => e.stopPropagation());

    // Create image element
    const guideImage = document.createElement('img');
    guideImage.src = isMobile ? '/static/guide_mobile.jpeg' : '/static/guide_desktop.jpeg';
    guideImage.style.height = isMobile ? '300px' : '200px';
    guideImage.style.width = 'auto';
    guideImage.style.objectFit = 'contain';

    guideUI.appendChild(guideImage);

    // Add styles
    const guideStyles = `
        .guide-ui {
            left: ${UI_POSITIONS.guide.hidden};
            top: ${UI_POSITIONS.guide.top};
        }

        .guide-ui.ui-visible {
            left: ${UI_POSITIONS.guide.visible};
        }

        .guide-ui img {
            height: ${isMobile ? '300px' : '200px'};
        }
    `;

    if (!document.querySelector('#guide-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'guide-styles';
        styleElement.textContent = guideStyles;
        document.head.appendChild(styleElement);
    }

    // Add to container
    const container = document.getElementById('container');
    container.appendChild(guideUI);

    // Handle visibility toggling
    document.addEventListener('pointerlockchange', () => {
        if (!isMobile) {
            const isLocked = document.pointerLockElement !== null;
            guideUI.classList.toggle('ui-visible', !isLocked);
        }
    });

    // Update visibility based on visiActive state
    document.addEventListener('visibilityChange', () => {
        guideUI.classList.toggle('ui-visible', visiActive);
    });

    return guideUI;
}