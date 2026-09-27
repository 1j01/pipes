/*******\
|options|
\*******/

// Options are layered: defaults, then what the user last chose (saved in
// localStorage), then anything given in the URL hash as JSON, e.g.
// <iframe src="https://1j01.github.io/pipes/#{%22hideUI%22:true,%22speed%22:20}"/>
// URL options apply to this page view only; they're never saved.

var MIN_SPEED = 2;
var MAX_SPEED = 300;
var MIN_ZOOM = 0.5;
var MAX_ZOOM = 3;

var optionChoices = {
  joints: ["elbow", "ball", "mixed", "cycle"],
  transition: ["dissolve", "fade"],
  palette: ["random", "classic", "materials"],
  texture: ["none", "rusty", "custom"],
  camera: ["static", "rotate"],
};

var defaultOptions = {
  joints: "mixed",
  speed: 60, // pipe segments per second
  transition: "dissolve",
  palette: "random",
  texture: "none",
  camera: "static",
  zoom: 1.5, // 1 fits the whole grid in view from any angle
  hideUI: false,
};

var STORAGE_KEY = "pipes-options";

function sanitizeOption(key, value) {
  if (optionChoices[key]) {
    return optionChoices[key].indexOf(value) > -1 ? value : undefined;
  }
  if (key === "speed") {
    var speed = Number(value);
    return isFinite(speed) ? clamp(speed, MIN_SPEED, MAX_SPEED) : undefined;
  }
  if (key === "zoom") {
    var zoom = Number(value);
    return isFinite(zoom) ? clamp(zoom, MIN_ZOOM, MAX_ZOOM) : undefined;
  }
  if (key === "hideUI") {
    return !!value;
  }
  return undefined;
}

function sanitizeOptions(object, allowedKeys) {
  var sanitized = {};
  if (object && typeof object === "object") {
    allowedKeys.forEach(function(key) {
      var value = sanitizeOption(key, object[key]);
      if (value !== undefined) {
        sanitized[key] = value;
      }
    });
  }
  return sanitized;
}

var persistentOptionKeys = Object.keys(defaultOptions).filter(function(key) {
  // hiding the UI is only meant for embedding; saving it would leave no way back
  return key !== "hideUI";
});

function loadSavedOptions() {
  try {
    return sanitizeOptions(
      JSON.parse(localStorage.getItem(STORAGE_KEY)),
      persistentOptionKeys
    );
  } catch (error) {
    return {};
  }
}

function saveOptions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedOptions));
  } catch (error) {
    // storage may be unavailable (private browsing, blocked site data); options just won't persist
  }
}

function parseURLOptions() {
  var json = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!json) {
    return {};
  }
  try {
    var params = JSON.parse(json);
  } catch (error) {
    alert(
      "Invalid URL parameter JSON syntax\n\n" + error + "\n\nReceived:\n" + json
    );
    return {};
  }
  if (!params || typeof params !== "object") {
    alert("Invalid URL parameter JSON: top level value must be an object");
    return {};
  }
  return sanitizeOptions(params, Object.keys(defaultOptions));
}

var savedOptions = loadSavedOptions();
var urlOptions = parseURLOptions();
var options = Object.assign({}, defaultOptions, savedOptions, urlOptions);

function setOption(key, value) {
  value = sanitizeOption(key, value);
  if (value === undefined) {
    return;
  }
  options[key] = value;
  // a choice made in the UI takes precedence over the URL from now on
  delete urlOptions[key];
  if (persistentOptionKeys.indexOf(key) > -1) {
    savedOptions[key] = value;
    saveOptions();
  }
}

/****\
|grid|
\****/

var gridBounds = new THREE.Box3(
  new THREE.Vector3(-10, -10, -10),
  new THREE.Vector3(10, 10, 10)
);
var gridCells = {};

function gridKey(position) {
  return position.x + "," + position.y + "," + position.z;
}
function isOccupied(position) {
  return gridKey(position) in gridCells;
}
function occupy(position, pipe) {
  gridCells[gridKey(position)] = pipe;
}
function clearGrid() {
  gridCells = {};
}

/********\
|textures|
\********/

