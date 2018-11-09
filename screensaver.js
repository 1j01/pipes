var box = new THREE.Box3(
  new THREE.Vector3(-10, -10, -10),
  new THREE.Vector3(10, 10, 10)
);
var nodes = {};
function setAt(position, value) {
  nodes["(" + position.x + ", " + position.y + ", " + position.z + ")"] = value;
}
function getAt(position, value) {
  return nodes["(" + position.x + ", " + position.y + ", " + position.z + ")"];
}
function clearGrid() {
  nodes = {};
}

var textures = {};
var Pipe = function(scene, o) {
  var p = this;
  var pipeRadius = 0.2;
  var ballJointRadius = pipeRadius * 1.5;
  var teapotSize = ballJointRadius;

  p.pos = integerRandomPointInBox(box);
  p.positions = [p.pos];
  p.o3d = new THREE.Object3D();
  scene.add(p.o3d);
  if (o.texture) {
    p.mat = new THREE.MeshLambertMaterial({
      map: textures[o.texture],
    });
  } else {
    var color = ~rand(0, 0xffffff);
    var emissive = new THREE.Color(color).multiplyScalar(0.3);
    p.mat = new THREE.MeshPhongMaterial({
      specular: 0xa9fcff,
      color: color,
      emissive: emissive,
      shininess: 100,
    });
  }
  var makeCylinderBetweenPoints = function(point1, point2, material) {
    var direction = new THREE.Vector3().subVectors(point2, point1);
    var arrow = new THREE.ArrowHelper(direction.clone().normalize(), point1);

    var geom = new THREE.CylinderGeometry(
      pipeRadius,
      pipeRadius,
      direction.length(),
      10,
      4,
      true
    );
    var mesh = new THREE.Mesh(geom, material);

    mesh.rotation.setFromQuaternion(arrow.quaternion);
    mesh.position.addVectors(point1, direction.multiplyScalar(0.5));
    mesh.updateMatrix();

    p.o3d.add(mesh);
  };
  var makeBallJoint = function(position) {
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballJointRadius, 8, 8),
      p.mat
    );
    ball.position.copy(position);
    p.o3d.add(ball);
  };
  var makeTeapotJoint = function(position) {
    //var tptex = textures[o.texture].clone();
    //tptex.repeat.set(1,1);
    // THREE.TeapotBufferGeometry = function ( size, segments, bottom, lid, body, fitLid, blinn )
    var teapot = new THREE.Mesh(
      new THREE.TeapotBufferGeometry(teapotSize, true, true, true, true, true),
      p.mat
      //new THREE.MeshLambertMaterial({map: tptex})
    );
    teapot.position.copy(position);
    teapot.rotation.x = (Math.floor(rand(0, 50)) * Math.PI) / 2;
    teapot.rotation.y = (Math.floor(rand(0, 50)) * Math.PI) / 2;
    teapot.rotation.z = (Math.floor(rand(0, 50)) * Math.PI) / 2;
    p.o3d.add(teapot);
  };
  var makeElbowJoint = function(fromPosition, toPosition, tangentVector) {
    //elbow
    // var r = 0.2;
    // elbow = new THREE.Mesh(new THREE.TorusGeometry(r, pipeRadius, 8, 8, Math.PI/2), p.mat);
    // elbow.position.copy(fromPosition);
    // p.o3d.add(elbow);

    //elball (not a proper elbow)
    var elball = new THREE.Mesh(
      new THREE.SphereGeometry(pipeRadius, 8, 8),
      p.mat
    );
    elball.position.copy(fromPosition);
    p.o3d.add(elball);

    // extrude an elbow joint

    // there's THREE.EllipseCurve... but that's 2D

    // function ArcCurve( scale ) {
    // 	THREE.Curve.call( this );
    // 	this.scale = ( scale === undefined ) ? 1 : scale; // TODO: remove me probably
    // }

    // ArcCurve.prototype = Object.create( THREE.Curve.prototype );
    // ArcCurve.prototype.constructor = ArcCurve;

    // ArcCurve.prototype.getPoint = function ( t ) {
    // 	function circ(t) {
    // 		return Math.sqrt(1 - t*t);
    // 	}

    // 	var tx = t;
    // 	var ty = circ(t);
    // 	var tz = 0;

    // 	return new THREE.Vector3( tx, ty, tz ).multiplyScalar( this.scale );
    // };

    // var extrudePath = new ArcCurve( 0.1 );

    // var extrudePath = new THREE.CatmullRomCurve3([fromPosition, toPosition], false); // not enough to define the curve

    // var extrusionSegments = 100;
    // var radiusSegments = 10;
    // var radius = pipeRadius;
    // var tubeGeometry = new THREE.TubeBufferGeometry( extrudePath, extrusionSegments, radius, radiusSegments, false );

    // var elbow = new THREE.Mesh(tubeGeometry, p.mat);
    // elbow.position.copy(toPosition);
    // p.o3d.add(elbow);
  };

  // if(getAt(p.pos)){
  // 	return; // TODO: find a position that's free
  // }
  setAt(p.pos, p);

  makeBallJoint(p.pos);

  p.update = function() {
    if (p.positions.length > 1) {
      var lastpos = p.positions[p.positions.length - 2];
      var lastDirectionVector = new THREE.Vector3().subVectors(p.pos, lastpos);
    }
    if (chance(1 / 2) && lastDirectionVector) {
      var directionVector = lastDirectionVector;
    } else {
      // TODO: use vector logic for getting a random direction (for brevity), and share with teapot orientation logic
      var directionVector = new THREE.Vector3();
      if (chance(1 / 2)) {
        if (chance(1 / 3)) {
          directionVector.x += 1;
        } else if (chance(1 / 2)) {
          directionVector.y += 1;
        } else {
          directionVector.z += 1;
        }
      } else {
        if (chance(1 / 3)) {
          directionVector.x -= 1;
        } else if (chance(1 / 2)) {
          directionVector.y -= 1;
        } else {
          directionVector.z -= 1;
        }
      }
    }
    var newpos = new THREE.Vector3().addVectors(p.pos, directionVector);

    // TODO: try other possibilities
    // ideally, have a pool of the 6 possible directions and try them in random order, removing them from the bag
    // (and if there's truly nowhere to go, maybe make a ball joint)
    if (!box.containsPoint(newpos)) {
      return;
    }
    if (getAt(newpos)) {
      return;
    }
    setAt(newpos, p);

    // joint
    // (initial ball joint is handled elsewhere)
    if (lastDirectionVector && !lastDirectionVector.equals(directionVector)) {
      if (chance(1 / 200 + options.TEAPOTS / 20)) {
        makeTeapotJoint(p.pos);
      } else if (chance(1 / 20)) {
        makeBallJoint(p.pos);
      } else {
        makeElbowJoint(p.pos, newpos, lastDirectionVector);
      }
    }

    // pipe
    makeCylinderBetweenPoints(p.pos, newpos, p.mat);

    // update
    p.pos = newpos;
    p.positions.push(newpos);

    // var extrudePath = new THREE.CatmullRomCurve3(p.positions, false, "catmullrom");

    // var extrusionSegments = 10 * p.positions.length;
    // var radiusSegments = 10;
    // var tubeGeometry = new THREE.TubeBufferGeometry( extrudePath, extrusionSegments, pipeRadius, radiusSegments, false );

    // if(p.mesh){
    // 	p.o3d.remove(p.mesh);
    // }
    // p.mesh = new THREE.Mesh(tubeGeometry, p.mat);
    // p.o3d.add(p.mesh);
  };
  p.clear = function() {
    scene.remove(p.o3d);
  };
};

