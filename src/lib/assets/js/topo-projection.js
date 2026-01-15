/**
 * Topo Projection Utilities
 * 
 * Transforms 3D route and fix point data into 2D symbolic topo representations
 * using cylindrical projection to minimize empty space.
 */

const DEG_TO_RAD = Math.PI / 180;

import { generateOutlineId } from './id-utils.js';

/**
 * Calculate the centroid (geometric center) of a set of points
 */
function calculateCentroid(points) {
    if (!points || points.length === 0) return null;
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const p of points) {
        sumX += p[0];
        sumY += p[1];
        sumZ += p[2];
    }
    return {
        x: sumX / points.length,
        y: sumY / points.length,
        z: sumZ / points.length,
        count: points.length
    };
}

/**
 * Create a "spine" curve that represents the horizontal shape of the wall
 * This is used to "unroll" the wall for 2D projection.
 * 
 * @param {Array} routes - Array of route objects
 * @returns {Object} Spine object with points, segment lengths, and total length
 */
function createSpineFromRoutes(routes) {
    // 1. Calculate centroids for all routes
    const centroids = [];
    for (const route of routes) {
        if (route.points && route.points.length > 0) {
            const c = calculateCentroid(route.points);
            if (c) {
                centroids.push({ ...c, id: route.id });
            }
        }
    }

    if (centroids.length < 2) {
        // Fallback for single route: creates a tiny spine around it
        if (centroids.length === 1) {
            const c = centroids[0];
            return {
                points: [
                    { x: c.x - 1, y: c.y, z: c.z },
                    { x: c.x + 1, y: c.y, z: c.z }
                ],
                lengths: [2],
                totalLength: 2
            };
        }
        return null;
    }

    // 2. Sort centroids to form a logical line (left-to-right)
    // We project onto the XZ plane for sorting (ignoring height)

    // Calculate center of mass of centroids
    let cmX = 0, cmZ = 0;
    for (const c of centroids) {
        cmX += c.x;
        cmZ += c.z;
    }
    cmX /= centroids.length;
    cmZ /= centroids.length;

    // Calculate Principal Component (dominant direction)
    let xx = 0, xz = 0, zz = 0;
    for (const c of centroids) {
        const dx = c.x - cmX;
        const dz = c.z - cmZ;
        xx += dx * dx;
        xz += dx * dz;
        zz += dz * dz;
    }

    // Eigenvector calculation for 2x2 covarience matrix [[xx, xz], [xz, zz]]
    // The dominant eigenvector roughly gives the "line" of the wall
    const diff = xx - zz;
    const root = Math.sqrt(diff * diff + 4 * xz * xz);
    const lambda1 = (xx + zz + root) / 2;

    // Dominant direction vector (V1x, V1z)
    let v1x = lambda1 - zz;
    let v1z = xz;
    const vLen = Math.sqrt(v1x * v1x + v1z * v1z);
    if (vLen > 0.001) {
        v1x /= vLen;
        v1z /= vLen;
    } else {
        v1x = 1; v1z = 0; // Default to X axis
    }

    // Sort centroids by projection onto this dominant vector
    centroids.sort((a, b) => {
        const projA = (a.x - cmX) * v1x + (a.z - cmZ) * v1z;
        const projB = (b.x - cmX) * v1x + (b.z - cmZ) * v1z;
        return projA - projB;
    });

    // 3. Create spine points
    const rawSpinePoints = centroids.map(c => ({ x: c.x, y: c.y, z: c.z }));
    let spinePoints = rawSpinePoints;

    // Smooth the spine to prevent zig-zags which cause X-axis distortion
    // Simple Gaussian smoothing (0.25, 0.5, 0.25)
    if (spinePoints.length >= 3) {
        const iterations = 3;
        for (let iter = 0; iter < iterations; iter++) {
            const smoothed = [];
            // Keep first point fixed
            smoothed.push(spinePoints[0]);

            for (let i = 1; i < spinePoints.length - 1; i++) {
                const prev = spinePoints[i - 1];
                const curr = spinePoints[i];
                const next = spinePoints[i + 1];

                smoothed.push({
                    x: 0.25 * prev.x + 0.5 * curr.x + 0.25 * next.x,
                    y: 0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y,
                    z: 0.25 * prev.z + 0.5 * curr.z + 0.25 * next.z
                });
            }

            // Keep last point fixed
            smoothed.push(spinePoints[spinePoints.length - 1]);
            spinePoints = smoothed;
        }
    }

    // Extend the spine at both ends to cover wide routes (avoid bunching)
    if (spinePoints.length >= 2) {
        const ext = 20; // Extension length

        // Extend Start
        const p0 = spinePoints[0];
        const p1 = spinePoints[1];
        const dx0 = p0.x - p1.x;
        const dz0 = p0.z - p1.z;
        const len0 = Math.sqrt(dx0 * dx0 + dz0 * dz0);
        if (len0 > 0.001) {
            spinePoints.unshift({
                x: p0.x + (dx0 / len0) * ext,
                y: p0.y,
                z: p0.z + (dz0 / len0) * ext
            });
        }

        // Extend End
        const pn = spinePoints[spinePoints.length - 1];
        const pn1 = spinePoints[spinePoints.length - 2];
        const dxn = pn.x - pn1.x;
        const dzn = pn.z - pn1.z;
        const lenn = Math.sqrt(dxn * dxn + dzn * dzn);
        if (lenn > 0.001) {
            spinePoints.push({
                x: pn.x + (dxn / lenn) * ext,
                y: pn.y,
                z: pn.z + (dzn / lenn) * ext
            });
        }
    }

    // 4. Precompute segment lengths
    const lengths = [];
    let totalLength = 0;

    for (let i = 0; i < spinePoints.length - 1; i++) {
        const p1 = spinePoints[i];
        const p2 = spinePoints[i + 1];

        // Use horizontal (XZ) distance only to preserve height relations?
        // Or 3D distance?
        // For unrolling, we primarily want the horizontal "walking" distance.
        // Using XZ distance keeps vertical lines vertical.
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const len = Math.sqrt(dx * dx + dz * dz);

        lengths.push(len);
        totalLength += len;
    }

    return {
        points: spinePoints,
        lengths: lengths,
        totalLength: totalLength
    };
}