var RUSTY_TEXTURE_URL = "images/textures/rusty.png";
var CANDY_CANE_TEXTURE_URL = "images/textures/candycane.png";

var textureLoader = new THREE.TextureLoader();
var textureCache = {};

function getTexture(url) {
  if (!textureCache[url]) {
    var texture = textureLoader.load(url);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    textureCache[url] = texture;
  }
  return textureCache[url];
}

// Custom textures are drawn from a bag, so every texture gets used
// before any is repeated.
var customTextureURLs = [];
var customTextureBag = [];

function addCustomTextures(files) {
  var added = 0;
  Array.from(files).forEach(function(file) {
    if (/^image\//.test(file.type)) {
      customTextureURLs.push(URL.createObjectURL(file));
      added += 1;
    }
  });
  customTextureBag = [];
  return added;
}

function removeCustomTextures() {
  customTextureURLs.forEach(function(url) {
    if (textureCache[url]) {
      textureCache[url].dispose();
      delete textureCache[url];
    }
    URL.revokeObjectURL(url);
  });
  customTextureURLs = [];
  customTextureBag = [];
}

function drawCustomTextureURL() {
  if (customTextureBag.length === 0) {
    customTextureBag = customTextureURLs.slice();
    shuffleArrayInPlace(customTextureBag);
  }
  return customTextureBag.pop();
}

/*********\
|materials|
\*********/

var classicColors = [
  0xff0000,
  0x00ff00,
  0x0000ff,
  0xffff00,
  0x00ffff,
  0xff00ff,
  0xffffff,
  0xff8000,
];

// The classic OpenGL material table (ambient, diffuse, specular, shininess),
// from the teapots demo; the brighter half of it.
// prettier-ignore
var materialTable = [
  [[0.0215, 0.1745, 0.0215], [0.07568, 0.61424, 0.07568], [0.633, 0.727811, 0.633], 0.6], // emerald
  [[0.135, 0.2225, 0.1575], [0.54, 0.89, 0.63], [0.316228, 0.316228, 0.316228], 0.1], // jade
  [[0.25, 0.20725, 0.20725], [1, 0.829, 0.829], [0.296648, 0.296648, 0.296648], 0.088], // pearl
  [[0.1745, 0.01175, 0.01175], [0.61424, 0.04136, 0.04136], [0.727811, 0.626959, 0.626959], 0.6], // ruby
  [[0.1, 0.18725, 0.1745], [0.396, 0.74151, 0.69102], [0.297254, 0.30829, 0.306678], 0.1], // turquoise
  [[0.329412, 0.223529, 0.027451], [0.780392, 0.568627, 0.113725], [0.992157, 0.941176, 0.807843], 0.21794872], // brass
  [[0.2125, 0.1275, 0.054], [0.714, 0.4284, 0.18144], [0.393548, 0.271906, 0.166721], 0.2], // bronze
  [[0.25, 0.25, 0.25], [0.4, 0.4, 0.4], [0.774597, 0.774597, 0.774597], 0.6], // chrome
  [[0.19125, 0.0735, 0.0225], [0.7038, 0.27048, 0.0828], [0.256777, 0.137622, 0.086014], 0.1], // copper
  [[0.24725, 0.1995, 0.0745], [0.75164, 0.60648, 0.22648], [0.628281, 0.555802, 0.366065], 0.4], // gold
  [[0.19225, 0.19225, 0.19225], [0.50754, 0.50754, 0.50754], [0.508273, 0.508273, 0.508273], 0.4], // silver
  [[0, 0.1, 0.06], [0, 0.50980392, 0.50980392], [0.50196078, 0.50196078, 0.50196078], 0.25], // cyan plastic
  [[0, 0, 0], [0.1, 0.35, 0.1], [0.45, 0.55, 0.45], 0.25], // green plastic
  [[0, 0, 0], [0.5, 0, 0], [0.7, 0.6, 0.6], 0.25], // red plastic
  [[0, 0, 0], [0.55, 0.55, 0.55], [0.7, 0.7, 0.7], 0.25], // white plastic
  [[0, 0, 0], [0.5, 0.5, 0], [0.6, 0.6, 0.5], 0.25], // yellow plastic
];