var pipes = [];
var time = 0;
var options = {
  multiple: true,
  texture: false,
  joints: "mixed",
  interval: [16, 24], // range of seconds between fade-outs
  TEAPOTS: 0,
};

var canvasContainer = document.getElementById("canvas-container");

// 2d canvas for dissolve effect
var canvas2d = document.getElementById("canvas-2d");
var ctx2d = canvas2d.getContext("2d");

// renderer
var canvasWebGL = document.getElementById("canvas-webgl");
var renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  canvas: canvasWebGL,
});
renderer.setSize(window.innerWidth, window.innerHeight);

// camera
var camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  100000
);
look();

// scene
var scene = new THREE.Scene();

// lighting
var ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);

var directionalLightL = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLightL.position.set(-1.2, 1.5, 0.5);
scene.add(directionalLightL);

// dissolve transition effect

var dissolveRects = [];
var dissolveRectsIndex = -1;
var dissolveRectsPerRow = 50;
var dissolveRectsPerColumn = 50;
var dissolveTransitionSeconds = 2;
var dissolveTransitionFrames = dissolveTransitionSeconds * 60;
var dissolveEndCallback;

function dissolve(endCallback, seconds) {
  // TODO: determine rect sizes better and simplify
  // (silly approximation of squares of a particular size:)
  dissolveRectsPerRow = Math.ceil(window.innerWidth / 20);
  dissolveRectsPerColumn = Math.ceil(window.innerHeight / 20);

  dissolveRects = new Array(dissolveRectsPerRow * dissolveRectsPerColumn)
    .fill(null)
    .map(function(_null, index) {
      return {
        x: index % dissolveRectsPerRow,
        y: Math.floor(index / dissolveRectsPerRow),
      };
    });
  shuffleArrayInPlace(dissolveRects);
  dissolveRectsIndex = 0;
  dissolveTransitionSeconds = seconds;
  dissolveTransitionFrames = dissolveTransitionSeconds * 60;
  dissolveEndCallback = endCallback;
}
function finishDissolve() {
  dissolveEndCallback();
  dissolveRects = [];
  dissolveRectsIndex = -1;
  ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
}