/**
 * Project a 3D point onto the spine to get unrolled coordinates
 * 
 * @param {Array<number>} point - [x, y, z]
 * @param {Object} spine - Spine object from createSpineFromRoutes
 * @returns {{x: number, y: number}} Unrolled 2D coordinates
 */
function projectPointToSpine(point, spine) {
    if (!spine) return { x: 0, y: point[1] };

    const px = point[0];
    const pz = point[2];

    // Find closest segment on the spine
    let minDistSq = Infinity;
    let closestX = 0;
    let currentSpineDist = 0;

    for (let i = 0; i < spine.points.length - 1; i++) {
        const p1 = spine.points[i];
        const p2 = spine.points[i + 1];
        const segLen = spine.lengths[i];

        if (segLen < 0.001) {
            currentSpineDist += segLen;
            continue;
        }

        // Project point onto line segment p1-p2 (in XZ plane)
        const segDx = p2.x - p1.x;
        const segDz = p2.z - p1.z;

        const pointDx = px - p1.x;
        const pointDz = pz - p1.z;

        // t = dot(point-p1, seg) / dot(seg, seg)
        // normalized t (0 to 1 along segment)
        let t = (pointDx * segDx + pointDz * segDz) / (segLen * segLen);
        t = Math.max(0, Math.min(1, t));

        // Closest point on segment
        const closestPx = p1.x + t * segDx;
        const closestPz = p1.z + t * segDz;

        const distSq = (px - closestPx) ** 2 + (pz - closestPz) ** 2;

        if (distSq < minDistSq) {
            minDistSq = distSq;
            closestX = currentSpineDist + t * segLen;
        }

        currentSpineDist += segLen;
    }

    // Y coordinate is preserved directly (or projected, but direct is better for symbolic)
    return {
        x: closestX,
        y: point[1]
    };
}

/**
 * Calculate the center point of all given 3D points
 * @param {Array<Array<number>>} points - Array of [x, y, z] points
 * @returns {{x: number, y: number, z: number}} Center point
 */
export function calculateCenter(points) {
    if (points.length === 0) {
        return { x: 0, y: 0, z: 0 };
    }

    let sumX = 0, sumY = 0, sumZ = 0;
    for (const p of points) {
        sumX += p[0];
        sumY += p[1];
        sumZ += p[2];
    }

    return {
        x: sumX / points.length,
        y: sumY / points.length,
        z: sumZ / points.length
    };
}