function makeColoredMaterial(color) {
  return new THREE.MeshPhongMaterial({
    color: color,
    emissive: new THREE.Color(color).multiplyScalar(0.3),
    specular: 0xa9fcff,
    shininess: 100,
  });
}

function makeTableMaterial(entry) {
  var rgb = function(values) {
    return new THREE.Color(values[0], values[1], values[2]);
  };
  return new THREE.MeshPhongMaterial({
    color: rgb(entry[1]),
    // stand in for OpenGL's per-material ambient term
    emissive: rgb(entry[0]),
    specular: rgb(entry[2]),
    shininess: entry[3] * 128,
  });
}

function makePipeMaterial(textureURL) {
  if (textureURL) {
    return new THREE.MeshLambertMaterial({ map: getTexture(textureURL) });
  }
  switch (options.palette) {
    case "classic":
      return makeColoredMaterial(chooseFrom(classicColors));
    case "materials":
      return makeTableMaterial(chooseFrom(materialTable));
    default:
      return makeColoredMaterial(randomInteger(0, 0xffffff));
  }
}

/****\
|pipe|
\****/

var PIPE_RADIUS = 0.2;
var BALL_JOINT_RADIUS = PIPE_RADIUS * 1.5;
var ELBOW_RADIUS = PIPE_RADIUS * 1.25;
var TEAPOT_SIZE = BALL_JOINT_RADIUS;

// Pipes and elbows both have their rings of vertices starting on a grid
// axis, and every turn is a multiple of 90 degrees, so with a multiple of 4
// sides the rings line up exactly where they meet, leaving no seams.
var PIPE_SIDES = 16;

// Geometry is shared between all pipes, and sized/placed per mesh.
var geometries = {
  // unit length, along the Y axis, scaled to length per segment
  cylinder: new THREE.CylinderBufferGeometry(
    PIPE_RADIUS,
    PIPE_RADIUS,
    1,
    PIPE_SIDES,
    1,
    true
  ),
  ball: new THREE.SphereBufferGeometry(BALL_JOINT_RADIUS, 8, 8),
  // a quarter torus in the XY plane, from (r, 0, 0) to (0, r, 0)
  elbow: new THREE.TorusBufferGeometry(
    ELBOW_RADIUS,
    PIPE_RADIUS,
    PIPE_SIDES,
    12,
    Math.PI / 2
  ),
  teapot: new THREE.TeapotBufferGeometry(TEAPOT_SIZE, 8),
};

var Y_AXIS = new THREE.Vector3(0, 1, 0);

function findFreeGridPosition() {
  var position;
  for (var attempts = 0; attempts < 100; attempts++) {
    position = randomIntegerVector3WithinBox(gridBounds);
    if (!isOccupied(position)) {
      break;
    }
  }
  return position;
}

function Pipe(scene, pipeOptions) {
  this.teapotChance = pipeOptions.teapotChance;
  this.ballJointChance = pipeOptions.ballJointChance;
  this.material = pipeOptions.material;
  this.object3d = new THREE.Object3D();
  scene.add(this.object3d);

  this.currentPosition = findFreeGridPosition();
  this.lastDirection = null;
  this.lastSegment = null;
  occupy(this.currentPosition, this);
  this.addMesh(geometries.ball, this.currentPosition);
}

Pipe.prototype.addMesh = function(geometry, position) {
  var mesh = new THREE.Mesh(geometry, this.material);
  mesh.position.copy(position);
  this.object3d.add(mesh);
  return mesh;
};

Pipe.prototype.addSegment = function(start, end) {
  var segment = {
    start: start,
    end: end,
    mesh: this.addMesh(geometries.cylinder, start),
  };
  var direction = new THREE.Vector3().subVectors(end, start).normalize();
  segment.mesh.quaternion.setFromUnitVectors(Y_AXIS, direction);
  this.placeSegment(segment);
  return segment;
};

Pipe.prototype.placeSegment = function(segment) {
  segment.mesh.position
    .addVectors(segment.start, segment.end)
    .multiplyScalar(0.5);
  segment.mesh.scale.y = segment.start.distanceTo(segment.end);
};

