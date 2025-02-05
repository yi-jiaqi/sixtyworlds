let currentIndex = 0;
const itemsPerPage = 9;

/*
   #####
  ##   ##
	   ##
	  ##
	##
   ##
  #########
Endpoint - getPreviews
*/
export function loadPreviews(observer, sort = 'time', word = '') {
	// sort can be time / likes / author_name / search, when sort = author_name, word is the UID, when sort = search, word is the search_word
	console.log("load previews: " + word);

	fetch(`/api/getPreviews?index=${currentIndex}&number=${itemsPerPage}&sort=${sort}&word=${word}`)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			return response.json().catch(error => {
				console.error('Failed to parse JSON:', error);
				return response.text().then(text => {
					console.log("Response text:", text);
					throw new Error("Server response was not valid JSON");
				});
			});
		})
		.then(models => {
			const container = document.getElementById('model-container');

			models.forEach(model => {
				// console.log("a model is loaded")
				if (model.isEnd) {
					// Display the "End of the Worlds" message if isEnd is encountered
					console.log("End of the Worlds!");
					const endMessage = document.createElement('div');
					if (sort == "author") { endMessage.textContent = " Empty! Would you upload your amazing worlds?"; } else {
						endMessage.textContent = "Congrats! You are now at the end of the worlds.";

					}
					endMessage.className = 'end-message';
					container.appendChild(endMessage);

					observer.unobserve(sentinel);
					return;
				}
				const itemLink = document.createElement('a');
				itemLink.href = `/tour.html?serial=${model.serial}`; // Set the desired URL here
				itemLink.target = '_blank'; // Ensures it opens in a new window
				itemLink.style.textDecoration = 'none';



				// Create main item container
				const item = document.createElement('div');
				item.className = 'item';
				itemLink.appendChild(item);
				// Create preview div with placeholder only
				const previewDiv = document.createElement('div');
				previewDiv.className = 'preview';

				// Placeholder for loading image
				const placeholder = document.createElement('div');
				placeholder.className = 'placeholder';

				// Append placeholder to preview div
				previewDiv.appendChild(placeholder);

				// Try to load real image from AWS S3
				const img = document.createElement('img');
				img.alt = "Model Preview";
				img.style.display = 'none'; // Hide image until it loads

				const imageUrl = model.preview_url;
				img.src = imageUrl;

				img.onload = function () {
					placeholder.remove();  // Remove placeholder when image loads
					img.style.display = 'block';
				};
				img.onerror = function () {
					console.error("Error loading image from S3:", img.src);
					placeholder.style.display = 'block';  // Keep placeholder if the image fails to load
				};

				// Append image to preview div
				previewDiv.appendChild(img);

				// console.log(model)
				// Textbox with model name
				const textBox_Model = document.createElement('div');
				textBox_Model.className = 'textbox-model';
				textBox_Model.textContent = model.model_name;
				const textBox_Author = document.createElement('div');
				textBox_Author.className = 'textbox-author ';
				textBox_Author.textContent = model.author_name;

				// Label container
				const labelContainer = document.createElement('div');
				labelContainer.className = 'label-container';

				const keywords = JSON.parse(model.keywords.replace(/'/g, '"'));
				keywords.forEach(keyword => {
					const label = document.createElement('span');
					label.className = 'label';
					label.textContent = keyword;
					labelContainer.appendChild(label);
				});

				// Append elements to item container
				item.appendChild(previewDiv);
				item.appendChild(textBox_Model);
				item.appendChild(textBox_Author);
				// item.appendChild(labelContainer);

				// Append the item to the main container
				container.appendChild(itemLink);
			});

			// Update the current index for the next batch
			currentIndex += itemsPerPage;
		})
		.catch(error => console.error('Error loading models:', error));
}



/*
   #####
  ##   ##
	   ##
	####
	   ##
  ##   ##
   #####
Author, Updates...
*/



/*
	 ##
	###
   # ##
  #  ##
 #######
	 ##
	 ##

tour!
Download the model  --> from server
Load the model, load the rigidbody.   --> from load.js
Configure the starting point and direction
*/

export async function getModelData_Cloud(serial) {
	console.log("trying to get model")
	try {
		showLoadingGear();
		const response = await fetch(`/api/getModel/${serial}`);

		if (!response.ok) {
			throw new Error('Failed to fetch model data');
		}
		const modelData = await response.json();
		return modelData; // Return the parsed object
	} catch (error) {
		console.error('Error fetching model data:', error);
	} finally {
		hideLoadingGear(); // Hide the rotating gear once the operation is complete
	}
}

/*
  #######
  ##
  ##
  ######
	   ##
  ##   ##
   #####
Locate local file, send to upload, generate preview
*/


export function openUploadWindow() {
	console.log("openUploadWindow triggered!")
	const fileInput = document.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = '.glb,.gltf';

	fileInput.onchange = function (event) {
		console.log("fileInput.onchange triggered!")
		const file = event.target.files[0];
		if (!file) {
			console.log("no file");
			return;
		}

		// Check file size (<10MB)
		if (file.size > 10 * 1024 * 1024) { // 10 MB in bytes
			console.log("too big");
			alert('File size must be less than 10MB.');
			return;
		}

		// Check file extension
		const allowedExtensions = ['.glb', '.gltf'];
		const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
		if (!allowedExtensions.includes(fileExtension)) {
			console.log("wrong type");
			alert('Invalid file type. Please select a .glb or .gltf file.');
			return;
		}

		const reader = new FileReader();

		reader.onload = function () {
			const arrayBuffer = reader.result;
			const fileName = file.name;
			const fileExtension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
			const mimeType = fileExtension === '.glb' ? 'model/gltf-binary' : 'application/json';
			const blob = new Blob([arrayBuffer], { type: mimeType });

			// Open the editor page
			const editorWindow = window.open('/tour.html', '_blank');

			// Transfer the file data via postMessage
			editorWindow.onload = () => {
				editorWindow.postMessage({ fileName, blob }, window.location.origin);
			};
		};

		// Read the file as ArrayBuffer to support both .glb and .gltf
		reader.readAsArrayBuffer(file);

	};

	// Trigger the file input window
	fileInput.click();
}

function uploadFileToS3(file, serial) {
	console.log(`Uploading ${file.name} to S3 as serial number ${serial}`);
	// Placeholder code for the actual upload
}


export async function finalUpload(model_Object) {
	try {
		const response = await fetch('http://localhost:3000/upload-model', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(model_Object),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const responseData = await response.json();
		console.log('Response from server:', responseData);
		console.log('Upload URL:', responseData.uploadUrl);

	} catch (error) {
		console.error('Error sending JSON to server:', error);
	}
}

/*
   #####
  ##
  ##
  ######
  ##   ##
  ##   ##
   #####
information from csv or server
*/
export async function fetchUserState() {
	try {
		const response = await fetch('/api/user-state');
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}
		const data = await response.json();
		return {
			isAuthenticated: data.isAuthenticated,
			userInfo: data.userInfo || null,
		};
	} catch (error) {
		console.error('Error fetching user state:', error);
		return {
			isAuthenticated: false,
			userInfo: null,
		};
	}
}


export async function getAuthorInfoBySerial(serial) {
	//This is the first function, in order to validate the user is the author.
	const response = await fetch(`/api/getAuthorUID/${serial}`);
	console.log(response)
	if (response.ok) {
		const data = await response.json();
		// console.log(data.author_uid)
		return data;
	} else {
		throw new Error('Author not found');
	}
}

/*
  #########
	   ##
	  ##
	 ##
	##
   ##
  ##
Comment, like...interaction outside of tour
*/

/*
   #####
  ##   ##
  ##   ##
   #####
  ##   ##
  ##   ##
   #####
Save & Give Trace data
*/


/*
   #####
  ##   ##
  ##   ##
   ######
	   ##
	  ##
   #####
UI, updating the interface...
*/


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



export function createConfigUI(model_Object, editMode = false) {
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
	if (editMode) {

		configUI.innerHTML = `
			<h3>Edit Model Details</h3>

			<div class="form-group">
				<label for="model-name"><strong>Model Name:</strong></label>
				<input type="text" id="model-name" placeholder="${model_Object.model_name}" class="input-field" />
			</div>

			<div class="form-group">
				<label for="author-name"><strong>Author:</strong></label>
				<input type="text" id="author-name" placeholder="${model_Object.author_name}" class="input-field" />
			</div>

			<div class="form-group">
				<label for="upload-date"><strong>Upload Date:</strong></label>
				<input type="date" id="upload-date" value="${model_Object.upload_date}" class="input-field" />
			</div>

			<div class="form-group">
				<label for="keywords"><strong>Keywords:</strong></label>
				<input type="text" id="keywords" placeholder="Enter keywords" class="input-field" />
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

	// document.getElementById("starting-point").addEventListener("click", () => {
	// 	setAsStartingPoint()
	// });

	// document.getElementById("change-mode").addEventListener("click", () => {
	// 	console.log("Fly Mode clicked");
	// 	// Add logic for toggling fly mode text
	// });

	// document.getElementById("upload-world").addEventListener("click", () => {
	// 	const modelName = document.getElementById("model_name").value;
	// 	console.log(`Uploading: ${modelName}`);
	// 	alert("This is still under construction! Feel free to contact jy4421@nyu.edu");

	// });
}


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