/**
 * Project a single 3D point using orthographic projection
 * Uses the same viewpoint logic as the read-only viewer camera.
 * 
 * The camera looks from: center + orientation * distance
 * So we project onto a plane perpendicular to the orientation vector.
 * 
 * @param {Array<number>} point3D - [x, y, z] coordinates
 * @param {{x: number, y: number, z: number}} center - Center of the projection
 * @param {{x: number, y: number, z: number}} viewDir - Normalized view direction (orientation vector)
 * @returns {{x: number, y: number}} Projected 2D coordinates
 */
export function projectPointOrthographic(point3D, center, viewDir) {
    // Translate point relative to center
    const dx = point3D[0] - center.x;
    const dy = point3D[1] - center.y;
    const dz = point3D[2] - center.z;

    // The view direction is the orientation vector (pointing outward from wall)
    // We need to calculate the "right" and "up" axes for our 2D projection

    // Up direction in world space is always [0, 1, 0]
    const worldUpX = 0, worldUpY = 1, worldUpZ = 0;

    // Right = view × worldUp (cross product)
    // This gives us the horizontal direction along the wall
    let rightX = viewDir.y * worldUpZ - viewDir.z * worldUpY;
    let rightY = viewDir.z * worldUpX - viewDir.x * worldUpZ;
    let rightZ = viewDir.x * worldUpY - viewDir.y * worldUpX;

    // Normalize the right vector
    const rightLen = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ);
    if (rightLen > 0.001) {
        rightX /= rightLen;
        rightY /= rightLen;
        rightZ /= rightLen;
    } else {
        // View direction is vertical, fallback to X-axis as right
        rightX = 1; rightY = 0; rightZ = 0;
    }

    // Up = right × view (cross product) - gives us the actual up direction in view space
    let upX = rightY * viewDir.z - rightZ * viewDir.y;
    let upY = rightZ * viewDir.x - rightX * viewDir.z;
    let upZ = rightX * viewDir.y - rightY * viewDir.x;

    // Normalize the up vector
    const upLen = Math.sqrt(upX * upX + upY * upY + upZ * upZ);
    if (upLen > 0.001) {
        upX /= upLen;
        upY /= upLen;
        upZ /= upLen;
    }

    // Project point onto 2D plane using dot products
    // x2D = point · right (horizontal position)
    // y2D = point · up (vertical position)
    const x2D = dx * rightX + dy * rightY + dz * rightZ;
    const y2D = dx * upX + dy * upY + dz * upZ;

    return { x: x2D, y: y2D };
}

/**
 * Project an entire route's points to 2D
 * Only generates points2D if the route doesn't already have it
 * 
 * @param {Object} route - Route object with points array
 * @param {{x: number, y: number, z: number}} center - Center for orthographic projection
 * @param {{x: number, y: number, z: number}} viewDir - View direction (orientation vector)
 * @returns {Array<Array<number>>|null} - points2D array or null if already exists
 */
export function projectRoute(route, center, viewDir) {
    // Option B: Only generate for routes without points2D
    if (route.points2D && route.points2D.length > 0) {
        return null;
    }

    if (!route.points || route.points.length === 0) {
        return [];
    }

    const projected = route.points.map(p => {
        const { x, y } = projectPointOrthographic(p, center, viewDir);
        return [x, y];
    });

    return projected;
}

/**
 * Project a fix point to 2D
 * Only generates position2D if the fix point doesn't already have it
 * 
 * @param {Object} fixPoint - Fix point object with position array
 * @param {{x: number, y: number, z: number}} center - Center for orthographic projection
 * @param {{x: number, y: number, z: number}} viewDir - View direction (orientation vector)
 * @returns {Array<number>|null} - position2D [x, y] or null if already exists
 */
export function projectFixPoint(fixPoint, center, viewDir) {
    // Only generate if position2D doesn't exist
    if (fixPoint.position2D && fixPoint.position2D.length === 2) {
        return null;
    }

    if (!fixPoint.position || fixPoint.position.length < 3) {
        return null;
    }

    const { x, y } = projectPointOrthographic(fixPoint.position, center, viewDir);
    return [x, y];
}

/**
 * Normalize all projected points to fit within [0, 1] range
 * with configurable margin around the edges
 * 
 * @param {Array<Array<number>>} allPoints - All projected [x, y] points
 * @param {number} margin - Margin ratio (0.05 = 5% margin on each side)
 * @returns {{scale: {x: number, y: number}, offset: {x: number, y: number}}} Transform parameters
 */