// A curved elbow at a corner. The segment coming into the corner is cut
// short so it meets the start of the curve, and the returned point is
// where the outgoing segment should start.
Pipe.prototype.addElbow = function(corner, inDirection, outDirection) {
  this.lastSegment.end = corner
    .clone()
    .addScaledVector(inDirection, -ELBOW_RADIUS);
  this.placeSegment(this.lastSegment);

  // Map the torus's local axes so its start (radial +X, tangent +Y) lines up
  // with the incoming pipe, and its end (radial +Y, tangent -X) with the outgoing one.
  var xAxis = outDirection.clone().negate();
  var yAxis = inDirection.clone();
  var zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  var center = corner
    .clone()
    .addScaledVector(inDirection, -ELBOW_RADIUS)
    .addScaledVector(outDirection, ELBOW_RADIUS);
  var elbow = this.addMesh(geometries.elbow, center);
  elbow.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
  );

  return corner.clone().addScaledVector(outDirection, ELBOW_RADIUS);
};

Pipe.prototype.addTeapot = function(position) {
  var teapot = this.addMesh(geometries.teapot, position);
  teapot.rotation.set(
    chooseFrom([0, 1, 2, 3]) * (Math.PI / 2),
    chooseFrom([0, 1, 2, 3]) * (Math.PI / 2),
    chooseFrom([0, 1, 2, 3]) * (Math.PI / 2)
  );
};

Pipe.prototype.step = function() {
  var direction;
  if (this.lastDirection && chance(1 / 2)) {
    direction = this.lastDirection;
  } else {
    direction = new THREE.Vector3();
    direction[chooseFrom("xyz")] = chooseFrom([+1, -1]);
  }
  var newPosition = new THREE.Vector3().addVectors(
    this.currentPosition,
    direction
  );

  // TODO: try other directions before giving up for this step
  // (and if there's truly nowhere to go, maybe end with a ball joint)
  if (!gridBounds.containsPoint(newPosition) || isOccupied(newPosition)) {
    return;
  }
  occupy(newPosition, this);

  var segmentStart = this.currentPosition;
  // (the initial ball joint is made in the constructor)
  if (this.lastDirection && !this.lastDirection.equals(direction)) {
    if (chance(this.teapotChance)) {
      this.addTeapot(this.currentPosition);
    } else if (chance(this.ballJointChance)) {
      this.addMesh(geometries.ball, this.currentPosition);
    } else {
      segmentStart = this.addElbow(
        this.currentPosition,
        this.lastDirection,
        direction
      );
    }
  }
  this.lastSegment = this.addSegment(segmentStart, newPosition);

  this.currentPosition = newPosition;
  this.lastDirection = direction;
};

Pipe.prototype.dispose = function() {
  this.object3d.parent.remove(this.object3d);
  // geometry is shared; textures are cached
  this.material.dispose();
};

/*****\
|scene|
\*****/

var canvasContainer = document.getElementById("canvas-container");
var canvasWebGL = document.getElementById("canvas-webgl");
// 2d canvas overlay for transition effects
var canvas2d = document.getElementById("canvas-2d");
var ctx2d = canvas2d.getContext("2d");

var renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  canvas: canvasWebGL,
});
renderer.setSize(window.innerWidth, window.innerHeight);

var camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  100000
);

var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enabled = false;
// OrbitControls rotates a fixed amount per frame, assuming 60fps;
// this is the speed at 60fps, adjusted for the actual frame rate each frame.
var AUTO_ROTATE_SPEED = 1;

var scene = new THREE.Scene();

scene.add(new THREE.AmbientLight(0x111111));
var directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.position.set(-1.2, 1.5, 0.5);
scene.add(directionalLight);

var gridBoundingSphere = gridBounds.getBoundingSphere(new THREE.Sphere());

