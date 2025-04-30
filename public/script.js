let currentIndex = 0;
const itemsPerPage = 9;
const BASE_URL = 'https://sixtyworlds.com';
import { showLoadingGear, hideLoadingGear } from './ui.js';
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
				console.log("a model is loaded:",model)
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
Load the model, load the rigidbody.  
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


				console.log("sending:", fileName)




				setTimeout(() => {
					console.log("Sending delayed message...");
					editorWindow.postMessage({ fileName, blob }, `${BASE_URL}`);//change to the server address
				}, 500);

			};
			window.addEventListener("message", (event) => {
				if (event.data.type === "requestData") {
					console.log("Sending data after request:", fileName);
					editorWindow.postMessage({ fileName, blob }, window.location.origin);
				}
			});
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
		const response = await fetch(`/upload-model`, {
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


export async function getAuthorNameByUID(uid) {
    try {
        const response = await fetch(`/api/getAuthorName/${uid}`);
        // console.log(response);
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.log(`Author not found for serial ${serial}, using temp author`);
            return {
                author_uid: 'temp',
                author_name: 'ERROR'
            };
        }
    } catch (error) {
        console.warn(`Error fetching author info: ${error.message}`);
        return {
            author_uid: 'temp',
            author_name: 'ERROR'
        };
    }
}

export async function getAuthorInfoBySerial(serial) {
    try {
        const response = await fetch(`/api/getAuthorUID/${serial}`);
        // console.log(response);
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.log(`Author not found for serial ${serial}, using temp author`);
            return {
                author_uid: 'temp',
                author_name: 'temp'
            };
        }
    } catch (error) {
        console.warn(`Error fetching author info: ${error.message}`);
        return {
            author_uid: 'temp',
            author_name: 'temp'
        };
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

  APIs!  Comment, like...interaction outside of tour
*/

export async function loadAllScenes() {
	const response = await fetch('/api/scenes');
	const scenes = await response.json();
	
	scenes.forEach(sceneData => {
	  const scene = new Scene(
		[...sceneData.position, ...sceneData.rotation],
		sceneData.name
	  );
	  scene.serial = sceneData.serial; // Store DB ID
	  scene.commentId = sceneData.commentId; // Link to comment
	  
	  if (scene.commentId) {
		attachSceneToComment(scene); // Your UI logic
	  } else {
		addToScenePool(scene); // Add to standalone scenes UI
	  }
	});
  }

  export async function addSceneToServer(scene) {
	const response = await fetch('/api/scenes', {
	  method: 'POST',
	  headers: { 'Content-Type': 'application/json' },
	  body: JSON.stringify({
		sequence: 1, // Default or calculate dynamically
		commentId: scene.commentId || null, // Optional association
		position: scene.position,
		rotation: scene.rotation,
		name: scene.name
	  })
	});
	if (!response.ok) throw new Error("Failed to save scene");
	return await response.json(); // Returns { serial: 123 }
  }
  
  export async function deleteSceneOnServer(serial) {
	const response = await fetch(`/api/scenes/${serial}`, {
	  method: 'DELETE'
	});
	if (!response.ok) throw new Error("Failed to delete scene");
  }

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