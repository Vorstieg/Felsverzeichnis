import SunCalc from 'suncalc';

// Helper: Calculate general heading of the wall/route
function calculateWallHeading(topo: any, route: any) {
    // 1. Start with the base model rotation (wallAzimuth)
    let heading = topo.wallAzimuth || 0;
    let orientation = route?.orientation;

    // 2. If no specific route orientation, average all route orientations
    if (!orientation && topo.routes?.length > 0) {
        let sumX = 0, sumY = 0, sumZ = 0; // Y is usually up, but summing vectors works
        let count = 0;
        
        for (const r of topo.routes) {
            if (r.orientation) {
                sumX += r.orientation[0];
                sumY += r.orientation[1];
                sumZ += r.orientation[2];
                count++;
            }
        }
        
        if (count > 0) {
            orientation = [sumX / count, sumY / count, sumZ / count];
        }
    }

    // 3. Apply the orientation vector rotation if available
    if (orientation) {
        const [ox, , oz] = orientation;
        // Convert azimuth to radians (CCW rotation for Math functions? No, check formula)
        // Rotation Angle applied to model: theta = -wallAzimuth
        const theta = -(topo.wallAzimuth || 0) * (Math.PI / 180);
        
        // Rotate vector (ox, oz) by theta around Origin (0,0)
        const rx = ox * Math.cos(theta) - oz * Math.sin(theta);
        const rz = ox * Math.sin(theta) + oz * Math.cos(theta);
        
        // Convert result vector to Compass Heading
        // North is -Z (0 deg). East is +X (90 deg).
        // atan2(x, -z) gives angle from North (CW positive)
        const headingRad = Math.atan2(rx, -rz);
        heading = headingRad * (180 / Math.PI);
        
        // Normalize to 0-360
        if (heading < 0) heading += 360;
    }
    
    return heading;
}

export function calculateWallDirection(topo: any, route: any) {
    const heading = calculateWallHeading(topo, route);
    const dirs = ['Nord', 'Nord-Ost', 'Ost', 'Süd-Ost', 'Süd', 'Süd-West', 'West', 'Nord-West'];
    const dirIndex = Math.round(heading / 45) % 8;
    return dirs[dirIndex];
}

export function calculateSunInfo(topo: any, route: any) {
    if (!topo || !topo.coordinates || (topo.coordinates[0] === 0 && topo.coordinates[1] === 0)) {
        return { hours: 'Keine Geodaten', chartData: null };
    }

    const [lng, lat] = topo.coordinates;
    const heading = calculateWallHeading(topo, route);
    const targetAzimuthRad = (heading - 180) * (Math.PI / 180);

    const now = new Date();
    const startOfDay = new Date(now.setHours(6, 0, 0, 0));
    const endOfDay = new Date(now.setHours(21, 0, 0, 0));
    const limit = Math.PI / 2; 
    
    let sunStart = null;
    let sunEnd = null;
    
    // Chart Data Containers
    const labels: string[] = [];
    const altitudes: number[] = [];
    const colors: string[] = [];
    const conditions: string[] = [];
    
    let sunnyIntervals = 0;
    let totalIntervals = 0;

    // Hourly scan for chart
    for (let h = 6; h <= 21; h++) {
        const date = new Date(now);
        date.setHours(h, 0, 0, 0);
        const sunPos = SunCalc.getPosition(date, lat, lng);
        
        let diff = Math.abs(sunPos.azimuth - targetAzimuthRad);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        
        const altDeg = sunPos.altitude * (180 / Math.PI);
        const isUp = altDeg > 5; // Terrain horizon approx
        const isFacing = diff < limit;
        const isInSun = isUp && isFacing;
        
        labels.push(`${h}`);
        altitudes.push(Math.max(0, altDeg));
        
        if (isInSun) {
            colors.push('#fbbf24'); // Sunny Yellow
            conditions.push('Sonne');
            sunnyIntervals++;
        } else if (isUp) {
            colors.push('#9ca3af'); // Shady Gray
            conditions.push('Schatten');
        } else {
            colors.push('#e5e7eb'); // Night/Low Light
            conditions.push('Tiefstehende Sonne');
        }
        totalIntervals++;
    }

    // Detailed scan for text time (15 min)
    for (let t = startOfDay.getTime(); t <= endOfDay.getTime(); t += 15 * 60 * 1000) {
        const date = new Date(t);
        const sunPos = SunCalc.getPosition(date, lat, lng);
        let diff = Math.abs(sunPos.azimuth - targetAzimuthRad);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        
        if (diff < limit && sunPos.altitude > 0.1) {
            if (!sunStart) sunStart = date;
            sunEnd = date;
        }
    }
    
    let hoursStr = "Schatten den ganzen Tag";
    if (sunStart && sunEnd) {
        const format = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        hoursStr = `${format(sunStart)} - ${format(sunEnd)}`;
    }

    return { 
        hours: hoursStr, 
        chartData: { labels, altitudes, colors, conditions }
    };
}

