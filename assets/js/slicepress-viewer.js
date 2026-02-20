/**
 * SlicePress ModelViewer
 * Three.js 3D model viewer with STL/3MF parsing.
 * Ported from Pod21 viewer — all Pod21 branding removed.
 */

/* global THREE, JSZip, SlicePress_Orient */

var SlicePress_ModelViewer = (function () {
    'use strict';

    function ModelViewer(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.model = null;
        this.originalDimensions = null;
        this.currentFile = null;
        this.orientedBlob = null;
        this.orientedFileName = null;

        this._init();
        this._animate();
        this._setupDragDrop();
        this._setupFileInput();
    }

    var proto = ModelViewer.prototype;

    proto._init = function () {
        var w = this.container.clientWidth;
        var h = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe8e8e8);

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
        this.camera.position.set(100, 100, 100);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.SlicePressOrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 1000;

        var ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        var mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(100, 200, 100);
        mainLight.castShadow = true;
        this.scene.add(mainLight);

        var fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-100, 50, -100);
        this.scene.add(fillLight);

        var grid = new THREE.GridHelper(200, 20, 0xcccccc, 0xd5d5d5);
        this.scene.add(grid);

        var self = this;
        window.addEventListener('resize', function () { self._onResize(); });
    };

    proto._setupDragDrop = function () {
        var container = this.container;
        var overlay = document.getElementById('slicepress-drop-overlay');
        var self = this;

        container.addEventListener('dragover', function (e) {
            e.preventDefault();
            overlay.classList.add('active');
        });
        container.addEventListener('dragleave', function (e) {
            e.preventDefault();
            overlay.classList.remove('active');
        });
        container.addEventListener('drop', function (e) {
            e.preventDefault();
            overlay.classList.remove('active');
            var file = e.dataTransfer.files[0];
            if (file) self.loadFile(file);
        });
    };

    proto._setupFileInput = function () {
        var input = document.getElementById('slicepress-file-input');
        var self = this;
        input.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (file) self.loadFile(file);
        });
    };

    proto._showLoading = function (show) {
        var overlay = document.getElementById('slicepress-loading-overlay');
        if (show) overlay.classList.add('active');
        else overlay.classList.remove('active');
    };

    proto.showError = function (message) {
        var el = document.getElementById('slicepress-error');
        el.textContent = message;
        el.classList.add('visible');
        var timeout = setTimeout(function () { el.classList.remove('visible'); }, 5000);
        var dismiss = function () {
            clearTimeout(timeout);
            el.classList.remove('visible');
            document.removeEventListener('click', dismiss);
        };
        setTimeout(function () { document.addEventListener('click', dismiss); }, 100);
    };

    proto.loadFile = function (file) {
        var maxMB = (typeof slicepress_config !== 'undefined') ? slicepress_config.max_file_size_mb : 21;
        var maxBytes = maxMB * 1024 * 1024;
        var sizeMB = (file.size / (1024 * 1024)).toFixed(1);

        if (file.size > maxBytes) {
            this.showError('File too large (' + sizeMB + 'MB). Maximum: ' + maxMB + 'MB');
            document.getElementById('slicepress-file-input').value = '';
            return;
        }

        var ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'stl' && ext !== '3mf') {
            this.showError('Unsupported format. Please use STL or 3MF.');
            document.getElementById('slicepress-file-input').value = '';
            return;
        }

        this._showLoading(true);
        var hint = document.getElementById('slicepress-hint');
        if (hint) hint.classList.add('hidden');

        this.currentFile = file;
        this.orientedBlob = null;
        this.orientedFileName = null;

        var orientBtn = document.getElementById('slicepress-orient-btn');
        if (orientBtn) orientBtn.textContent = 'Smart Orient';

        var self = this;
        var promise;

        if (ext === 'stl') {
            promise = this._loadSTL(file);
        } else {
            promise = this._load3MF(file);
        }

        promise.then(function () {
            var sliceBtn = document.getElementById('slicepress-slice-btn');
            if (sliceBtn) sliceBtn.disabled = false;
            if (self.model && orientBtn) orientBtn.disabled = false;

            // Hide results if re-uploading
            var results = document.getElementById('slicepress-results-card');
            if (results) results.style.display = 'none';
        }).catch(function (err) {
            self.showError('Failed to load: ' + err.message);
        }).finally(function () {
            self._showLoading(false);
        });
    };

    proto._clearModel = function () {
        if (this.model) {
            this.scene.remove(this.model);
            this.model.geometry.dispose();
            this.model.material.dispose();
            this.model = null;
        }
        var ids = ['slicepress-stat-x', 'slicepress-stat-y', 'slicepress-stat-z', 'slicepress-stat-tris'];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
    };

    // --- STL Parsing ---

    proto._loadSTL = function (file) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var geometry = self._parseSTL(e.target.result);
                    geometry.rotateX(-Math.PI / 2);
                    self._displayModel(geometry);
                    resolve();
                } catch (err) { reject(err); }
            };
            reader.onerror = function () { reject(new Error('Failed to read file')); };
            reader.readAsArrayBuffer(file);
        });
    };

    proto._parseSTL = function (buffer) {
        var view = new DataView(buffer);
        var nFaces = view.getUint32(80, true);
        var expectedSize = 84 + nFaces * 50;
        var isBinary = Math.abs(expectedSize - buffer.byteLength) < 10;
        return isBinary ? this._parseSTLBinary(view) : this._parseSTLAscii(buffer);
    };

    proto._parseSTLBinary = function (view) {
        var faces = view.getUint32(80, true);
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array(faces * 9);
        var normals = new Float32Array(faces * 9);
        var offset = 84;

        for (var i = 0; i < faces; i++) {
            var nx = view.getFloat32(offset, true);
            var ny = view.getFloat32(offset + 4, true);
            var nz = view.getFloat32(offset + 8, true);
            offset += 12;
            for (var j = 0; j < 3; j++) {
                var idx = i * 9 + j * 3;
                vertices[idx] = view.getFloat32(offset, true);
                vertices[idx + 1] = view.getFloat32(offset + 4, true);
                vertices[idx + 2] = view.getFloat32(offset + 8, true);
                normals[idx] = nx;
                normals[idx + 1] = ny;
                normals[idx + 2] = nz;
                offset += 12;
            }
            offset += 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        return geometry;
    };

    proto._parseSTLAscii = function (buffer) {
        var text = new TextDecoder().decode(buffer);
        var geometry = new THREE.BufferGeometry();
        var vertices = [];
        var normals = [];
        var pattern = /facet\s+normal\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+outer\s+loop\s+vertex\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+vertex\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+vertex\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+endloop\s+endfacet/gi;
        var match;
        while ((match = pattern.exec(text)) !== null) {
            var nx = parseFloat(match[1]), ny = parseFloat(match[2]), nz = parseFloat(match[3]);
            for (var i = 0; i < 3; i++) {
                vertices.push(parseFloat(match[4+i*3]), parseFloat(match[5+i*3]), parseFloat(match[6+i*3]));
                normals.push(nx, ny, nz);
            }
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        return geometry;
    };

    // --- 3MF Parsing ---

    proto._load3MF = function (file) {
        var self = this;
        return file.arrayBuffer().then(function (buffer) {
            return JSZip.loadAsync(buffer);
        }).then(function (zip) {
            var modelPromises = [];
            Object.keys(zip.files).forEach(function (name) {
                if (name.toLowerCase().endsWith('.model') && !zip.files[name].dir) {
                    modelPromises.push(zip.files[name].async('string'));
                }
            });
            if (modelPromises.length === 0) throw new Error('No .model files found in 3MF');
            return Promise.all(modelPromises);
        }).then(function (xmlStrings) {
            var allArrays = [];
            var totalLen = 0;
            xmlStrings.forEach(function (xml) {
                var data = self._parse3MFModel(xml);
                if (data.length > 0) { allArrays.push(data); totalLen += data.length; }
            });
            if (totalLen === 0) throw new Error('No geometry found in 3MF');

            var allVertices;
            if (allArrays.length === 1) {
                allVertices = allArrays[0];
            } else {
                allVertices = new Float32Array(totalLen);
                var off = 0;
                allArrays.forEach(function (arr) { allVertices.set(arr, off); off += arr.length; });
            }

            var geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(allVertices, 3));
            geometry.computeVertexNormals();
            geometry.rotateX(Math.PI / 2);
            geometry.rotateY(Math.PI / 2);
            self._displayModel(geometry);
        });
    };

    proto._parse3MFModel = function (xml) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) return new Float32Array(0);

        var meshArrays = [];
        var namespaces = [
            'http://schemas.microsoft.com/3dmanufacturing/core/2015/02',
            'http://schemas.microsoft.com/3dmanufacturing/2013/01',
            null
        ];

        var meshes = [];
        for (var ni = 0; ni < namespaces.length; ni++) {
            var ns = namespaces[ni];
            meshes = ns ? doc.getElementsByTagNameNS(ns, 'mesh') : doc.getElementsByTagName('mesh');
            if (meshes.length > 0) break;
        }
        if (meshes.length === 0) {
            var all = doc.getElementsByTagName('*');
            meshes = [];
            for (var i = 0; i < all.length; i++) {
                if (all[i].localName === 'mesh') meshes.push(all[i]);
            }
        }

        for (var mi = 0; mi < meshes.length; mi++) {
            var mesh = meshes[mi];
            var verticesEl = null, trianglesEl = null;
            for (var ci = 0; ci < mesh.children.length; ci++) {
                if (mesh.children[ci].localName === 'vertices') verticesEl = mesh.children[ci];
                if (mesh.children[ci].localName === 'triangles') trianglesEl = mesh.children[ci];
            }
            if (!verticesEl || !trianglesEl) continue;

            var vertexList = [];
            for (var vi = 0; vi < verticesEl.children.length; vi++) {
                var v = verticesEl.children[vi];
                if (v.localName === 'vertex') {
                    vertexList.push(
                        parseFloat(v.getAttribute('x')) || 0,
                        parseFloat(v.getAttribute('y')) || 0,
                        parseFloat(v.getAttribute('z')) || 0
                    );
                }
            }

            var triEls = [];
            for (var ti = 0; ti < trianglesEl.children.length; ti++) {
                if (trianglesEl.children[ti].localName === 'triangle') triEls.push(trianglesEl.children[ti]);
            }

            var meshVerts = new Float32Array(triEls.length * 9);
            var idx = 0;
            for (var ti = 0; ti < triEls.length; ti++) {
                var t = triEls[ti];
                var v1 = parseInt(t.getAttribute('v1')) * 3;
                var v2 = parseInt(t.getAttribute('v2')) * 3;
                var v3 = parseInt(t.getAttribute('v3')) * 3;
                meshVerts[idx++] = vertexList[v1];
                meshVerts[idx++] = vertexList[v1+1];
                meshVerts[idx++] = vertexList[v1+2];
                meshVerts[idx++] = vertexList[v2];
                meshVerts[idx++] = vertexList[v2+1];
                meshVerts[idx++] = vertexList[v2+2];
                meshVerts[idx++] = vertexList[v3];
                meshVerts[idx++] = vertexList[v3+1];
                meshVerts[idx++] = vertexList[v3+2];
            }
            meshArrays.push(meshVerts);
        }

        if (meshArrays.length === 0) return new Float32Array(0);
        if (meshArrays.length === 1) return meshArrays[0];
        var total = meshArrays.reduce(function (s, a) { return s + a.length; }, 0);
        var combined = new Float32Array(total);
        var off = 0;
        meshArrays.forEach(function (a) { combined.set(a, off); off += a.length; });
        return combined;
    };

    // --- Display ---

    proto._displayModel = function (geometry) {
        if (this.model) {
            this.scene.remove(this.model);
            this.model.geometry.dispose();
            this.model.material.dispose();
        }

        if (!geometry.attributes.normal) geometry.computeVertexNormals();

        geometry.computeBoundingBox();
        var box = geometry.boundingBox;
        var center = new THREE.Vector3();
        box.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        geometry.computeBoundingBox();
        var size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        this.originalDimensions = { x: size.x, y: size.y, z: size.z };

        var material = new THREE.MeshPhongMaterial({
            color: 0x6699bb,
            specular: 0x333333,
            shininess: 40,
            flatShading: false
        });

        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        this.model.receiveShadow = true;
        this.model.position.y = size.y / 2;

        this.scene.add(this.model);
        this._fitCamera(size);
        this._updateStats(geometry);
    };

    proto._fitCamera = function (size) {
        var maxDim = Math.max(size.x, size.y, size.z);
        var fov = this.camera.fov * (Math.PI / 180);
        var dist = (maxDim / 2) / Math.tan(fov / 2) * 2.5;
        var angle = Math.PI / 4;

        this.camera.position.set(
            dist * Math.sin(angle),
            dist * 0.7,
            dist * Math.cos(angle)
        );
        this.controls.target.set(0, size.y / 2, 0);
        this.controls.update();
    };

    proto._updateStats = function (geometry) {
        var dim = this.originalDimensions;
        var el;
        el = document.getElementById('slicepress-stat-x'); if (el) el.textContent = dim.x.toFixed(1) + ' mm';
        el = document.getElementById('slicepress-stat-y'); if (el) el.textContent = dim.y.toFixed(1) + ' mm';
        el = document.getElementById('slicepress-stat-z'); if (el) el.textContent = dim.z.toFixed(1) + ' mm';
        el = document.getElementById('slicepress-stat-tris');
        if (el) el.textContent = (geometry.attributes.position.count / 3).toLocaleString();
    };

    // --- View controls ---

    proto.setWireframe = function (enabled) {
        if (this.model) this.model.material.wireframe = enabled;
    };

    proto.setAutoRotate = function (enabled) {
        this.controls.autoRotate = enabled;
    };

    proto.resetView = function () {
        if (!this.model || !this.originalDimensions) return;
        var size = this.originalDimensions;
        var maxDim = Math.max(size.x, size.y, size.z);
        var fov = this.camera.fov * (Math.PI / 180);
        var dist = (maxDim / 2) / Math.tan(fov / 2) * 2.5;
        var angle = Math.PI / 4;
        this.camera.position.set(dist * Math.sin(angle), dist * 0.7, dist * Math.cos(angle));
        this.controls.target.set(0, size.y / 2, 0);
        this.camera.lookAt(this.controls.target);
        this.controls.update();
    };

    proto.viewFromTop = function () { this._animateCamera(0, 200, 0.1); };
    proto.viewFromFront = function () { this._animateCamera(0, 50, 200); };
    proto.viewFromSide = function () { this._animateCamera(200, 50, 0); };
    proto.viewIsometric = function () { this._animateCamera(150, 150, 150); };

    proto._animateCamera = function (x, y, z) {
        var start = this.camera.position.clone();
        var end = new THREE.Vector3(x, y, z);
        var startTime = performance.now();
        var duration = 400;
        var self = this;

        function tick() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - t, 3);
            self.camera.position.lerpVectors(start, end, eased);
            self.camera.lookAt(self.controls.target);
            if (t < 1) requestAnimationFrame(tick);
        }
        tick();
    };

    // --- Smart Orient ---

    proto.autoOrient = function () {
        if (!this.model || !this.model.geometry) {
            this.showError('No model loaded');
            return;
        }

        var btn = document.getElementById('slicepress-orient-btn');
        btn.classList.add('analyzing');
        btn.disabled = true;
        btn.textContent = 'Analyzing...';

        var geometry = this.model.geometry;
        var posAttr = geometry.attributes.position;
        var positions = posAttr.array;
        var triCount = posAttr.count / 3;
        var self = this;

        requestAnimationFrame(function () {
            setTimeout(function () {
                try {
                    var result = SlicePress_Orient.findBestOrientation(positions, triCount);
                    var dir = result.direction;

                    if (Math.abs(dir[1] - 1) < 0.01 && Math.abs(dir[0]) < 0.01 && Math.abs(dir[2]) < 0.01) {
                        btn.classList.remove('analyzing');
                        btn.disabled = false;
                        btn.textContent = 'Already optimal';
                        setTimeout(function () { btn.textContent = 'Smart Orient'; }, 2000);
                        return;
                    }

                    self._animateOrientation(dir, function () {
                        btn.classList.remove('analyzing');
                        btn.disabled = false;
                        btn.textContent = 'Oriented!';
                        setTimeout(function () { btn.textContent = 'Smart Orient'; }, 2000);
                    });
                } catch (err) {
                    btn.classList.remove('analyzing');
                    btn.disabled = false;
                    btn.textContent = 'Failed';
                    setTimeout(function () { btn.textContent = 'Smart Orient'; }, 2000);
                }
            }, 30);
        });
    };

    proto._animateOrientation = function (direction, onComplete) {
        var dir = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize();
        var targetUp = new THREE.Vector3(0, 1, 0);
        var quat = new THREE.Quaternion().setFromUnitVectors(dir, targetUp);

        var startQuat = this.model.quaternion.clone();
        var endQuat = startQuat.clone().premultiply(quat);

        var duration = 800;
        var startTime = performance.now();
        var self = this;

        function tick() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - t, 3);
            self.model.quaternion.copy(startQuat).slerp(endQuat, eased);
            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                self._bakeRotation(endQuat);
                if (onComplete) onComplete();
            }
        }
        tick();
    };

    proto._bakeRotation = function (quaternion) {
        var geometry = this.model.geometry;
        var matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
        geometry.applyMatrix4(matrix);

        this.model.quaternion.identity();
        this.model.position.set(0, 0, 0);

        geometry.computeBoundingBox();
        var box = geometry.boundingBox;
        var center = new THREE.Vector3();
        box.getCenter(center);
        geometry.translate(-center.x, -box.min.y, -center.z);
        geometry.computeBoundingBox();

        var size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        this.originalDimensions = { x: size.x, y: size.y, z: size.z };

        this.model.position.y = 0;
        this._updateStats(geometry);
        this._fitCamera(size);

        this.orientedBlob = this._geometryToSTLBlob(geometry);
        var baseName = this.currentFile ? this.currentFile.name.replace(/\.[^.]+$/, '') : 'model';
        this.orientedFileName = baseName + '_oriented.stl';
    };

    proto._geometryToSTLBlob = function (geometry) {
        var posAttr = geometry.attributes.position;
        var normAttr = geometry.attributes.normal;
        var triCount = posAttr.count / 3;
        var bufferSize = 84 + triCount * 50;
        var buffer = new ArrayBuffer(bufferSize);
        var view = new DataView(buffer);

        var header = 'binary STL by SlicePress';
        for (var i = 0; i < Math.min(header.length, 80); i++) {
            view.setUint8(i, header.charCodeAt(i));
        }
        view.setUint32(80, triCount, true);

        var offset = 84;
        for (var i = 0; i < triCount; i++) {
            var vi = i * 3;
            if (normAttr) {
                view.setFloat32(offset, normAttr.getX(vi), true);
                view.setFloat32(offset + 4, normAttr.getY(vi), true);
                view.setFloat32(offset + 8, normAttr.getZ(vi), true);
            }
            offset += 12;
            for (var j = 0; j < 3; j++) {
                var idx = vi + j;
                view.setFloat32(offset, posAttr.getX(idx), true);
                view.setFloat32(offset + 4, posAttr.getY(idx), true);
                view.setFloat32(offset + 8, posAttr.getZ(idx), true);
                offset += 12;
            }
            view.setUint16(offset, 0, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'application/octet-stream' });
    };

    // --- Resize & Animate ---

    proto._onResize = function () {
        var w = this.container.clientWidth;
        var h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    };

    proto._animate = function () {
        var self = this;
        function loop() {
            requestAnimationFrame(loop);
            self.controls.update();
            self.renderer.render(self.scene, self.camera);
        }
        loop();
    };

    // --- Public accessors for slicer/cart JS ---

    proto.getFile = function () {
        if (this.orientedBlob) {
            return { blob: this.orientedBlob, name: this.orientedFileName };
        }
        return this.currentFile ? { blob: this.currentFile, name: this.currentFile.name } : null;
    };

    proto.getDimensions = function () {
        if (!this.originalDimensions) return null;
        var d = this.originalDimensions;
        return d.x.toFixed(1) + ' x ' + d.y.toFixed(1) + ' x ' + d.z.toFixed(1) + ' mm';
    };

    return ModelViewer;
})();

// Global instance — initialized when DOM ready
var slicepressViewer;
document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('slicepress-viewer');
    if (el) {
        slicepressViewer = new SlicePress_ModelViewer('slicepress-viewer');
    }
});
