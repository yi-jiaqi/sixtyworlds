import { scene, camera, renderer } from './load.js';

export async function uploadWorld(author_UID, formData,blobUrl) {
    console.log('Uploading world...');
    let config = fetchConfigFromUI(author_UID, formData);
	console.log(config)
	let model_name = config.model_name;
    const { paURL_preview, paURL_model, serial } = await writeToServer(config);
    const previewBlob = await createPreviewBlob();
    const renamedPreviewBlob = new File([previewBlob], `${serial}`, {
        type: 'image/jpeg',
    });
    await uploadToAWS(paURL_preview, renamedPreviewBlob);
    const fileBlob = await fetch(blobUrl).then((res) => res.blob());
    const renamedFileBlob = new File([fileBlob], `${serial}.${getFileExtension(model_name)}`, {
        type: fileBlob.type,
    });
    await uploadToAWS(paURL_model, renamedFileBlob);
    console.log('Upload completed successfully.');
}

async function writeToServer(config) {
	/*
	This frontend function is going to:
	 1. send the config object to server 
	 2. get the 2 preAssignedURLs from server to upload the preview and the file;	
	*/
	console.log('Writing to server...');
	const response = await fetch('/api/uploadWorld', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(config),
	});

	if (!response.ok) {
		throw new Error('Failed to get presigned URLs');
	}

	return await response.json(); // { paURL_preview, paURL_model, serial }

}

function createPreviewBlob() {
    console.log('Creating preview blob...');
    // Force a render to ensure the current state is captured
    renderer.render(scene, camera);
    
    // Now capture the canvas
    const canvas = renderer.domElement;
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.95);
    });
}

async function uploadToAWS(url, blob) {
	console.log('Uploading to AWS...');
	const response = await fetch(url, {
		method: 'PUT',
		body: blob,
	});

	if (!response.ok) {
		throw new Error(`Failed to upload to AWS: ${response.statusText}`);
	}
}

function getFileExtension(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
        console.warn(`No file extension found for "${fileName}", defaulting to "glb"`);
        return 'glb'; // Default to .glb since we're working with 3D models
    }
    return fileName.slice(lastDotIndex + 1);
}


function fetchConfigFromUI(author_UID, formData) {
    console.log('Fetching config from UI...');
    const { modelName, authorName, keywords } = formData;
    
    const config = {
        serial: null,
        model_name: modelName,
        author_name: authorName,
        author_uid: author_UID,
        upload_date: null,
        configuration: `"[0,0,0,0,0,0]"`,
        keywords: `"[${keywords.split(",").map(k => `'${k.trim()}'`)}]"`,
        likes: 0
    };

    return config;
}