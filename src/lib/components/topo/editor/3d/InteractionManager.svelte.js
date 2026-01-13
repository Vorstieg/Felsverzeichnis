import { userState } from '$lib/state/editor.svelte.js';
import * as THREE from 'three';
import { Vector3, Raycaster } from 'three';

export class Topo3DInteractionManager {
    // State
    currentClickData = $state([]);
    currentLineSegments = $state([]);
    firstPointVisual = $state(null);
    previewLineSegment = $state(null);
    lastPreviewUpdate = 0;

    localDrawingState = $state(null);
    lastSnappedRouteId = $state(null);
    lastSnappedVertexIndex = $state(-1);
    hoverSnappedRouteId = $state(null);
    updateTick = $state(0);

    // Dependencies settable via setter
    gltfScene = $state(null);
    camera = $state(null);
    modelPosition = $state([0, 0, 0]); // Props.position

    // External Data needed for snapping
    visualRoutes = $state([]);
    visualFixPoints = $state([]);

    projectionRaycaster = new Raycaster();
    STEP_SIZE = 0.2;
    OFFSET_DISTANCE = 0.05;
    SNAP_THRESHOLD = 0.15;

    constructor() { }

    getSnappedVertex(point) {
        let finalPoint = point.clone();
        let bestDist = this.SNAP_THRESHOLD;
        let found = null; // { point, routeId, index }

        this.visualFixPoints.forEach(fp => {
            const fpPos = new Vector3(...fp.renderPosition);
            const dist = point.distanceTo(fpPos);
            if (dist < bestDist) {
                bestDist = dist;
                finalPoint.copy(fpPos);
                found = { point: finalPoint.clone(), type: 'fixpoint', id: fp.id };
            }
        });

        this.visualRoutes.forEach(vr => {
            vr.points.forEach((p, idx) => {
                const dist = point.distanceTo(p);
                if (dist < bestDist) {
                    bestDist = dist;
                    finalPoint.copy(p);
                    found = { point: finalPoint.clone(), routeId: vr.parentId, index: idx };
                }
            });
        });

        return found || { point: point.clone() };
    }

    handleMeshPointerMove(event, activeTool) {
        if ((activeTool !== 'route' && activeTool !== 'multipitch') || this.currentClickData.length === 0) {
            if (this.previewLineSegment) this.previewLineSegment = null;
            this.hoverSnappedRouteId = null;
            return;
        }
        const now = Date.now();
        if (now - this.lastPreviewUpdate < 30) return;
        this.lastPreviewUpdate = now;
        if (!event.point) return;

        // Snap the preview point for visual feedback
        const snapResult = this.getSnappedVertex(event.point);
        this.hoverSnappedRouteId = snapResult.routeId || null;

        const startClick = this.currentClickData[this.currentClickData.length - 1];
        this.previewLineSegment = { points: [startClick.point.clone(), snapResult.point] };
    }

    handleMeshClick(event) {
        if (this.currentClickData.length === 0) {
            // Deselect logic
            userState.ui.selectedRouteId = null;
            userState.ui.selectedFixpointId = null;
        }
    }

