import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
const BASE_URL = 'https://sixtyworlds.com';
const clock = new THREE.Clock();
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog(0x88ccee, 0, 50);
export const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
let fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
fillLight1.position.set(2, 1, 1);
scene.add(fillLight1);

const LIGHT_SETTINGS = {
	HIGH: {
		skyColor: 0xffffff,
		groundColor: 0x8dc1de,
		intensity: 2.5
	},
	NORMAL: {
		skyColor: 0x8dc1de,
		groundColor: 0x00668d,
		intensity: 1.5
	},
	DARK: {
		skyColor: 0x444444,
		groundColor: 0x000000,
		intensity: 0.5
	}
};


const STANDARD_GRAVITY = 30;
let currentGravity = STANDARD_GRAVITY;
const STEPS_PER_FRAME = 5;

function initializeContainer() {
	const container = document.getElementById('container');
	if (!container) {
		console.warn('Container not found, likely not in tour.html');
		return null;
	}
	return container;
}



export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// Use the function where needed
let container = initializeContainer();

function addToContainer() {
	if (container) {
		// Only execute Three.js setup if container exists
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setAnimationLoop(animate);
		container.appendChild(renderer.domElement);

		// Stats setup only if container exists
		const stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0px';
		container.appendChild(stats.domElement);
	}
}

addToContainer();

const stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';

const worldOctree = new Octree();
const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;

const keyStates = {};

const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

const loader = new GLTFLoader();
let cameraData = [];
document.addEventListener('keydown', (event) => {
	keyStates[event.code] = true;
});
document.addEventListener('keyup', (event) => {
	keyStates[event.code] = false;
});
container?.addEventListener('mousedown', () => {

	document.body.requestPointerLock();

	mouseTime = performance.now();

});
document.addEventListener('mouseup', () => {

	// if (document.pointerLockElement !== null) throwBall();

});
document.body.addEventListener('mousemove', (event) => {

	if (document.pointerLockElement === document.body) {

		camera.rotation.y -= event.movementX / 500;
		camera.rotation.x -= event.movementY / 500;

	}

});
window.addEventListener('resize', onWindowResize);
function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

}
function playerCollisions() {

	const result = worldOctree.capsuleIntersect(playerCollider);

	playerOnFloor = false;

	if (result) {

		playerOnFloor = result.normal.y > 0;

		if (!playerOnFloor) {

			playerVelocity.addScaledVector(result.normal, - result.normal.dot(playerVelocity));

		}

		if (result.depth >= 1e-10) {

			playerCollider.translate(result.normal.multiplyScalar(result.depth));

		}

	}

}
function updatePlayer(deltaTime) {

	let damping = Math.exp(- 4 * deltaTime) - 1;

	if (!playerOnFloor) {

		playerVelocity.y -= currentGravity * deltaTime;

		// small air resistance
		damping *= 0.1;

	}

	playerVelocity.addScaledVector(playerVelocity, damping);

	const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
	playerCollider.translate(deltaPosition);

	playerCollisions();

	camera.position.copy(playerCollider.end);

}
function playerSphereCollision(sphere) {

	const center = vector1.addVectors(playerCollider.start, playerCollider.end).multiplyScalar(0.5);

	const sphere_center = sphere.collider.center;

	const r = playerCollider.radius + sphere.collider.radius;
	const r2 = r * r;

	// approximation: player = 3 spheres

	for (const point of [playerCollider.start, playerCollider.end, center]) {

		const d2 = point.distanceToSquared(sphere_center);

		if (d2 < r2) {

			const normal = vector1.subVectors(point, sphere_center).normalize();
			const v1 = vector2.copy(normal).multiplyScalar(normal.dot(playerVelocity));
			const v2 = vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

			playerVelocity.add(v2).sub(v1);
			sphere.velocity.add(v1).sub(v2);

			const d = (r - Math.sqrt(d2)) / 2;
			sphere_center.addScaledVector(normal, - d);

		}

	}

}
function getForwardVector() {

	camera.getWorldDirection(playerDirection);
	playerDirection.y = 0;
	playerDirection.normalize();

	return playerDirection;

}
function getSideVector() {

	camera.getWorldDirection(playerDirection);
	playerDirection.y = 0;
	playerDirection.normalize();
	playerDirection.cross(camera.up);

	return playerDirection;

}
function controls(deltaTime) {

	// gives a bit of air control
	const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

	if (keyStates['KeyW']) {

		playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));

	}

	if (keyStates['KeyS']) {

		playerVelocity.add(getForwardVector().multiplyScalar(- speedDelta));

	}

	if (keyStates['KeyA']) {

		playerVelocity.add(getSideVector().multiplyScalar(- speedDelta));

	}

	if (keyStates['KeyD']) {

		playerVelocity.add(getSideVector().multiplyScalar(speedDelta));

	}

	if (playerOnFloor) {

		if (keyStates['Space']) {

			playerVelocity.y = 15;

		}
	}
}