// How far the camera sits from the center of the grid. At zoom 1, the whole
// grid fits on screen however it's turned, whatever the screen's shape.
function getCameraDistance() {
  var verticalFOV = THREE.Math.degToRad(camera.fov);
  var horizontalFOV = 2 * Math.atan(Math.tan(verticalFOV / 2) * camera.aspect);
  var narrowestFOV = Math.min(verticalFOV, horizontalFOV);
  return gridBoundingSphere.radius / Math.sin(narrowestFOV / 2) / options.zoom;
}

function updateCameraDistance() {
  // leave the camera alone while someone's steering it
  // (zooms along the line of sight, in case the view was panned earlier)
  if (!controls.enabled) {
    camera.position
      .sub(controls.target)
      .setLength(getCameraDistance())
      .add(controls.target);
    controls.update();
  }
}

function look() {
  if (chance(1 / 2)) {
    // head-on view
    camera.position.set(0, 0, 1);
  } else {
    // random view
    var axis = new THREE.Vector3(
      random(-1, 1),
      random(-1, 1),
      random(-1, 1)
    ).normalize();
    camera.position.set(1, 0, 0).applyAxisAngle(axis, Math.PI / 2);
  }
  camera.position.setLength(getCameraDistance());
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  controls.update();
}

/**********\
|transition|
\**********/

// Covers the scene with black, either in random squares (dissolve) or all at
// once (fade). Rendering continues underneath, so the camera can still move.
var transition = null;

function startTransition(seconds, onEnd) {
  var kind = options.transition;
  transition = {
    kind: kind,
    startTime: performance.now(),
    duration: seconds * 1000,
    onEnd: onEnd,
  };
  if (kind === "dissolve") {
    // roughly 20px squares
    transition.columns = Math.ceil(window.innerWidth / 20);
    transition.rows = Math.ceil(window.innerHeight / 20);
    transition.cells = [];
    for (var y = 0; y < transition.rows; y++) {
      for (var x = 0; x < transition.columns; x++) {
        transition.cells.push({ x: x, y: y });
      }
    }
    shuffleArrayInPlace(transition.cells);
    transition.cellsDrawn = 0;
  }
}

function fillDissolveCell(cell) {
  var cellWidth = canvas2d.width / transition.columns;
  var cellHeight = canvas2d.height / transition.rows;
  ctx2d.fillRect(
    Math.floor(cell.x * cellWidth),
    Math.floor(cell.y * cellHeight),
    Math.ceil(cellWidth),
    Math.ceil(cellHeight)
  );
}

function updateTransition(now, canvasWasCleared) {
  // (a frame's timestamp can be slightly earlier than when the transition started)
  var progress = clamp(
    (now - transition.startTime) / transition.duration,
    0,
    1
  );
  ctx2d.fillStyle = "black";
  if (transition.kind === "dissolve") {
    var target = Math.floor(progress * transition.cells.length);
    var from = canvasWasCleared ? 0 : transition.cellsDrawn;
    for (var i = from; i < target; i++) {
      fillDissolveCell(transition.cells[i]);
    }
    transition.cellsDrawn = target;
  } else {
    ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
    ctx2d.globalAlpha = progress;
    ctx2d.fillRect(0, 0, canvas2d.width, canvas2d.height);
    ctx2d.globalAlpha = 1;
  }
  if (progress >= 1) {
    var onEnd = transition.onEnd;
    transition = null;
    onEnd();
    ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
  }
}

/*************\
|scene cycling|
\*************/

var pipes = [];
var stepsUntilClear = 0;
var jointsCycleIndex = 0;
// how many steps a scene lasts: about 16 to 24 seconds at the default speed
var SCENE_STEPS = [960, 1440];

function getBallJointChance() {
  var joints = options.joints;
  if (joints === "cycle") {
    var cycle = ["elbow", "ball", "mixed"];
    joints = cycle[jointsCycleIndex++ % cycle.length];
  }
  return { elbow: 0, ball: 1, mixed: 1 / 3 }[joints];
}