    handleMeshDblClick(event, activeTool) {
        let isMeshInLoadedScene = false;
        if (this.gltfScene && event.object?.isMesh) {
            event.object.traverseAncestors((ancestor) => { if (ancestor === this.gltfScene) isMeshInLoadedScene = true; });
        }

        if (!isMeshInLoadedScene || !event.point || !event.face?.normal) return;

        if (activeTool === 'symbol') {
            const modelOffset = new Vector3(...this.modelPosition);
            userState.topo.fixPoints.push({ id: crypto.randomUUID(), position: event.point.clone().sub(modelOffset).toArray(), type: 'bolt' });
            return;
        }

        if (activeTool !== 'route' && activeTool !== 'multipitch') return;

        // Snapping to vertices only when clicking mesh
        const snapResult = this.getSnappedVertex(event.point);
        if (snapResult.routeId) {
            this.lastSnappedRouteId = snapResult.routeId;
            this.lastSnappedVertexIndex = snapResult.index;
        } else {
            this.lastSnappedRouteId = null;
            this.lastSnappedVertexIndex = -1;
        }

        const normalMatrix = new THREE.Matrix3().getNormalMatrix(event.object.matrixWorld);
        const worldNormal = event.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        const currentClick = { point: snapResult.point, normal: worldNormal, mesh: event.object };
        this.currentClickData = [...this.currentClickData, currentClick];

        if (this.currentClickData.length === 1) {
            this.firstPointVisual = currentClick.point.clone().addScaledVector(currentClick.normal, 0.05).toArray();
        }

        if (this.currentClickData.length >= 2) {
            const previousClick = this.currentClickData[this.currentClickData.length - 2];
            const segmentPointData = this.generateProjectedSegment(previousClick, currentClick, this.gltfScene, this.camera);
            if (segmentPointData && segmentPointData.length > 1) {
                const offsetPoints = segmentPointData.map(pd => new Vector3().copy(pd.point).addScaledVector(pd.normal, this.OFFSET_DISTANCE));
                this.currentLineSegments = [...this.currentLineSegments, { id: this.currentLineSegments.length, points: offsetPoints, pointsData: segmentPointData }];
                this.previewLineSegment = null;
            }
        }
    }

    handleRouteDblClick(e, parentId, activeTool) {
        if (activeTool !== 'route' && activeTool !== 'multipitch') return;
        e.stopPropagation();

        const route = this.visualRoutes.find(vr => vr.parentId === parentId);
        if (!route || route.points.length === 0) return;

        let closestIdx = 0;
        let minDist = Infinity;
        route.points.forEach((p, idx) => {
            const d = p.distanceToSquared(e.point);
            if (d < minDist) {
                minDist = d;
                closestIdx = idx;
            }
        });

        const snappedPoint = route.points[closestIdx];
        const normal = route.normal || new Vector3(0, 1, 0);

        if (this.currentClickData.length > 0 && this.lastSnappedRouteId === parentId && this.lastSnappedVertexIndex !== -1) {
            const start = this.lastSnappedVertexIndex;
            const end = closestIdx;
            if (start !== end) {
                const step = (start < end) ? 1 : -1;
                let tracePoints = [];
                let traceData = [];
                for (let k = start + step; ; k += step) {
                    const p = route.points[k];
                    tracePoints.push(p.clone());
                    traceData.push({ point: p.clone(), normal: normal.clone() });
                    if (k === end) break;
                }

                this.currentLineSegments = [...this.currentLineSegments, { id: this.currentLineSegments.length, points: tracePoints, pointsData: traceData }];
                const last = traceData[traceData.length - 1];
                this.currentClickData = [...this.currentClickData, { point: last.point, normal: last.normal, mesh: null }];
            }
        } else {
            const currentClick = { point: snappedPoint, normal: normal, mesh: null };
            this.currentClickData = [...this.currentClickData, currentClick];
            if (this.currentClickData.length === 1) {
                this.firstPointVisual = currentClick.point.clone().addScaledVector(currentClick.normal, 0.05).toArray();
            }
            if (this.currentClickData.length >= 2) {
                const previousClick = this.currentClickData[this.currentClickData.length - 2];
                const segmentPointData = this.generateProjectedSegment(previousClick, currentClick, this.gltfScene, this.camera);
                if (segmentPointData && segmentPointData.length > 1) {
                    this.currentLineSegments = [...this.currentLineSegments, { id: this.currentLineSegments.length, points: segmentPointData.map(pd => pd.point), pointsData: segmentPointData }];
                }
            }
        }

        this.lastSnappedRouteId = parentId;
        this.lastSnappedVertexIndex = closestIdx;
        this.previewLineSegment = null;
        this.updateTick += 1;
    }