function teleportPlayerIfOob() {

	if (camera.position.y <= - 25) {

		playerCollider.start.set(0, 0.35, 0);
		playerCollider.end.set(0, 1, 0);
		playerCollider.radius = 0.35;
		camera.position.copy(playerCollider.end);
		camera.rotation.set(0, 0, 0);

	}

}

function animate() {

	const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

	// we look for collisions in substeps to mitigate the risk of
	// an object traversing another too quickly for detection.

	for (let i = 0; i < STEPS_PER_FRAME; i++) {

		controls(deltaTime);

		updatePlayer(deltaTime);

		teleportPlayerIfOob();

	}

	renderer.render(scene, camera);

	stats.update();

}


// Function to capture the camera's position and rotation
function logCameraPosition() {
	const timeElapsed = performance.now(); // Time since page load (milliseconds)
	const position = [camera.position.x, camera.position.y, camera.position.z];
	const rotation = [camera.rotation.x, camera.rotation.y, camera.rotation.z];

	// Store the data in an array
	cameraData.push({ time: timeElapsed, position, rotation });
}

// Function to convert the data into CSV format
function convertToCSV(data) {
	let csv = 'time,x,y,z,pitch,yaw,roll\n';
	data.forEach(entry => {
		const { time, position, rotation } = entry;
		// Reduce precision to 2 decimal places for position and 3 for rotation
		const formattedTime = time.toFixed(2);
		const formattedPosition = position.map(coord => coord.toFixed(2));
		const formattedRotation = rotation.map(angle => angle.toFixed(3));

		csv += `${formattedTime},${formattedPosition[0]},${formattedPosition[1]},${formattedPosition[2]},${formattedRotation[0]},${formattedRotation[1]},${formattedRotation[2]}\n`;
	});

	return csv;
}

// Function to send the CSV data to the server
function sendDataToServer() {
	const csvData = convertToCSV(cameraData);  // Make sure this returns a string

	console.log('Sending CSV data to server:', csvData);  // Add logging to verify this

	fetch(`${BASE_URL}/save-camera-data`, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/csv',  // Ensure the correct content type
		},
		body: csvData  // Ensure that csvData is a string
	}).then(response => {
		if (response.ok) {
			console.log('Data successfully sent to the server.');
		} else {
			console.error('Failed to send data to the server.');
		}
	}).catch(err => console.error('Error while sending data:', err));
}

// Send data to the server when the user is about to leave the page
// window.addEventListener('beforeunload', (event) => {
// 	sendDataToServer();
// 	event.preventDefault(); // Optional: prevent default action
// 	//   event.returnValue = ''; // Required for Chrome to show confirmation dialog
// });

async function fetchAndRenderCSVData() {
	const response = await fetch(`${BASE_URL}/get-csv-data`);
	const data = await response.json();  // Receive the parsed CSV data as JSON
	console.log(data);

	// Create a group to hold all points and lines
	const group = new THREE.Group();

	// Variables for efficient point and line rendering
	const pointsArray = [];
	const lineArray = [];

	// Go through each file's data and render points and lines
	data.forEach(fileData => {
		const pointsData = fileData.data;

		pointsData.forEach((point, index) => {
			const { x, y, z, pitch, yaw, roll } = point;  // Assuming CSV contains these fields

			const position = new THREE.Vector3(parseFloat(x), parseFloat(y), parseFloat(z));
			const direction = new THREE.Vector3(parseFloat(pitch), parseFloat(yaw), parseFloat(roll));

			// Store point and line data for later use
			pointsArray.push(position);

			// Create a line from the point in the direction of the rotation
			const lineEnd = position.clone().add(direction);  // Extend the line using the direction
			lineArray.push(position, lineEnd);  // Add both start and end points of the line
		});
	});

	// Call the functions to add the points and lines to the scene
	renderPoints(pointsArray, group);
	renderLines(lineArray, group);

	// Add the group of points and lines to the scene
	scene.add(group);
}