function startScene() {
  var ballJointChance = getBallJointChance();
  var teapotChance = 1 / 200; // 1 / 1000 in the original
  var sceneTextureURL = null;
  if (options.texture === "rusty") {
    sceneTextureURL = RUSTY_TEXTURE_URL;
  }
  if (chance(1 / 20)) {
    // why not? :)
    teapotChance = 1 / 20;
    sceneTextureURL = CANDY_CANE_TEXTURE_URL;
  }
  var pipeCount = 2 + chance(1 / 10);
  for (var i = 0; i < pipeCount; i++) {
    var textureURL = sceneTextureURL;
    if (
      !textureURL &&
      options.texture === "custom" &&
      customTextureURLs.length > 0
    ) {
      textureURL = drawCustomTextureURL();
    }
    pipes.push(
      new Pipe(scene, {
        teapotChance: teapotChance,
        ballJointChance: ballJointChance,
        material: makePipeMaterial(textureURL),
      })
    );
  }
  stepsUntilClear = randomInteger(SCENE_STEPS[0], SCENE_STEPS[1]);
}

function resetScene() {
  pipes.forEach(function(pipe) {
    pipe.dispose();
  });
  pipes = [];
  clearGrid();
  // don't yank the camera away from someone who's steering it
  if (!controls.enabled) {
    look();
  }
  startScene();
}

function clearScene(fast) {
  if (!transition) {
    startTransition(fast ? 0.2 : 2, resetScene);
  }
}

/*********\
|animation|
\*********/

var lastFrameTime = performance.now();
var stepAccumulator = 0;

function animate(now) {
  requestAnimationFrame(animate);
  // cap the time delta, so coming back to a background tab doesn't cause a burst
  var deltaSeconds = Math.min(now - lastFrameTime, 250) / 1000;
  lastFrameTime = now;

  var canvasWasCleared = false;
  if (
    canvas2d.width !== window.innerWidth ||
    canvas2d.height !== window.innerHeight
  ) {
    canvas2d.width = window.innerWidth;
    canvas2d.height = window.innerHeight;
    canvasWasCleared = true;
  }

  // pipes hold still while the scene is being cleared
  if (!transition) {
    stepAccumulator += deltaSeconds * options.speed;
    while (stepAccumulator >= 1) {
      stepAccumulator -= 1;
      for (var i = 0; i < pipes.length; i++) {
        pipes[i].step();
      }
      stepsUntilClear -= 1;
      if (stepsUntilClear <= 0) {
        clearScene(false);
        break;
      }
    }
  }
  if (transition) {
    stepAccumulator = 0;
  }

  controls.autoRotate = options.camera === "rotate";
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED * deltaSeconds * 60;
  controls.update();
  renderer.render(scene, camera);

  if (transition) {
    updateTransition(now, canvasWasCleared);
  }
}

addEventListener("resize", function() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  updateCameraDistance();
});

/*****\
|input|
\*****/

canvasContainer.addEventListener("mousedown", function(event) {
  event.preventDefault();
  if (!controls.enabled) {
    if (event.button) {
      clearScene(true);
    } else {
      look();
    }
  }
  window.getSelection().removeAllRanges();
  document.activeElement.blur();
});

// (while steering the camera, OrbitControls handles the wheel instead)
canvasContainer.addEventListener(
  "wheel",
  function(event) {
    if (!controls.enabled) {
      event.preventDefault();
      setOption("zoom", options.zoom * Math.pow(0.9, Math.sign(event.deltaY)));
      updateUI();
      updateCameraDistance();
    }
  },
  { passive: false }
);

canvasContainer.addEventListener("contextmenu", function(event) {
  event.preventDefault();
});

