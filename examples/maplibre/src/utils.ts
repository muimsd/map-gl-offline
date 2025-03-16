import { area, bboxPolygon, difference } from "@turf/turf";
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

    // console.log('Original Polygon:', JSON.stringify(originalPolygon));
    // console.log('Clipped Polygon:', JSON.stringify(clippedPolygon));

    const clippedPolygonAreaKM = area(clippedPolygon) / 1000;
    setArea(parseFloat(clippedPolygonAreaKM.toFixed(2)));
    // console.log('Clipped Polygon Area:', clippedPolygonAreaKM);

    const leftoverPolygon = difference(featureCollection([originalPolygon, clippedPolygon]));

    if (!leftoverPolygon) {
        console.error('Failed to compute the difference between polygons');
        return;
    }

    // console.log('Leftover Polygon:', JSON.stringify(leftoverPolygon));

    // if (map.current?.getSource('clippedPolygon')) {
    //     (map.current.getSource('clippedPolygon') as GeoJSONSource).setData(clippedPolygon);
    // } else {
    //     map.current?.addSource('clippedPolygon', {
    //         type: 'geojson',
    //         data: clippedPolygon,
    //     });

    //     map.current?.addLayer({
    //         id: 'clippedPolygon',
    //         type: 'fill',
    //         source: 'clippedPolygon',
    //         layout: {},
    //         paint: {
    //             'fill-color': '#088',
    //             'fill-opacity': 0.8,
    //         },
    //     });
    // }

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
