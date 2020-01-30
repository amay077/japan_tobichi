import * as fs from 'fs-extra'
import * as Path from 'path'
import * as shp from 'shpjs';
import * as turf from '@turf/turf';
import { Feature, Polygon } from '@turf/turf';
import * as randomColor from 'randomcolor';
import * as Enumerable from 'linq';

export class TobichiExtractor {
  async exec(): Promise<number> {
    const packageJsonPath = Path.resolve(__dirname, '../package.json');
    const content = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    console.log(`VERSION: ${content.version}`);

    try {
      // Shapefile を読み込み
      const buf = fs.readFileSync(Path.resolve(__dirname, '../assets/polbnda_jpn.zip'));
      const geoJson = await shp(buf);

      const sourceFeatures: Feature[] = geoJson.features
        // .filter(f => f.properties.adm_code.startsWith('01')) // 北海道のみ
        .filter(f => f.properties.pop != -99999999) // UNKNOWN は除外
        .map((f, index) => {
          f.properties._no = index; 
          return f;
        });

      // 市区町村の本体ポリゴンのみのリストと
      // 市区町村のサブポリゴンのみのリストを生成
      // NOTE https://github.com/globalmaps/specifications/blob/master/README.md 
      //      -> gmspec-x.x.pdf -> Boundaries -> Population 
      //      を参考に pop がプラス値は本体のポリゴンと判定。
      const mainFeatures = sourceFeatures.filter(f => f.properties.pop >= 0);
      const subFeatures = sourceFeatures.filter(f => f.properties.pop < 0);

      let i = 0;
      const count = subFeatures.length;
      const tobichiSubFeatures = subFeatures.filter(subF => {
        i++;
        console.log(`${i} / ${count} polygons processing...`);

        // 他のどのポリゴンとも接していないポリゴンは
        // 「島」とみなし除外する
        return sourceFeatures.find(outerF => {
          if (outerF.properties._no === subF.properties._no) {
            return false;
          }
          return !turf.booleanDisjoint(outerF, subF);
        }) != null;
      });

      // Github geojson のためにランダム色を生成
      // NOTE https://help.github.com/en/github/managing-files-in-a-repository/mapping-geojson-files-on-github#styling-features
      const colors = randomColor({
        luminosity: 'dark',
        count: 100
      });

      // １つの市区町村につき複数の飛び地があるかも知れないので、
      // 一旦、 <市区町村コード, [ポリゴン]> の Map にまとめる
      let admCodeFeaturesMap = mainFeatures.reduce((map, mainF) => {
        const tobichs = tobichiSubFeatures.filter(f => f.properties.adm_code === mainF.properties.adm_code);
        if (tobichs.length > 0) {
          map.set(mainF.properties.adm_code, [mainF, ...tobichs]);
        }

        return map;
      }, new Map<string, Feature[]>());

      const tobichiWithMainFeatures = Array.from(admCodeFeaturesMap.values())
      .reduce((pre, features, index) => { 
        // <市区町村コード, [ポリゴン]> をフラットな [ポリゴン] に展開。
        for (const f of features) {
          const color = colors[index % colors.length];

          // GitHub 用のスタイル
          f.properties.fill = color;
          f.properties.stroke = color;
          // 地理院地図用のスタイル
          f.properties._opacity =  1;
          f.properties._weight = 3;
          f.properties._fillOpacity = 0.2;
          f.properties._fillColor = color;
          f.properties._color = color;  

          pre.push(f);
        }

        return pre;
      } , []);

      console.log('Result Tobichis -----');
      i = 1;
      for (const f of tobichiSubFeatures) {
        console.log(`${i}. adm_code:${f.properties.adm_code}, pref:${f.properties.nam}, laa:${f.properties.laa}, pop:${f.properties.pop}`);
        i++;
      }
      console.log(`Found ${tobichiSubFeatures.length} Tobichis -----`);

      this.dumpStatistics(admCodeFeaturesMap, tobichiSubFeatures);

      // 全国の .geojson ファイル出力
      const resultGeoJson = {
        type: "FeatureCollection",
        features: tobichiWithMainFeatures
      };
      fs.writeFileSync(`../out/tobichi_00_all.geojson`, JSON.stringify(resultGeoJson, null, 2));

      // 都道府県ごとの .geojson ファイル出力
      for (let prefCode = 1; prefCode <= 47; prefCode++) {
        const prefCodeStr = String(prefCode).padStart(2, '0');
        const prefFeatures = tobichiWithMainFeatures.filter(f => f.properties.adm_code.startsWith(prefCodeStr));

        if (prefFeatures.length == 0) {
          continue;
        }

        const resultGeoJson = {
          type: "FeatureCollection",
          features: prefFeatures
        };
  
        fs.writeFileSync(`../out/tobichi_${prefCodeStr}.geojson`, JSON.stringify(resultGeoJson, null, 2));
      }

    } catch (error) {
      console.error('shp() error', error);
    }

    return 0;
  }

