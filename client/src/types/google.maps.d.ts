declare namespace google {
  namespace maps {
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class Map {
      constructor(mapDiv: Element, opts?: Record<string, unknown>);
      setCenter(center: LatLngLiteral): void;
      setZoom(zoom: number): void;
    }
  }
}