function renderPoints(pointsArray, group) {
	const pointsGeometry = new THREE.BufferGeometry();
	const vertices = new Float32Array(pointsArray.length * 3);  // 3 floats per point (x, y, z)

	// Fill the vertices array
	pointsArray.forEach((point, index) => {
		vertices[index * 3] = point.x;
		vertices[index * 3 + 1] = point.y;
		vertices[index * 3 + 2] = point.z;
	});

	// Assign the vertices to the geometry
	pointsGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

	// Create a PointsMaterial with reduced quality to minimize cost
	const pointsMaterial = new THREE.PointsMaterial({
		color: 0x00ff00,  // Set color
		size: 0.1,        // Point size
		sizeAttenuation: true,  // Points get smaller with distance
	});

	// Create and add Points to the group
	const points = new THREE.Points(pointsGeometry, pointsMaterial);
	group.add(points);
}

function renderLines(lineArray, group) {
	const lineGeometry = new THREE.BufferGeometry();
	const lineVertices = new Float32Array(lineArray.length * 3);  // 3 floats per vertex

	// Fill the vertices array
	lineArray.forEach((point, index) => {
		lineVertices[index * 3] = point.x;
		lineVertices[index * 3 + 1] = point.y;
		lineVertices[index * 3 + 2] = point.z;
	});

	// Assign the vertices to the geometry
	lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));

	// Create a LineBasicMaterial to reduce computational cost
	const lineMaterial = new THREE.LineBasicMaterial({
		color: 0x0000ff,  // Set color
		linewidth: 1,     // Line width (NOTE: In Three.js, this may not affect most platforms)
	});

	// Create and add Lines to the group
	const line = new THREE.LineSegments(lineGeometry, lineMaterial);
	group.add(line);
}
export function loadModel(modelObject, onComplete) {
	console.log("Loading is now started");
	showLoadingGear();
	container = initializeContainer();
	addToContainer();
	let path = modelObject.model_url;

	loader.load(
		path,
		(gltf) => {
			try {
				// Critical part of loading logic
				scene.add(gltf.scene);
				worldOctree.fromGraphNode(gltf.scene);

				// Traverse the loaded model
				gltf.scene.traverse((child) => {
					if (child.isMesh) {
						child.castShadow = true;
						child.receiveShadow = true;
						if (child.material.map) {
							child.material.map.anisotropy = 4;
						}
					}
				});

				// Add debugging helper
				const helper = new OctreeHelper(worldOctree);
				helper.visible = false;
				scene.add(helper);

				// GUI Setup
				const gui = new GUI({ width: 200 });
				gui.add({ debug: false }, "debug").onChange(function (value) {
					helper.visible = value;
				});
			} catch (error) {
				// Catch and log minor errors, but do not block completion
				console.error("Minor error during model processing:", error);
			} finally {
				// Ensure the completion callback is always called
				if (onComplete) {
					onComplete();
				}
			}
		},
		// Progress callback
		(xhr) => {
			const percentLoaded = (xhr.loaded / xhr.total) * 100;
			updateLoadingGear(percentLoaded); // Update loading progress
		},
		// Error callback
		(error) => {
			console.error("An error occurred while loading the model:", error);

			// Ensure completion callback is still called in case of load failure
			if (onComplete) {
				onComplete();
			}
		}
	);
}

// fetchAndRenderCSVData();

export function testA() {
	console.log("testA")
}

// Function to show the loading gear
function showLoadingGear() {
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
	document.body.appendChild(progressText);
	document.body.appendChild(gear);
}

// Function to hide the rotating gear
function hideLoadingGear() {
	const gear = document.getElementById('loadingGear');
	if (gear) {
		document.body.removeChild(gear);
	}
}

// Function to update the loading progression
function updateLoadingGear(progression) {
	const progressText = document.getElementById('loadingProgress');
	if (progressText) {
		// Ensure progression is between 0 and 100
		const displayProgress = Math.min(Math.max(progression, 0), 100);
		progressText.innerText = `${displayProgress}%`;
	}
}

let currentMoveMode = 'fly'
export function toggleMoveMode() {
	if (currentMoveMode == 'fly') {
		currentMoveMode = 'walk'
		currentGravity = STANDARD_GRAVITY

	} else {
		currentMoveMode = 'fly'
		currentGravity = STANDARD_GRAVITY/6;
	}
	return currentMoveMode
}

let currentLightMode = 'NORMAL';

export function toggleLighting() {
	switch (currentLightMode) {
		case 'NORMAL':
			currentLightMode = 'HIGH';
			break;
		case 'HIGH':
			currentLightMode = 'DARK';
			break;
		case 'DARK':
			currentLightMode = 'NORMAL';
			break;
	}

	const settings = LIGHT_SETTINGS[currentLightMode];
	fillLight1.skyColor.setHex(settings.skyColor);
	fillLight1.groundColor.setHex(settings.groundColor);
	fillLight1.intensity = settings.intensity;

	return currentLightMode;
}