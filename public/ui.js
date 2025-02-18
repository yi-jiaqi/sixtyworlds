import { toggleMoveMode, toggleLighting,getCurrentPosRot } from './load.js';
import { uploadWorld } from './upload.js';

// Add at the top of the file, outside any function
let isUploaded = false;  // Module-level state

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
	console.log("Trying to hide loading gear")
	const gear = document.getElementById('loadingGear');
	const progressText = document.getElementById('loadingProgress');
	if (gear) document.body.removeChild(gear);
	if (progressText) document.body.removeChild(progressText);
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



export function createConfigUI(model_Object, editMode = false,author_UID="",blobUrl="") {
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

	if (editMode) {

		configUI.innerHTML = `
			<h3>Edit Model Details</h3>

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

			<div class="button-group">
				<!-- Buttons for Edit Mode -->
				<button class="main-button" id="save-changes">Save Changes</button>
				<button class="main-button" id="upload">Upload</button>
				<button class="config-button" id="fly-walk">Fly/Walk</button>
				<button class="config-button" id="day-night">Day/Night</button>
				<button class="cancel-button" id="cancel">Cancel</button>
			</div>
		`;


	} else {
		configUI.innerHTML = `
            <h3>${model_Object.model_name || "Untitled"}</h3>
            <p><strong>Author:</strong> ${model_Object.author_name || "Anonymous"}</p>
            <p><strong>Upload Date:</strong> ${model_Object.upload_date || "yyyy.mm.dd"}</p>
            <p><strong>Keywords:</strong> ${keywordsString}</p>
            <p><strong>Likes:</strong> ${model_Object.likes || 0}</p>

            <div class="button-group">
                <button class="config-button" id="fly-walk">Fly/Walk</button>
                <button class="config-button" id="day-night">Day/Night</button>
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
	if(editMode){
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
	commentUI.innerHTML = `
	  <h4>Comments</h4>
	  <div class="comments">
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