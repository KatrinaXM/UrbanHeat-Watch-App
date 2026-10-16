import MapView, { Polygon, UrlTile } from "react-native-maps";
import { StyleSheet, View } from "react-native";
import { absoluteUrl } from "../../lib/cityEnvironment/api";
import { areaRings, PixelReadout, usePixelInspector, type LstMapProps } from "./mapShared";

/**
 * Native map: transparent raster tiles rendered server-side from the georeferenced
 * LST GeoTIFF (not a point-density heat map), plus the city-centre outline.
 */
export default function LstMap({ env }: LstMapProps) {
  const { value, error, inspect } = usePixelInspector(env);
  const delta = (env.area.radiusKm * 2.6) / 111;
  const tiles = env.satellite.tileUrlTemplate;

  return (
    <View>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: env.place.latitude,
          longitude: env.place.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta / Math.max(0.2, Math.cos((env.place.latitude * Math.PI) / 180)),
        }}
        onPress={(e) => inspect(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
        rotateEnabled={false}
        pitchEnabled={false}
        accessibilityLabel="Satellite land-surface temperature map"
      >
        {tiles && <UrlTile urlTemplate={absoluteUrl(tiles)} maximumZ={16} tileSize={256} zIndex={1} />}
        {areaRings(env).map((ring, i) => (
          <Polygon
            key={i}
            coordinates={ring}
            strokeColor="#2B2320"
            strokeWidth={2}
            fillColor="rgba(0,0,0,0)"
            zIndex={2}
            tappable={false}
          />
        ))}
      </MapView>
      <PixelReadout env={env} value={value} error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", height: 320, borderRadius: 10 },
});