  private dumpStatistics(admCodeFeaturesMap: Map<string, Feature[]>, tobichiSubFeatures: Feature[]) {
    console.log(`Statistics ---`);

    const tobichiNumPerPref = Enumerable.from(Array.from(admCodeFeaturesMap.entries())).select(([admCode, features]) => {
      return {
        admCode: admCode,
        numSubFeature: features.length - 1
      }
    })
    .groupBy(x => x.admCode.substring(0, 2))
    .select(g =>  ({ pref: g.key(), numSubFeature: g.sum(x => x.numSubFeature)}))
    .orderByDescending(x => x.numSubFeature)
    .toArray();
    console.log(`Tobichi num per pref --`);
    tobichiNumPerPref.forEach((x, index) => {
      console.log(`${index+1}. ${x.pref} - ${x.numSubFeature} tobichis`);
    });

    // 面積最大最小
    const featureWithAreas = Enumerable.from(tobichiSubFeatures).select(f => {
      f.properties.area = turf.area(f);
      return f;
    })
    .orderBy(f => f.properties.area);
    const areaMins = featureWithAreas.take(3);
    const areaMaxs = featureWithAreas.reverse().take(3);
    console.log(`Area-min --`);
    areaMins.toArray().forEach((f, index) => {
      console.log(`${index+1}. ${f.properties.adm_code}/${f.properties.nam}/${f.properties.laa} - ${f.properties.area} ㎡`);
    });
    console.log(`Area-max --`);
    areaMaxs.toArray().forEach((f, index) => {
      console.log(`${index+1}. ${f.properties.adm_code}/${f.properties.nam}/${f.properties.laa} - ${f.properties.area} ㎡`);
    });

    // 飛び地数最多
    const featureWithNumTobichis = Enumerable.from(Array.from(admCodeFeaturesMap.entries())).select(([admCode, features]) => ({
      properties: features[0].properties,
      numSubFeatures: features.length - 1
    }))
    .orderByDescending(x => x.numSubFeatures)
    .take(3);
    console.log(`Num tobichi-max --`);
    featureWithNumTobichis.toArray().forEach((f, index) => {
      console.log(`${index+1}. ${f.properties.adm_code}/${f.properties.nam}/${f.properties.laa} - ${f.numSubFeatures} tobichis`);
    });

    // 本体との距離
    const featureWithDists = Enumerable.from(Array.from(admCodeFeaturesMap.values())).select(features => {
      const mainF = features.find(f => f.properties.pop >= 0);
      const mainCoords = Enumerable.from((mainF.geometry as Polygon).coordinates[0]);

      const distMainToSubMin = Enumerable.from(features)
        .where(f => f.properties.pop < 0)
        .select(f => mainCoords.min(coord => {
          const outer = turf.lineString((f.geometry as Polygon).coordinates[0]);
          const closest = turf.nearestPointOnLine(outer, coord);
          return closest.properties.dist;
        }))
        .min();

      return {
        adm_code: mainF.properties.adm_code,
        nam: mainF.properties.nam,
        laa: mainF.properties.laa,
        dist: distMainToSubMin
      };
    })
    .orderBy(f => f.dist);

    console.log(`Dist-min --`);
    featureWithDists.take(3).toArray().forEach((f, index) => {
      console.log(`${index+1}. ${f.adm_code}/${f.nam}/${f.laa} - ${f.dist} km`);
    });
    console.log(`Dist-max --`);
    featureWithDists.reverse().take(3).toArray().forEach((f, index) => {
      console.log(`${index+1}. ${f.adm_code}/${f.nam}/${f.laa} - ${f.dist} km`);
    });

    // 本体より面積が大きい飛び地
    const featureAreas = Enumerable.from(Array.from(admCodeFeaturesMap.values())).select(features => {
      const mainF = features.find(f => f.properties.pop >= 0);
      const mainArea = turf.area(mainF);

      const subAreas = Enumerable.from(features)
        .where(f => f.properties.pop < 0)
        .select(f => turf.area(f))
        .toArray();

      return {
        adm_code: mainF.properties.adm_code,
        nam: mainF.properties.nam,
        laa: mainF.properties.laa,
        mainArea: mainArea,
        subAreas: subAreas
      }
    })
    .where(x => {
      return x.subAreas.find(subArea => x.mainArea < subArea) != null;
    })
    .toArray();

    console.log(`Sub area greater than main area --`);
    featureAreas.forEach((f, index) => {
      console.log(`${index+1}. ${f.adm_code}/${f.nam}/${f.laa} - ${f.mainArea} ㎡ < ${f.subAreas.join(',')} ㎡`);
    });      
  }
}  