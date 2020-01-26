import * as fs from 'fs-extra'
import * as Path from 'path'
import * as shp from 'shpjs';
import * as turf from '@turf/turf';
import { Position, Polygon, Feature, Geometry } from '@turf/turf';
import * as randomColor from 'randomcolor';

export class CommandVersion {
  async exec(): Promise<number> {
    const packageJsonPath = Path.resolve(__dirname, '../package.json');
    const content = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    console.log(`VERSION: ${content.version}`);

    try {
      const shpPath = Path.resolve(__dirname, '../assets/polbnda_jpn.zip');

      const buf = fs.readFileSync(shpPath);
      const geoJson = await shp(buf);

      const targetFeatures: Feature[] = geoJson.features
        // .filter(f => f.properties.adm_code === '19364' || f.properties.adm_code === '19365');
        // .filter(f => f.properties.adm_code.startsWith('4'))
        ;

      const mainFeatures = targetFeatures.filter(f => f.properties.pop >= 0);
      const subFeatures = targetFeatures.filter(f => f.properties.pop < 0);

      let i = 0;
      const count = subFeatures.length;
      const tobichiFeatures = subFeatures.filter(subF => {
        i++;
        console.log(`${i} / ${count} polygons processing...`);
        return mainFeatures.find(outerF => {
          return !turf.booleanDisjoint(outerF, subF);
        });
      });

      console.log('Tobichis -----');
      i = 1;
      for (const f of tobichiFeatures) {
        console.log(`${i}. adm_code:${f.properties.adm_code}, pref:${f.properties.nam}, laa:${f.properties.laa}, pop:${f.properties.pop}`);
        i++;
      }

      const colors = randomColor({
        luminosity: 'dark',
        count: 100
      });

      const tobichiMultiPolygonFeatures = Array.from(tobichiFeatures.reduce((pre, cur) => {
        const arr = pre.get(cur.properties.adm_code);
        if (arr != null) {
          pre.set(cur.properties.adm_code, [...arr, cur]);
        } else {
          const mainF = mainFeatures.find(f => f.properties.adm_code === cur.properties.adm_code);
          pre.set(cur.properties.adm_code, [mainF, cur]);
        }

        return pre;
      }, new Map<string, Feature[]>()).values())
      .map((features, index) => {
        const mainF = features.find(f => f.properties.pop >= 0);

        const multiCoordinates = features.map(f => (f.geometry as Geometry).coordinates) as Position[][][];
        const multiPolygonF = turf.multiPolygon(multiCoordinates, mainF.properties);
       
        const color = colors[index % colors.length];
        multiPolygonF.properties.fill = color;
        multiPolygonF.properties.stroke = color;

        return multiPolygonF;
      });

      const resultGeoJson = {
        type: "FeatureCollection",
        features: tobichiMultiPolygonFeatures
      };

      fs.writeFileSync('../out/tobichi_all.geojson', JSON.stringify(resultGeoJson, null, 2));

    } catch (error) {
      console.error('shp() error', error);
    }

    return 0;
  }
}  