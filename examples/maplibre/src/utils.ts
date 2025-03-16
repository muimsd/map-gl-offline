import { area, bboxPolygon, difference, convertArea } from "@turf/turf";
import { featureCollection, polygon } from "@turf/helpers";
import { Map, GeoJSONSource } from 'maplibre-gl';

export const updatePolygons = (map: React.RefObject<Map | null>, setArea: React.Dispatch<React.SetStateAction<number>>) => {
    const bboxArray = map.current?.getBounds().toArray() as [number, number][];
    if (!bboxArray) return;

    const [minLng, minLat] = bboxArray[0];
    const [maxLng, maxLat] = bboxArray[1];

    const lngDiff = (maxLng - minLng) * 0.1;
    const latDiff = (maxLat - minLat) * 0.1;

    const clippedBbox = [
        minLng + lngDiff, minLat + latDiff,
        maxLng - lngDiff, maxLat - latDiff
    ];

    const clippedPolygon = bboxPolygon([
        clippedBbox[0], clippedBbox[1],
        clippedBbox[2], clippedBbox[3]
    ]);

    const originalPolygon = polygon([[
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat]
    ]]);

    const clippedPolygonAreaM2 = area(clippedPolygon);
    const clippedPolygonAreaKM2 = convertArea(clippedPolygonAreaM2, 'meters', 'kilometers');
    setArea(parseFloat(clippedPolygonAreaKM2.toFixed(2)));

    const leftoverPolygon = difference(featureCollection([originalPolygon, clippedPolygon]));

    if (!leftoverPolygon) {
        console.error('Failed to compute the difference between polygons');
        return;
    }

    if (map.current?.getSource('leftoverPolygon')) {
        (map.current.getSource('leftoverPolygon') as GeoJSONSource).setData(leftoverPolygon);
    } else {
        map.current?.addSource('leftoverPolygon', {
            type: 'geojson',
            data: leftoverPolygon,
        });

        map.current?.addLayer({
            id: 'leftoverPolygon',
            type: 'fill',
            source: 'leftoverPolygon',
            layout: {},
            paint: {
                'fill-color': '#000000',
                'fill-opacity': 0.7,
            },
        });
    }

    console.log('Sources and layers updated');
};