    handleFixPointClick(e, pointId) {
        e.stopPropagation();
        if (userState.ui.selectedRouteId) {
            const route = userState.topo.routes.find(r => r.id === userState.ui.selectedRouteId);
            if (route) {
                if (!route.fixPoints) route.fixPoints = [];
                if (route.fixPoints.includes(pointId)) {
                    route.fixPoints = route.fixPoints.filter(id => id !== pointId);
                } else {
                    route.fixPoints.push(pointId);
                }
            }
        } else {
            userState.ui.selectedFixpointId = (userState.ui.selectedFixpointId === pointId) ? null : pointId;
        }
    }

    handleFixPointDblClick(e, pointId, activeTool) {
        e.stopPropagation();

        if ((activeTool === 'multipitch' || activeTool === 'route') && this.currentClickData.length > 0) {
            // Finish route/pitch logic
            const startPoint = userState.topo.fixPoints.find(p => p.id === pointId);
            if (!startPoint) return;

            const modelOffset = new Vector3(...this.modelPosition);
            const snapPoint = new Vector3(...startPoint.position).add(modelOffset);
            const lastClick = this.currentClickData[this.currentClickData.length - 1];
            const snapClick = { point: snapPoint, normal: new Vector3(0, 1, 0), mesh: null };
            const segmentPoints = this.generateProjectedSegment(lastClick, snapClick, this.gltfScene, this.camera);

            let allPointsWithNormals = [];
            this.currentLineSegments.forEach(segment => {
                if (segment.pointsData?.length > 0) allPointsWithNormals.push(...segment.pointsData);
            });
            if (segmentPoints && segmentPoints.length > 0) {
                allPointsWithNormals.push(...segmentPoints);
            } else {
                allPointsWithNormals.push({ point: snapPoint, normal: new Vector3(0, 1, 0) });
            }

            const finalPoints = allPointsWithNormals.map(p => p.point.clone().sub(modelOffset).toArray().map(c => Number(c.toFixed(2))));

            if (activeTool === 'multipitch') {
                let route = userState.topo.routes.find(r => r.id === (this.localDrawingState?.routeId || userState.ui.selectedRouteId));
                if (route) {
                    let pitch = this.localDrawingState ? route.pitches.find(p => p.id === this.localDrawingState.pitchId) : null;
                    if (!pitch && route.pitches.length > 0) pitch = route.pitches[route.pitches.length - 1];
                    if (pitch) {
                        pitch.points = finalPoints;
                        pitch.endNodeId = pointId;
                    }
                }
                this.localDrawingState = null;
            } else if (activeTool === 'route') {
                const averageNormal = new Vector3();
                allPointsWithNormals.forEach(pd => averageNormal.add(pd.normal));
                averageNormal.normalize();
                const newRoute = {
                    id: crypto.randomUUID(),
                    name: 'New Route',
                    points: finalPoints,
                    orientation: [averageNormal.x, averageNormal.y, averageNormal.z],
                    tags: [],
                    fixPoints: []
                };
                userState.topo.routes = [...userState.topo.routes, newRoute];
                userState.ui.selectedRouteId = newRoute.id;
            }

            this.resetDrawingState();
            return;
        }

        if (activeTool === 'multipitch') {
            // START multipitch
            const route = userState.topo.routes.find(r => r.id === userState.ui.selectedRouteId);
            if (route && route.type === 'multi-pitch') {
                const startPoint = userState.topo.fixPoints.find(p => p.id === pointId);
                if (startPoint) {
                    const startClick = {
                        point: new Vector3(...startPoint.position).add(new Vector3(...this.modelPosition)),
                        normal: new Vector3(0, 1, 0),
                        mesh: null
                    };
                    this.currentClickData = [startClick];
                    this.currentLineSegments = [];
                    this.firstPointVisual = startClick.point.toArray();
                    this.previewLineSegment = null;
                    const newPitch = { id: crypto.randomUUID(), startNodeId: pointId, points: [], type: 'climb' };
                    route.pitches = [...(route.pitches || []), newPitch];
                    this.localDrawingState = { routeId: route.id, pitchId: newPitch.id };
                    this.updateTick += 1;
                }
            }
        }
    }