export function calculateNormalization(allPoints, margin = 0.05) {
    if (allPoints.length === 0) {
        return { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const p of allPoints) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Available space after margin
    const availableSpace = 1 - (margin * 2);

    // Scale to fit within available space, maintaining aspect ratio
    const scaleX = availableSpace / rangeX;
    const scaleY = availableSpace / rangeY;

    // Use uniform scale to maintain proportions
    const scale = Math.min(scaleX, scaleY);

    // Calculate offset to center the content
    const scaledWidth = rangeX * scale;
    const scaledHeight = rangeY * scale;

    return {
        scale: { x: scale, y: scale },
        offset: {
            x: margin + (availableSpace - scaledWidth) / 2 - minX * scale,
            y: margin + (availableSpace - scaledHeight) / 2 - minY * scale
        },
        bounds: { minX, maxX, minY, maxY }
    };
}

/**
 * Apply normalization transform to a point
 * 
 * @param {Array<number>} point - [x, y] point
 * @param {{scale: {x: number, y: number}, offset: {x: number, y: number}}} transform
 * @returns {Array<number>} Normalized [x, y] point in 0-1 range
 */
export function applyNormalization(point, transform) {
    return [
        point[0] * transform.scale.x + transform.offset.x,
        // Flip Y axis (3D Y is up, 2D Y is down)
        1 - (point[1] * transform.scale.y + transform.offset.y)
    ];
}

/**
 * Main function: Generate 2D topo from 3D data
 * 
 * @param {Object} topo - Topo object containing routes, fixPoints, and wallAzimuth
 * @returns {{updatedRoutes: number, updatedFixPoints: number, generatedOutline: boolean}} Statistics
 */
export function generate2DFromTopo_OLD(topo) {
    const { routes = [], fixPoints = [] } = topo;

    // Collect all 3D points for center calculation
    const all3DPoints = [];

    for (const route of routes) {
        if (route.points) {
            all3DPoints.push(...route.points);
        }
    }

    for (const fp of fixPoints) {
        if (fp.position) {
            all3DPoints.push(fp.position);
        }
    }

    if (all3DPoints.length === 0) {
        return { updatedRoutes: 0, updatedFixPoints: 0, generatedOutline: false };
    }

    // Calculate center for projection
    const center = calculateCenter(all3DPoints);

    // Calculate average orientation from routes (like read-only viewer uses)
    let avgOrientationX = 0, avgOrientationY = 0, avgOrientationZ = 0;
    let orientationCount = 0;

    for (const route of routes) {
        if (route.orientation && Array.isArray(route.orientation) && route.orientation.length >= 3) {
            avgOrientationX += route.orientation[0];
            avgOrientationY += route.orientation[1];
            avgOrientationZ += route.orientation[2];
            orientationCount++;
        }
    }

    // Default orientation if none found (looking from +Z direction)
    let viewDir = { x: 0, y: 0, z: 1 };

    if (orientationCount > 0) {
        avgOrientationX /= orientationCount;
        avgOrientationY /= orientationCount;
        avgOrientationZ /= orientationCount;

        // Normalize the orientation vector
        const len = Math.sqrt(avgOrientationX * avgOrientationX + avgOrientationY * avgOrientationY + avgOrientationZ * avgOrientationZ);
        if (len > 0.001) {
            viewDir = {
                x: avgOrientationX / len,
                y: avgOrientationY / len,
                z: avgOrientationZ / len
            };
        }
    }

    // Project all points (for normalization calculation)
    const allProjected = [];
    const routeProjections = [];
    const fixPointProjections = [];

    for (const route of routes) {
        const projected = projectRoute(route, center, viewDir);
        routeProjections.push(projected);
        if (projected) {
            allProjected.push(...projected);
        }
    }

    for (const fp of fixPoints) {
        const projected = projectFixPoint(fp, center, viewDir);
        fixPointProjections.push(projected);
        if (projected) {
            allProjected.push(projected);
        }
    }

    // Also include existing points2D for normalization consistency
    for (const route of routes) {
        if (route.points2D && route.points2D.length > 0) {
            // We need to include existing 2D points in normalization
            // But they're already normalized... skip them from bounds calculation
        }
    }

    if (allProjected.length === 0) {
        return { updatedRoutes: 0, updatedFixPoints: 0, generatedOutline: false };
    }

    // Calculate normalization transform
    const transform = calculateNormalization(allProjected, 0.08);

    // Apply normalization and update data
    let updatedRoutes = 0;
    let updatedFixPoints = 0;

    for (let i = 0; i < routes.length; i++) {
        const projected = routeProjections[i];
        if (projected) {
            routes[i].points2D = projected.map(p => applyNormalization(p, transform));
            updatedRoutes++;
        }
    }

    for (let i = 0; i < fixPoints.length; i++) {
        const projected = fixPointProjections[i];
        if (projected) {
            fixPoints[i].position2D = applyNormalization(projected, transform);
            updatedFixPoints++;
        }
    }

    // Generate outline from convex hull of all normalized points
    let generatedOutline = false;

    // Check if outlines already exist
    if (!topo.outlines || topo.outlines.length === 0) {
        const allNormalizedPoints = [];

        for (const route of routes) {
            if (route.points2D && route.points2D.length > 0) {
                allNormalizedPoints.push(...route.points2D);
            }
        }

        for (const fp of fixPoints) {
            if (fp.position2D) {
                allNormalizedPoints.push(fp.position2D);
            }
        }

        if (allNormalizedPoints.length >= 3) {
            const hull = computeConvexHull(allNormalizedPoints);

            if (hull.length >= 3) {
                // Expand the hull slightly to provide margin around the routes
                const expandedHull = expandHull(hull, 0.03);

                if (!topo.outlines) {
                    topo.outlines = [];
                }

                topo.outlines.push({
                    id: generateOutlineId(),
                    points2D: expandedHull
                });

                generatedOutline = true;
            }
        }
    }

    return { updatedRoutes, updatedFixPoints, generatedOutline };
}

/**
 * Main function: Generate 2D topo from 3D data
 * Uses Panoramic Unrolling (Option 1)
 */
export function generate2DFromTopo(topo) {
    const { routes = [], fixPoints = [] } = topo;

    // 1. Create the Spine from routes
    // This defines the "shape" of the wall that we will unroll
    const spine = createSpineFromRoutes(routes);

    if (!spine) {
        return { updatedRoutes: 0, updatedFixPoints: 0, generatedOutline: false };
    }

    // 2. Project all points via unrolling
    const allProjected = [];
    const routeProjections = [];
    const fixPointProjections = [];

    for (const route of routes) {
        // Option B check built-in here for efficiency
        if (route.points2D && route.points2D.length > 0) {
            routeProjections.push(null);
            continue;
        }

        if (!route.points || route.points.length === 0) {
            routeProjections.push([]);
            continue;
        }

        const projected = route.points.map(p => {
            const { x, y } = projectPointToSpine(p, spine);
            return [x, y];
        });

        routeProjections.push(projected);
        allProjected.push(...projected);
    }

    for (const fp of fixPoints) {
        if (fp.position2D || !fp.position) {
            fixPointProjections.push(null);
            continue;
        }

        const { x, y } = projectPointToSpine(fp.position, spine);
        const projected = [x, y];
        fixPointProjections.push(projected);
        allProjected.push(projected);
    }

    if (allProjected.length === 0) {
        return { updatedRoutes: 0, updatedFixPoints: 0, generatedOutline: false };
    }

    // 3. Normalize
    const transform = calculateNormalization(allProjected, 0.08);

    // 4. Update Data
    let updatedRoutes = 0;
    let updatedFixPoints = 0;

    // Calculate lengths for varying simplification
    let maxRouteLen = 0;
    const routeLengths = [];

    for (let i = 0; i < routes.length; i++) {
        const projected = routeProjections[i];
        if (!projected || projected.length < 2) {
            routeLengths.push(0);
            continue;
        }

        let len = 0;
        for (let j = 0; j < projected.length - 1; j++) {
            const dx = projected[j + 1][0] - projected[j][0];
            const dy = projected[j + 1][1] - projected[j][1];
            // Use simple Euclidean dist on projected points
            len += Math.sqrt(dx * dx + dy * dy);
        }
        routeLengths.push(len);
        if (len > maxRouteLen) maxRouteLen = len;
    }

    for (let i = 0; i < routes.length; i++) {
        const projected = routeProjections[i];
        if (projected) {
            const normalized = projected.map(p => applyNormalization(p, transform));

            // Proportional simplification:
            // fast routes get fewer segments. Max 20 segments (21 points) for longest route.
            // Min 5 points to keep some shape even for short routes.
            let pointLimit = 21;
            if (maxRouteLen > 0.001) {
                const ratio = routeLengths[i] / maxRouteLen;
                pointLimit = Math.max(5, Math.ceil(21 * ratio));
            }

            routes[i].points2D = simplifyPoints(normalized, pointLimit);
            updatedRoutes++;
        }
    }

    for (let i = 0; i < fixPoints.length; i++) {
        const projected = fixPointProjections[i];
        if (projected) {
            fixPoints[i].position2D = applyNormalization(projected, transform);
            updatedFixPoints++;
        }
    }

    // 5. Generate Outline
    let generatedOutline = false;
    if ((!topo.outlines || topo.outlines.length === 0) && allProjected.length >= 3) {
        const allNormalizedPoints = [];

        // Collect points from just-updated routes/fixpoints
        for (const route of routes) {
            if (route.points2D) allNormalizedPoints.push(...route.points2D);
        }
        for (const fp of fixPoints) {
            if (fp.position2D) allNormalizedPoints.push(fp.position2D);
        }

        if (allNormalizedPoints.length >= 3) {
            const hull = computeConvexHull(allNormalizedPoints);
            if (hull.length >= 3) {
                const expandedHull = expandHull(hull, 0.03);
                if (!topo.outlines) topo.outlines = [];
                topo.outlines.push({
                    id: crypto.randomUUID(),
                    points2D: expandedHull
                });
                generatedOutline = true;
            }
        }
    }

    return { updatedRoutes, updatedFixPoints, generatedOutline };
}

/**
 * Compute convex hull of 2D points using Graham Scan algorithm
 * @param {Array<Array<number>>} points - Array of [x, y] points
 * @returns {Array<Array<number>>} Points forming the convex hull in CCW order
 */
function computeConvexHull(points) {
    if (points.length < 3) return points.slice();

    // Find the point with lowest Y (and leftmost if tie)
    let start = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i][1] > points[start][1] ||
            (points[i][1] === points[start][1] && points[i][0] < points[start][0])) {
            start = i;
        }
    }

    const startPoint = points[start];

    // Sort points by polar angle with respect to start point
    const sorted = points
        .filter((_, i) => i !== start)
        .map(p => ({
            point: p,
            angle: Math.atan2(p[1] - startPoint[1], p[0] - startPoint[0]),
            dist: Math.hypot(p[0] - startPoint[0], p[1] - startPoint[1])
        }))
        .sort((a, b) => {
            if (Math.abs(a.angle - b.angle) < 1e-10) {
                return a.dist - b.dist;
            }
            return a.angle - b.angle;
        })
        .map(item => item.point);

    // Graham scan
    const hull = [startPoint];

    for (const p of sorted) {
        while (hull.length >= 2 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
            hull.pop();
        }
        hull.push(p);
    }

    return hull;
}