var clearing = false;
var clearTID = -1;
function clear(fast) {
  clearTimeout(clearTID);
  clearTID = setTimeout(
    clear,
    rand(options.interval[0], options.interval[1]) * 1000
  );
  if (!clearing) {
    clearing = true;
    var fadeOutTime = fast ? 0.2 : 2;
    dissolve(function() {
      renderer.clear();
      for (var i = 0; i < pipes.length; i++) {
        pipes[i].clear();
      }
      pipes = [];
      clearGrid();
      time = 0;
      look();
      clearing = false;
    }, fadeOutTime);
  }
}
clearTID = setTimeout(
  clear,
  rand(options.interval[0], options.interval[1]) * 1000
);

// this function is executed on each animation frame
function animate() {
  if (options.texture && !textures[options.texture]) {
    var t = THREE.ImageUtils.loadTexture(options.texture);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    textures[options.texture] = t;
  }
  // update
  time++;
  for (var i = 0; i < pipes.length; i++) {
    pipes[i].update(scene);
  }
  if (pipes.length === 0) {
    var o = options;
    if (chance(1 / 20)) {
      o = JSON.parse(JSON.stringify(options));
      o.TEAPOTS = 1;
      o.texture = "images/textures/candycane.png";
      if (!textures[o.texture]) {
        var t = THREE.ImageUtils.loadTexture(o.texture);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2, 2);
        textures[o.texture] = t;
      }
    }
    for (var i = 0; i < 1 + options.multiple * (1 + chance(1 / 10)); i++) {
      pipes.push(new Pipe(scene, o));
    }
  }

  if (!clearing) {
    renderer.render(scene, camera);
  }

  if (
    canvas2d.width !== window.innerWidth ||
    canvas2d.height !== window.innerHeight
  ) {
    canvas2d.width = window.innerWidth;
    canvas2d.height = window.innerHeight;
    // TODO: DRY!
    // actually: TODO: make the 2d canvas really low resolution, and stretch it with CSS, with pixelated interpolation
    if (dissolveRectsIndex > -1) {
      for (var i = 0; i < dissolveRectsIndex; i++) {
        var rect = dissolveRects[i];
        // TODO: could precompute rect in screen space, or at least make this clearer with "xIndex"/"yIndex"
        var rectWidth = innerWidth / dissolveRectsPerRow;
        var rectHeight = innerHeight / dissolveRectsPerColumn;
        ctx2d.fillStyle = "black";
        ctx2d.fillRect(
          Math.floor(rect.x * rectWidth),
          Math.floor(rect.y * rectHeight),
          Math.ceil(rectWidth),
          Math.ceil(rectHeight)
        );
      }
    }
  }
  if (dissolveRectsIndex > -1) {
    // TODO: calibrate based on time transition is actually taking
    var rectsAtATime = Math.floor(
      dissolveRects.length / dissolveTransitionFrames
    );
    for (
      var i = 0;
      i < rectsAtATime && dissolveRectsIndex < dissolveRects.length;
      i++
    ) {
      var rect = dissolveRects[dissolveRectsIndex];
      // TODO: could precompute rect in screen space, or at least make this clearer with "xIndex"/"yIndex"
      var rectWidth = innerWidth / dissolveRectsPerRow;
      var rectHeight = innerHeight / dissolveRectsPerColumn;
      ctx2d.fillStyle = "black";
      ctx2d.fillRect(
        Math.floor(rect.x * rectWidth),
        Math.floor(rect.y * rectHeight),
        Math.ceil(rectWidth),
        Math.ceil(rectHeight)
      );
      dissolveRectsIndex += 1;
    }
    if (dissolveRectsIndex === dissolveRects.length) {
      finishDissolve();
    }
  }

  requestAnimationFrame(animate);
}