    handleKeyDown(event, activeTool) {
        // Global key handlers (Delete)
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (userState.ui.selectedFixpointId) {
                const idToDelete = userState.ui.selectedFixpointId;
                // Remove from global fixpoints
                userState.topo.fixPoints = userState.topo.fixPoints.filter(p => p.id !== idToDelete);

                // Remove references from routes
                userState.topo.routes.forEach(route => {
                    if (route.fixPoints) {
                        route.fixPoints = route.fixPoints.filter(id => id !== idToDelete);
                    }
                    if (route.pitches) {
                        route.pitches.forEach(pitch => {
                            if (pitch.startNodeId === idToDelete) pitch.startNodeId = null;
                            if (pitch.endNodeId === idToDelete) pitch.endNodeId = null;
                        });
                    }
                });

                userState.ui.selectedFixpointId = null;
                return;
            }
        }

        // Tool-specific handlers
        if (activeTool !== 'route' && activeTool !== 'multipitch') return;

        if (activeTool === 'multipitch' && (event.key === 'b' || event.key === 'B')) {
            if (this.currentClickData.length > 0) {
                // Multipitch BELAY logic (create anchor)
                this.finalizeMultipitchAnchor();
            }
            return;
        }

        if (event.key === 'n' || event.key === 'N' || event.key === 'Enter') {
            this.finalizeRouteOrPitch(activeTool);
        } else if (event.key === 'Escape') {
            this.resetDrawingState();
        }
    }

    finalizeMultipitchAnchor() {
        let allPointsWithNormals = [];
        this.currentLineSegments.forEach(segment => {
            if (segment.pointsData?.length > 0) allPointsWithNormals.push(...segment.pointsData);
        });
        if (allPointsWithNormals.length === 0) return;

        const modelOffset = new Vector3(...this.modelPosition);
        const finalPoints = allPointsWithNormals.map(p => p.point.clone().sub(modelOffset).toArray().map(c => Number(c.toFixed(2))));

        let route = userState.topo.routes.find(r => r.id === (this.localDrawingState?.routeId || userState.ui.selectedRouteId));
        if (!route) {
            route = { id: crypto.randomUUID(), type: 'multi-pitch', pitches: [], tags: [], fixPoints: [] };
            userState.topo.routes.push(route);
        }

        const anchorId = crypto.randomUUID();
        const lastPoint = allPointsWithNormals[allPointsWithNormals.length - 1];
        userState.topo.fixPoints.push({ id: anchorId, position: lastPoint.point.clone().sub(modelOffset).toArray(), type: 'belay' });

        const currentPitch = { id: crypto.randomUUID(), pitchNumber: route.pitches.length + 1, points: finalPoints, type: 'pitch', endNodeId: anchorId };
        route.pitches.push(currentPitch);

        const nextPitch = { id: crypto.randomUUID(), pitchNumber: route.pitches.length + 1, startNodeId: anchorId, points: [], type: 'climb' };
        route.pitches.push(nextPitch);

        this.currentClickData = [{ point: lastPoint.point.clone(), normal: lastPoint.normal.clone(), mesh: null }];
        this.currentLineSegments = [];
        this.firstPointVisual = lastPoint.point.toArray();
        this.previewLineSegment = null;
        this.localDrawingState = { routeId: route.id, pitchId: nextPitch.id };
        this.lastSnappedRouteId = null;
        this.lastSnappedVertexIndex = -1;
        this.updateTick += 1;
    }

    finalizeRouteOrPitch(activeTool) {
        if (this.currentLineSegments.length > 0 && this.currentClickData.length > 0) {
            let allPointsWithNormals = [];
            this.currentLineSegments.forEach(segment => {
                if (segment.pointsData?.length > 0) allPointsWithNormals.push(...segment.pointsData);
            });
            if (allPointsWithNormals.length > 0) {
                const modelOffset = new Vector3(...this.modelPosition);
                const finalPoints = allPointsWithNormals.map(p => p.point.clone().sub(modelOffset).toArray().map(c => Number(c.toFixed(2))));
                const averageNormal = new Vector3();
                allPointsWithNormals.forEach(pd => averageNormal.add(pd.normal));
                averageNormal.normalize();

                if (activeTool === 'multipitch') {
                    let route = userState.topo.routes.find(r => r.id === (this.localDrawingState?.routeId || userState.ui.selectedRouteId));
                    if (!route) {
                        route = {
                            id: crypto.randomUUID(),
                            name: 'New Multi-Pitch',
                            type: 'multi-pitch',
                            pitches: [],
                            orientation: [averageNormal.x, averageNormal.y, averageNormal.z],
                            tags: [],
                            fixPoints: []
                        };
                        userState.topo.routes = [...userState.topo.routes, route];
                        userState.ui.selectedRouteId = route.id;
                    }
                    const endId = crypto.randomUUID();
                    userState.topo.fixPoints.push({ id: endId, position: finalPoints[finalPoints.length - 1], type: 'bolt' });
                    route.pitches.push({ id: crypto.randomUUID(), pitchNumber: route.pitches.length + 1, points: finalPoints, type: 'climb', endNodeId: endId });
                } else {
                    const newRoute = {
                        id: crypto.randomUUID(),
                        name: 'New Route',
                        points: finalPoints,
                        orientation: [averageNormal.x, averageNormal.y, averageNormal.z],
                        tags: [],
                        fixPoints: []
                    };
                    userState.topo.routes = [...userState.topo.routes, newRoute];
                    userState.ui.selectedRouteId = newRoute.id;
                }
            }
            this.resetDrawingState();
        }
    }

    resetDrawingState() {
        this.currentClickData = [];
        this.currentLineSegments = [];
        this.firstPointVisual = null;
        this.previewLineSegment = null;
        this.lastSnappedRouteId = null;
        this.lastSnappedVertexIndex = -1;
        this.localDrawingState = null;
        this.updateTick += 1;
    }

    generateProjectedSegment(startData, endData, mesh, cam, stepSize = this.STEP_SIZE) {
        if (!cam || !mesh || !startData?.point || !endData?.point) return [];
        const startPoint = startData.point.clone();
        const endPoint = endData.point.clone();
        const startToEnd = new Vector3().subVectors(endPoint, startPoint);
        const segmentLength = startToEnd.length();
        if (segmentLength < 0.001) return [{ point: startPoint, normal: startData.normal.clone() }, { point: endPoint, normal: endData.normal.clone() }];

        const pointsData = [{ point: startPoint, normal: startData.normal.clone() }];
        const camPos = cam.position.clone();
        const subdivisions = Math.min(20, Math.max(5, Math.ceil(segmentLength / stepSize)));

        for (let i = 1; i < subdivisions; i++) {
            const t = i / subdivisions;
            const interP = new Vector3().copy(startPoint).addScaledVector(startToEnd, t);
            this.projectionRaycaster.set(camPos, new Vector3().subVectors(interP, camPos).normalize());
            const intersects = this.projectionRaycaster.intersectObject(mesh, true);

            if (intersects.length > 0 && intersects[0].face) {
                const hit = intersects[0];
                const normMat = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                pointsData.push({ point: hit.point.clone(), normal: hit.face.normal.clone().applyMatrix3(normMat).normalize() });
            } else {
                pointsData.push({ point: interP, normal: new Vector3().lerpVectors(startData.normal, endData.normal, t).normalize() });
            }
        }
        pointsData.push({ point: endPoint, normal: endData.normal.clone() });
        return pointsData;
    }
}