// drop image files anywhere to use them as pipe textures
addEventListener("dragover", function(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
addEventListener("drop", function(event) {
  event.preventDefault();
  useCustomTextures(event.dataTransfer.files);
});

/**\
|UI|
\**/

var jointTypeSelect = document.getElementById("joint-types");
var speedSlider = document.getElementById("speed");
var speedOutput = document.getElementById("speed-output");
var zoomSlider = document.getElementById("zoom");
var zoomOutput = document.getElementById("zoom-output");
var transitionSelect = document.getElementById("transition");
var paletteSelect = document.getElementById("palette");
var textureSelect = document.getElementById("texture");
var textureFileInput = document.getElementById("texture-file-input");
var addTexturesButton = document.getElementById("add-textures");
var removeTexturesButton = document.getElementById("remove-textures");
var cameraSelect = document.getElementById("camera");

// The speed slider is logarithmic, from 0 to 100.
function speedToSlider(speed) {
  return (100 * Math.log(speed / MIN_SPEED)) / Math.log(MAX_SPEED / MIN_SPEED);
}
function sliderToSpeed(value) {
  return Math.round(MIN_SPEED * Math.pow(MAX_SPEED / MIN_SPEED, value / 100));
}

function updateUI() {
  jointTypeSelect.value = options.joints;
  speedSlider.value = speedToSlider(options.speed);
  speedOutput.textContent = Math.round(options.speed) + "/s";
  zoomSlider.value = options.zoom;
  zoomOutput.textContent = options.zoom.toFixed(1) + "×";
  transitionSelect.value = options.transition;
  paletteSelect.value = options.palette;
  textureSelect.value = options.texture;
  cameraSelect.value = options.camera;
  removeTexturesButton.hidden = customTextureURLs.length === 0;
  showElementsIf(".ui-container", !options.hideUI);
}

// Options that change how a scene looks start a new scene right away,
// so you can see the effect.
function bindSelect(select, key, restartScene) {
  select.addEventListener("change", function() {
    setOption(key, select.value);
    updateUI();
    if (restartScene) {
      clearScene(true);
    }
  });
}
bindSelect(jointTypeSelect, "joints", true);
bindSelect(transitionSelect, "transition", false);
bindSelect(paletteSelect, "palette", true);
bindSelect(textureSelect, "texture", true);
bindSelect(cameraSelect, "camera", false);

zoomSlider.addEventListener("input", function() {
  setOption("zoom", Number(zoomSlider.value));
  updateUI();
  updateCameraDistance();
});

speedSlider.addEventListener("input", function() {
  setOption("speed", sliderToSpeed(speedSlider.value));
  updateUI();
});

function useCustomTextures(files) {
  if (addCustomTextures(files) > 0) {
    setOption("texture", "custom");
    updateUI();
    clearScene(true);
  }
}

addTexturesButton.addEventListener("click", function() {
  textureFileInput.click();
});
textureFileInput.addEventListener("change", function() {
  useCustomTextures(textureFileInput.files);
  textureFileInput.value = "";
});
removeTexturesButton.addEventListener("click", function() {
  removeCustomTextures();
  updateUI();
  if (options.texture === "custom") {
    clearScene(true);
  }
});

document
  .getElementById("fullscreen-button")
  .addEventListener("click", function() {
    if (canvasContainer.requestFullscreen) {
      canvasContainer.requestFullscreen();
    } else if (canvasContainer.webkitRequestFullScreen) {
      canvasContainer.webkitRequestFullScreen();
    }
  });

document
  .getElementById("toggle-controls")
  .addEventListener("click", function() {
    controls.enabled = !controls.enabled;
    showElementsIf(".normal-controls-enabled", !controls.enabled);
    showElementsIf(".orbit-controls-enabled", controls.enabled);
  });

addEventListener("hashchange", function() {
  urlOptions = parseURLOptions();
  options = Object.assign({}, defaultOptions, savedOptions, urlOptions);
  updateUI();
  updateCameraDistance();
});

/*****\
|start|
\*****/

updateUI();
look();
startScene();
requestAnimationFrame(animate);

/**************\
|boring helpers|
\**************/
function random(x1, x2) {
  return Math.random() * (x2 - x1) + x1;
}
// inclusive of both ends, all equally likely
function randomInteger(x1, x2) {
  return Math.floor(random(x1, x2 + 1));
}
function chance(value) {
  return Math.random() < value;
}
function chooseFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function shuffleArrayInPlace(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}
function randomIntegerVector3WithinBox(box) {
  return new THREE.Vector3(
    randomInteger(box.min.x, box.max.x),
    randomInteger(box.min.y, box.max.y),
    randomInteger(box.min.z, box.max.z)
  );
}
function showElementsIf(selector, condition) {
  Array.from(document.querySelectorAll(selector)).forEach(function(el) {
    el.hidden = !condition;
  });
}
