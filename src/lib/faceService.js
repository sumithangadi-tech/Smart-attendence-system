import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export function areModelsLoaded() {
  return modelsLoaded;
}

const DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5,
});

/**
 * Detect all faces in a video/canvas element and return descriptors.
 */
export async function detectFaces(videoEl) {
  const detections = await faceapi
    .detectAllFaces(videoEl, DETECTION_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptors();
  return detections;
}

/**
 * Get a single face descriptor from a video element.
 * Returns Float32Array or null if no face detected.
 */
export async function getSingleFaceDescriptor(videoEl) {
  const detection = await faceapi
    .detectSingleFace(videoEl, DETECTION_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return detection.descriptor;
}

/**
 * Match a query descriptor against labeled descriptors from DB students.
 * Returns { label, distance } or null.
 */
export function matchFace(queryDescriptor, students, threshold = 0.52) {
  if (!students || students.length === 0) return null;

  const labeledDescriptors = students
    .filter((s) => s.faceDescriptors && s.faceDescriptors.length > 0)
    .map(
      (s) =>
        new faceapi.LabeledFaceDescriptors(
          s.id,
          s.faceDescriptors
        )
    );

  if (labeledDescriptors.length === 0) return null;

  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  const result = faceMatcher.findBestMatch(queryDescriptor);

  if (result.label === 'unknown') return null;

  // Find full student object
  const student = students.find((s) => s.id === result.label);
  return { student, distance: result.distance };
}

/**
 * Draw bounding boxes on a canvas overlay.
 */
export function drawDetections(canvas, videoEl, detections) {
  faceapi.matchDimensions(canvas, videoEl);
  const resized = faceapi.resizeResults(detections, videoEl);
  faceapi.draw.drawDetections(canvas, resized);
  faceapi.draw.drawFaceLandmarks(canvas, resized);
}