export function calculateSunPositionVector(date: Date, lat: number, lng: number): [number, number, number] {
    const sunPos = SunCalc.getPosition(date, lat, lng);
    
    // SunCalc: Azimuth 0 = South (+Z), increasing values -> West (-X)
    // Three.js (assumed): Y=Up, Z=South, X=East
    const r = 15;
    const phi = Math.PI / 2 - sunPos.altitude; // Zenith angle
    const theta = sunPos.azimuth;
    
    return [
        -r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.cos(theta)
    ];
}

export function calculateBestSeason(topo: any, route: any) {
    if (!topo || !topo.coordinates || (topo.coordinates[0] === 0 && topo.coordinates[1] === 0)) {
        return null;
    }

    const [lng, lat] = topo.coordinates;
    const heading = calculateWallHeading(topo, route);

    // Yearly Temperature Model Approximation based on Latitude and Altitude

    // Mean Temp: 30 - 0.5 * |lat|
    const absLat = Math.abs(lat);
    
    // Model tuned for Daytime Highs (Climbing relevant)
    let yearlyMean = 48 - 0.7 * absLat;
    
    // Altitude Lapse Rate: -6.5 degrees per 1000m
    if (topo.altitude) {
        yearlyMean -= (topo.altitude / 1000) * 6.5;
    }

    // Amplitude (Seasonality strength)
    const yearlyAmp = 5 + 0.2 * absLat;

    const months = [
        'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
        'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
    ];

    const targetAzimuthRad = (heading - 180) * (Math.PI / 180);
    const limit = Math.PI / 2; // +/- 90 degrees for direct sun exposure

    const monthlyTemps = [];
    const feelsLikeTemps = [];
    const labels = [];

    for (let m = 0; m < 12; m++) {
        // Southern Hemisphere months are offset by 6
        let monthOffset = m;
        if (lat < 0) monthOffset = (m + 6) % 12;
        
        // Cosine model: Min Temp in Jan (monthOffset=0), Max Temp in July (monthOffset=6)
        const baseTemp = yearlyMean - yearlyAmp * Math.cos(monthOffset * Math.PI / 6);
        
        // Calculate sun exposure for mid-day (13:00) of the month
        const date = new Date(new Date().getFullYear(), m, 15, 13, 0, 0);
        const sunPos = SunCalc.getPosition(date, lat, lng);
        
        let diff = Math.abs(sunPos.azimuth - targetAzimuthRad);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        
        const altDeg = sunPos.altitude * (180 / Math.PI);
        const isFacing = diff < limit; // Check if wall is facing the sun
        
        let sunBoost = 0;
        // Apply sun boost if wall is facing the sun and sun is above horizon
        if (isFacing && altDeg > 10) {
            // Sun can add 10-15 degrees 'feels like' depending on incidence angle
            const incidence = Math.cos(sunPos.altitude) * Math.cos(diff);
            sunBoost = 15 * Math.max(0, incidence); // Max 15 degree boost
        }
        
        const feelsLike = baseTemp + sunBoost;
        
        monthlyTemps.push(baseTemp);
        feelsLikeTemps.push(feelsLike);
        labels.push(months[m]);
    }
    
    return {
        labels,
        baseTemps: monthlyTemps,
        feelsLikeTemps: feelsLikeTemps,
        lat
    };
}
