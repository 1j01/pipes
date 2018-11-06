# [![](images/meta/icon-32x32.png) Pipes](https://1j01.github.io/pipes/)

A web-based remake of the Windows 3D Pipes screensaver (3D Pipes.scr or sspipes.scr) using [Three.js](https://threejs.org/)

Includes both [Utah Teapots](https://en.wikipedia.org/wiki/Utah_teapot) and candy cane easter eggs! (with increased chances 😏)

[Check it out!](https://1j01.github.io/pipes/)

[![](images/meta/screencap.gif)](https://1j01.github.io/pipes/)

## TODO

* Expose options in the UI (and save to local storage)

* Handle different joint options (currently only does "mixed" (which is the best option anyways, except I haven't implemented proper elbow joints))

* Proper elbow joints (currently uses a sphere (smaller than the ball joint so it doesn't stick out) rather than a section of a torus);
could use [spline extrusion](https://threejs.org/examples/#webgl_geometry_extrude_splines) rather than trying to align a torus section every which way

* Investigate pipe behaviors.
Long pipes, following other pipes, short winding pipes?
Avoiding intersection?
...After quite some searching, I finally found the [original OpenGL pipes screensaver source code here](https://winworldpc.com/download/3d03c2ad-c2ad-18c3-9a11-c3a4e284a2ef) (in `K:\MSTOOLS\SAMPLES\OPENGL\SCRSAVE`).

* Update README GIF

* VR maybe

## See Also

##### Mine / Affiliated

* [98.js: a recreation of the Windows 98 desktop](https://github.com/1j01/98)

* [NW Screensaver: a platform for running web pages as screensavers](https://github.com/1j01/nw-screensaver)

##### Unaffiliated

* [Screensaver Subterfuge: a game set in the 3D maze screensaver](https://poor-track-design.itch.io/screensaver-subterfuge)

## License

MIT-licensed; see [LICENSE](LICENSE) for details