/**
 * Cross product of vectors OA and OB
 */
function crossProduct(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * Expand a convex hull outward by a given margin
 * @param {Array<Array<number>>} hull - Convex hull points
 * @param {number} margin - Amount to expand
 * @returns {Array<Array<number>>} Expanded hull
 */
function expandHull(hull, margin) {
    if (hull.length < 3) return hull;

    // Calculate centroid
    let cx = 0, cy = 0;
    for (const p of hull) {
        cx += p[0];
        cy += p[1];
    }
    cx /= hull.length;
    cy /= hull.length;

    // Expand each point outward from centroid
    return hull.map(p => {
        const dx = p[0] - cx;
        const dy = p[1] - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.001) return p.slice();

        const scale = (dist + margin) / dist;
        return [
            cx + dx * scale,
            cy + dy * scale
        ];
    });
}

/**
 * Resample points to limit the number of segments
 * @param {Array<Array<number>>} points - Array of [x, y] points
 * @param {number} maxCount - Maximum number of points (segments + 1)
 * @returns {Array<Array<number>>} Simplified points
 */
function simplifyPoints(points, maxCount) {
    if (!points || points.length <= maxCount) return points;

    // Simple resampling by index
    // This preserves start and end points exactly
    const result = [];
    const step = (points.length - 1) / (maxCount - 1);

    for (let i = 0; i < maxCount - 1; i++) {
        const index = Math.round(i * step);
        result.push(points[index]);
    }
    result.push(points[points.length - 1]);

    return result;
}