function look() {
  // TODO: never don't change the view (except maybe while clearing)
  if (chance(1 / 2)) {
    //head-on view

    camera.position.set(0, 0, 14);
  } else {
    //random view

    var vector = new THREE.Vector3(14, 0, 0);

    var axis = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    var angle = Math.PI / 2;
    var matrix = new THREE.Matrix4().makeRotationAxis(axis, angle);

    vector.applyMatrix4(matrix);
    camera.position.copy(vector);
  }
  var center = new THREE.Vector3(0, 0, 0);
  camera.lookAt(center);
}

addEventListener(
  "resize",
  function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  },
  false
);

canvasContainer.addEventListener("mousedown", function(e) {
  e.preventDefault();
  if (e.button) {
    clear(true);
  } else {
    look();
  }
});

var fullscreenButton = document.getElementById("fullscreen-button");
fullscreenButton.addEventListener(
  "click",
  function(e) {
    if (canvasContainer.requestFullscreen) {
      // W3C API
      canvasContainer.requestFullscreen();
    } else if (canvasContainer.mozRequestFullScreen) {
      // Mozilla current API
      canvasContainer.mozRequestFullScreen();
    } else if (canvasContainer.webkitRequestFullScreen) {
      // Webkit current API
      canvasContainer.webkitRequestFullScreen();
    }
  },
  false
);

addEventListener(
  "contextmenu",
  function(e) {
    e.preventDefault();
  },
  false
);

// start animation
animate();

/**************\
|boring helpers|
\**************/
function rand(x1, x2) {
  return Math.random() * (x2 - x1) + x1;
}
function integerRand(x1, x2) {
  return Math.round(rand(x1, x2));
}
function chance(value) {
  return rand(0, 1) < value;
}
function shuffleArrayInPlace(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}
function integerRandomPointInBox(box) {
  return new THREE.Vector3(
    integerRand(box.min.x, box.max.x),
    integerRand(box.min.y, box.max.y),
    integerRand(box.min.z, box.max.z)
  );
}
