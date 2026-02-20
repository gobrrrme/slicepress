/**
 * SlicePress Smart Orient
 * Auto-orientation algorithm for 3D printing.
 * Scoring based on OrcaSlicer Orient.cpp (AGPL-3.0).
 */

/* exported SlicePress_Orient */

var SlicePress_Orient = (function () {
    'use strict';

    function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
    function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
    function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
    function scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
    function vlen(a) { return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); }
    function normalize(a) { var l=vlen(a); return l<1e-12?[0,0,0]:[a[0]/l,a[1]/l,a[2]/l]; }

    function computeFaceData(positions, triCount) {
        var faces = [];
        for (var i = 0; i < triCount; i++) {
            var o = i * 9;
            var a = [positions[o], positions[o+1], positions[o+2]];
            var b = [positions[o+3], positions[o+4], positions[o+5]];
            var c = [positions[o+6], positions[o+7], positions[o+8]];
            var cr = cross(sub(b,a), sub(c,a));
            var area = 0.5 * vlen(cr);
            var n = normalize(cr);
            if (area > 1e-10) faces.push({ normal: n, area: area, verts: [a, b, c] });
        }
        return faces;
    }

    function clusterNormals(faces, topN) {
        var buckets = {};
        var RES = 50;
        for (var i = 0; i < faces.length; i++) {
            var n = faces[i].normal;
            var kx = Math.round(n[0] * RES);
            var ky = Math.round(n[1] * RES);
            var kz = Math.round(n[2] * RES);
            var key = kx + ',' + ky + ',' + kz;
            if (!buckets[key]) buckets[key] = { nx: 0, ny: 0, nz: 0, area: 0 };
            var b = buckets[key];
            b.nx += n[0] * faces[i].area;
            b.ny += n[1] * faces[i].area;
            b.nz += n[2] * faces[i].area;
            b.area += faces[i].area;
        }
        var clusters = [];
        for (var k in buckets) {
            var b = buckets[k];
            var dir = normalize([b.nx, b.ny, b.nz]);
            if (vlen(dir) > 0.5) clusters.push({ dir: dir, area: b.area });
        }
        clusters.sort(function (a, b) { return b.area - a.area; });
        return clusters.slice(0, topN).map(function (c) { return c.dir; });
    }

    function quickHull3D(points) {
        if (points.length < 4) return null;
        var minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;
        for (var i = 1; i < points.length; i++) {
            if (points[i][0] < points[minX][0]) minX = i;
            if (points[i][0] > points[maxX][0]) maxX = i;
            if (points[i][1] < points[minY][1]) minY = i;
            if (points[i][1] > points[maxY][1]) maxY = i;
            if (points[i][2] < points[minZ][2]) minZ = i;
            if (points[i][2] > points[maxZ][2]) maxZ = i;
        }
        var extremes = [minX, maxX, minY, maxY, minZ, maxZ];
        var bestDist = 0, bestA = 0, bestB = 1;
        for (var i = 0; i < extremes.length; i++) {
            for (var j = i+1; j < extremes.length; j++) {
                var d = vlen(sub(points[extremes[i]], points[extremes[j]]));
                if (d > bestDist) { bestDist = d; bestA = extremes[i]; bestB = extremes[j]; }
            }
        }
        if (bestDist < 1e-10) return null;
        var lineDir = normalize(sub(points[bestB], points[bestA]));
        var maxLineDist = 0, bestC = -1;
        for (var i = 0; i < points.length; i++) {
            var v = sub(points[i], points[bestA]);
            var proj = scale(lineDir, dot(v, lineDir));
            var perp = sub(v, proj);
            var d = vlen(perp);
            if (d > maxLineDist) { maxLineDist = d; bestC = i; }
        }
        if (bestC < 0 || maxLineDist < 1e-10) return null;
        var planeN = normalize(cross(sub(points[bestB], points[bestA]), sub(points[bestC], points[bestA])));
        var maxPlaneDist = 0, bestD = -1;
        for (var i = 0; i < points.length; i++) {
            var d = Math.abs(dot(sub(points[i], points[bestA]), planeN));
            if (d > maxPlaneDist) { maxPlaneDist = d; bestD = i; }
        }
        if (bestD < 0 || maxPlaneDist < 1e-10) return null;
        var tetra = [bestA, bestB, bestC, bestD];
        var p = [points[bestA], points[bestB], points[bestC], points[bestD]];
        if (dot(sub(p[3], p[0]), cross(sub(p[1], p[0]), sub(p[2], p[0]))) > 0) {
            var tmp = tetra[1]; tetra[1] = tetra[2]; tetra[2] = tmp;
        }
        var faces = [
            [tetra[0], tetra[1], tetra[2]],
            [tetra[0], tetra[3], tetra[1]],
            [tetra[1], tetra[3], tetra[2]],
            [tetra[0], tetra[2], tetra[3]]
        ];
        var assigned = new Uint8Array(points.length);
        assigned[tetra[0]] = 1; assigned[tetra[1]] = 1; assigned[tetra[2]] = 1; assigned[tetra[3]] = 1;
        function faceNormal(f) {
            return normalize(cross(sub(points[f[1]], points[f[0]]), sub(points[f[2]], points[f[0]])));
        }
        for (var iter = 0; iter < 200; iter++) {
            var changed = false;
            for (var fi = faces.length - 1; fi >= 0; fi--) {
                var fn = faceNormal(faces[fi]);
                var fp = points[faces[fi][0]];
                var farthest = -1, farthestDist = 1e-8;
                for (var i = 0; i < points.length; i++) {
                    if (assigned[i]) continue;
                    var d = dot(sub(points[i], fp), fn);
                    if (d > farthestDist) { farthestDist = d; farthest = i; }
                }
                if (farthest < 0) continue;
                changed = true;
                assigned[farthest] = 1;
                var visible = [];
                for (var fj = 0; fj < faces.length; fj++) {
                    var n2 = faceNormal(faces[fj]);
                    if (dot(sub(points[farthest], points[faces[fj][0]]), n2) > 1e-10) {
                        visible.push(fj);
                    }
                }
                if (visible.length === 0) continue;
                var horizon = [];
                for (var vi = 0; vi < visible.length; vi++) {
                    var f = faces[visible[vi]];
                    for (var ei = 0; ei < 3; ei++) {
                        var ea = f[ei], eb = f[(ei+1)%3];
                        var shared = false;
                        for (var vj = 0; vj < visible.length; vj++) {
                            if (vi === vj) continue;
                            var g = faces[visible[vj]];
                            if ((g[0]===eb&&g[1]===ea)||(g[1]===eb&&g[2]===ea)||(g[2]===eb&&g[0]===ea)) { shared = true; break; }
                        }
                        if (!shared) horizon.push([ea, eb]);
                    }
                }
                visible.sort(function (a, b) { return b - a; });
                for (var vi = 0; vi < visible.length; vi++) faces.splice(visible[vi], 1);
                for (var hi = 0; hi < horizon.length; hi++) {
                    faces.push([horizon[hi][0], horizon[hi][1], farthest]);
                }
                break;
            }
            if (!changed) break;
        }
        return { faces: faces, points: points };
    }

    function convexHull2DArea(pts2d) {
        if (pts2d.length < 3) return 0;
        pts2d.sort(function (a, b) { return a[0]-b[0] || a[1]-b[1]; });
        var n = pts2d.length;
        var hull = [];
        for (var i = 0; i < n; i++) {
            while (hull.length >= 2) {
                var a = hull[hull.length-2], b = hull[hull.length-1], c = pts2d[i];
                if ((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) <= 0) hull.pop();
                else break;
            }
            hull.push(pts2d[i]);
        }
        var lower = hull.length;
        for (var i = n-2; i >= 0; i--) {
            while (hull.length > lower) {
                var a = hull[hull.length-2], b = hull[hull.length-1], c = pts2d[i];
                if ((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) <= 0) hull.pop();
                else break;
            }
            hull.push(pts2d[i]);
        }
        hull.pop();
        if (hull.length < 3) return 0;
        var area = 0;
        for (var i = 1; i < hull.length - 1; i++) {
            area += (hull[i][0]-hull[0][0])*(hull[i+1][1]-hull[0][1]) - (hull[i+1][0]-hull[0][0])*(hull[i][1]-hull[0][1]);
        }
        return Math.abs(area) * 0.5;
    }

    function generateCandidates(meshFaces, hullData) {
        var candidates = [];
        var meshDirs = clusterNormals(meshFaces, 10);
        for (var i = 0; i < meshDirs.length; i++) candidates.push(meshDirs[i]);
        if (hullData && hullData.faces) {
            var hullFaces = [];
            for (var i = 0; i < hullData.faces.length; i++) {
                var f = hullData.faces[i];
                var a = hullData.points[f[0]], b = hullData.points[f[1]], c = hullData.points[f[2]];
                var cr = cross(sub(b,a), sub(c,a));
                var area = 0.5 * vlen(cr);
                var n = normalize(cr);
                if (area > 1e-10) hullFaces.push({ normal: n, area: area, verts: [a,b,c] });
            }
            var hullDirs = clusterNormals(hullFaces, 14);
            for (var i = 0; i < hullDirs.length; i++) candidates.push(hullDirs[i]);
        }
        var s = Math.SQRT1_2;
        var supplements = [
            [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
            [s,s,0],[-s,s,0],[s,-s,0],[-s,-s,0],
            [s,0,s],[-s,0,s],[s,0,-s],[-s,0,-s],
            [0,s,s],[0,-s,s],[0,s,-s],[0,-s,-s]
        ];
        for (var i = 0; i < supplements.length; i++) candidates.push(supplements[i]);
        var deduped = [candidates[0]];
        var cosThresh = Math.cos(5 * Math.PI / 180);
        for (var i = 1; i < candidates.length; i++) {
            var dominated = false;
            for (var j = 0; j < deduped.length; j++) {
                if (dot(candidates[i], deduped[j]) > cosThresh) { dominated = true; break; }
            }
            if (!dominated) deduped.push(candidates[i]);
        }
        return deduped;
    }

    // Scoring matches OrcaSlicer Orient.cpp (default OrientParams)
    // Candidate dir = "up" direction; minProj = bed level
    function scoreCandidate(dir, faces) {
        var up = dir;
        var FIRST_LAY_H = 0.2;
        var ASCENT = -0.5;
        var RELATIVE_F = 6.6106;
        var CONTOUR_F = 0.2323;
        var BOTTOM_F = 1.1672;
        var BOTTOM_HULL_F = 0.1;
        var TAR_C = 0.2431;
        var TAR_D = 0.6285;

        var minZ = Infinity, maxZ = -Infinity;
        for (var i = 0; i < faces.length; i++) {
            var v = faces[i].verts;
            for (var j = 0; j < 3; j++) {
                var z = dot(v[j], up);
                if (z < minZ) minZ = z;
                if (z > maxZ) maxZ = z;
            }
        }
        var totalHeight = maxZ - minZ;
        if (totalHeight < 1e-6) return 1000;

        var bottom = 0, overhang = 0;
        var bottomPts2D = [];
        var ax = Math.abs(up[0]), ay = Math.abs(up[1]), az = Math.abs(up[2]);
        var up2 = (ax <= ay && ax <= az) ? [1,0,0] : (ay <= az ? [0,1,0] : [0,0,1]);
        var right = normalize(cross(up, up2));
        var fwd = normalize(cross(right, up));

        for (var i = 0; i < faces.length; i++) {
            var f = faces[i];
            var v = f.verts;
            var z0 = dot(v[0], up), z1 = dot(v[1], up), z2 = dot(v[2], up);
            var faceZMax = Math.max(z0, z1, z2);

            var inFullLayer = faceZMax < minZ + FIRST_LAY_H;
            var inHalfLayer = faceZMax < minZ + FIRST_LAY_H * 0.5;
            if (inFullLayer) {
                bottom += f.area * 0.5;
                if (inHalfLayer) bottom += f.area;
                if (z0 < minZ + FIRST_LAY_H) bottomPts2D.push([dot(v[0], right), dot(v[0], fwd)]);
                if (z1 < minZ + FIRST_LAY_H) bottomPts2D.push([dot(v[1], right), dot(v[1], fwd)]);
                if (z2 < minZ + FIRST_LAY_H) bottomPts2D.push([dot(v[2], right), dot(v[2], fwd)]);
            }

            if (!inHalfLayer) {
                var nDotUp = dot(f.normal, up);
                if (nDotUp < ASCENT) {
                    overhang += f.area;
                }
            }
        }

        var contour = 4.0 * Math.sqrt(bottom);
        var bottom_hull = convexHull2DArea(bottomPts2D);

        var cost = RELATIVE_F * (overhang * TAR_C + TAR_D)
                 / (TAR_D + CONTOUR_F * contour + BOTTOM_F * bottom + BOTTOM_HULL_F * bottom_hull);

        if (bottom < 0.1) cost += 100;
        return cost;
    }

    function findBestOrientation(positions, triCount) {
        var t0 = performance.now();
        var faces = computeFaceData(positions, triCount);
        var uniqueVerts = [];
        var seen = {};
        for (var i = 0; i < triCount; i++) {
            var o = i * 9;
            for (var j = 0; j < 3; j++) {
                var x = positions[o+j*3], y = positions[o+j*3+1], z = positions[o+j*3+2];
                var key = (x*1000|0) + ',' + (y*1000|0) + ',' + (z*1000|0);
                if (!seen[key]) { seen[key] = 1; uniqueVerts.push([x, y, z]); }
            }
        }
        var hullData = null;
        try {
            if (uniqueVerts.length >= 4) hullData = quickHull3D(uniqueVerts);
        } catch (ex) { /* degenerate geometry */ }
        var candidates = generateCandidates(faces, hullData);
        var bestCost = Infinity;
        var bestDir = [0, 1, 0];
        for (var i = 0; i < candidates.length; i++) {
            var cost = scoreCandidate(candidates[i], faces);
            if (cost < bestCost - 1e-6) {
                bestCost = cost;
                bestDir = candidates[i];
            }
        }
        return {
            direction: bestDir,
            cost: bestCost,
            candidateCount: candidates.length,
            timeMs: Math.round(performance.now() - t0)
        };
    }

    return { findBestOrientation: findBestOrientation };
})();
