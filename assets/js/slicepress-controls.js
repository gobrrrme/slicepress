/**
 * SlicePress OrbitControls
 * Minimal orbit camera controls for Three.js.
 * Ported from Pod21 viewer (originally based on Three.js OrbitControls).
 */

/* global THREE */

THREE.SlicePressOrbitControls = function (camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();

    this.enableDamping = false;
    this.dampingFactor = 0.05;
    this.enableZoom = true;
    this.zoomSpeed = 1.0;
    this.enableRotate = true;
    this.rotateSpeed = 1.0;
    this.enablePan = true;
    this.panSpeed = 1.0;
    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0;

    var scope = this;
    var STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2 };
    var state = STATE.NONE;

    var spherical = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();
    var scaleVal = 1;
    var panOffset = new THREE.Vector3();

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    function getZoomScale() {
        return Math.pow(0.95, scope.zoomSpeed);
    }

    function rotateLeft(angle) { sphericalDelta.theta -= angle; }
    function rotateUp(angle) { sphericalDelta.phi -= angle; }

    var panLeft = (function () {
        var v = new THREE.Vector3();
        return function (distance, objectMatrix) {
            v.setFromMatrixColumn(objectMatrix, 0);
            v.multiplyScalar(-distance);
            panOffset.add(v);
        };
    })();

    var panUp = (function () {
        var v = new THREE.Vector3();
        return function (distance, objectMatrix) {
            v.setFromMatrixColumn(objectMatrix, 1);
            v.multiplyScalar(distance);
            panOffset.add(v);
        };
    })();

    var pan = (function () {
        var offset = new THREE.Vector3();
        return function (deltaX, deltaY) {
            var element = scope.domElement;
            var position = scope.camera.position;
            offset.copy(position).sub(scope.target);
            var targetDistance = offset.length();
            targetDistance *= Math.tan((scope.camera.fov / 2) * Math.PI / 180.0);
            panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.camera.matrix);
            panUp(2 * deltaY * targetDistance / element.clientHeight, scope.camera.matrix);
        };
    })();

    function dollyIn(s) { scaleVal /= s; }
    function dollyOut(s) { scaleVal *= s; }

    function handleMouseDownRotate(e) { rotateStart.set(e.clientX, e.clientY); }
    function handleMouseDownDolly(e) { dollyStart.set(e.clientX, e.clientY); }
    function handleMouseDownPan(e) { panStart.set(e.clientX, e.clientY); }

    function handleMouseMoveRotate(e) {
        rotateEnd.set(e.clientX, e.clientY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        var el = scope.domElement;
        rotateLeft(2 * Math.PI * rotateDelta.x / el.clientHeight);
        rotateUp(2 * Math.PI * rotateDelta.y / el.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
    }

    function handleMouseMoveDolly(e) {
        dollyEnd.set(e.clientX, e.clientY);
        dollyDelta.subVectors(dollyEnd, dollyStart);
        if (dollyDelta.y > 0) dollyIn(getZoomScale());
        else if (dollyDelta.y < 0) dollyOut(getZoomScale());
        dollyStart.copy(dollyEnd);
        scope.update();
    }

    function handleMouseMovePan(e) {
        panEnd.set(e.clientX, e.clientY);
        panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);
        pan(panDelta.x, panDelta.y);
        panStart.copy(panEnd);
        scope.update();
    }

    function handleMouseWheel(e) {
        if (e.deltaY < 0) dollyOut(getZoomScale());
        else if (e.deltaY > 0) dollyIn(getZoomScale());
        scope.update();
    }

    function onMouseDown(e) {
        e.preventDefault();
        switch (e.button) {
            case 0: state = STATE.ROTATE; handleMouseDownRotate(e); break;
            case 1: state = STATE.DOLLY; handleMouseDownDolly(e); break;
            case 2: state = STATE.PAN; handleMouseDownPan(e); break;
        }
        if (state !== STATE.NONE) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    }

    function onMouseMove(e) {
        e.preventDefault();
        switch (state) {
            case STATE.ROTATE: handleMouseMoveRotate(e); break;
            case STATE.DOLLY: handleMouseMoveDolly(e); break;
            case STATE.PAN: handleMouseMovePan(e); break;
        }
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        state = STATE.NONE;
    }

    function onMouseWheel(e) { e.preventDefault(); handleMouseWheel(e); }
    function onContextMenu(e) { e.preventDefault(); }

    var touchStartDistance = 0;

    function onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            state = STATE.ROTATE;
            rotateStart.set(e.touches[0].pageX, e.touches[0].pageY);
        } else if (e.touches.length === 2) {
            state = STATE.DOLLY;
            var dx = e.touches[0].pageX - e.touches[1].pageX;
            var dy = e.touches[0].pageY - e.touches[1].pageY;
            touchStartDistance = Math.sqrt(dx * dx + dy * dy);
        }
    }

    function onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && state === STATE.ROTATE) {
            rotateEnd.set(e.touches[0].pageX, e.touches[0].pageY);
            rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
            var el = scope.domElement;
            rotateLeft(2 * Math.PI * rotateDelta.x / el.clientHeight);
            rotateUp(2 * Math.PI * rotateDelta.y / el.clientHeight);
            rotateStart.copy(rotateEnd);
        } else if (e.touches.length === 2 && state === STATE.DOLLY) {
            var dx = e.touches[0].pageX - e.touches[1].pageX;
            var dy = e.touches[0].pageY - e.touches[1].pageY;
            var distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > touchStartDistance) dollyOut(getZoomScale());
            else if (distance < touchStartDistance) dollyIn(getZoomScale());
            touchStartDistance = distance;
        }
        scope.update();
    }

    function onTouchEnd() { state = STATE.NONE; }

    this.domElement.addEventListener('contextmenu', onContextMenu);
    this.domElement.addEventListener('mousedown', onMouseDown);
    this.domElement.addEventListener('wheel', onMouseWheel, { passive: false });
    this.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', onTouchEnd);

    this.update = (function () {
        var offset = new THREE.Vector3();
        var quat = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
        var quatInverse = quat.clone().invert();
        var lastPosition = new THREE.Vector3();

        return function () {
            var position = scope.camera.position;
            offset.copy(position).sub(scope.target);
            offset.applyQuaternion(quat);
            spherical.setFromVector3(offset);

            if (scope.autoRotate && state === STATE.NONE) {
                rotateLeft(2 * Math.PI / 60 / 60 * scope.autoRotateSpeed);
            }

            spherical.theta += sphericalDelta.theta;
            spherical.phi += sphericalDelta.phi;
            spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
            spherical.makeSafe();
            spherical.radius *= scaleVal;
            spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));
            scope.target.add(panOffset);

            offset.setFromSpherical(spherical);
            offset.applyQuaternion(quatInverse);
            position.copy(scope.target).add(offset);
            scope.camera.lookAt(scope.target);

            if (scope.enableDamping) {
                sphericalDelta.theta *= (1 - scope.dampingFactor);
                sphericalDelta.phi *= (1 - scope.dampingFactor);
            } else {
                sphericalDelta.set(0, 0, 0);
            }

            scaleVal = 1;
            panOffset.set(0, 0, 0);
            lastPosition.copy(position);
            return false;
        };
    })();

    this.update();
};
