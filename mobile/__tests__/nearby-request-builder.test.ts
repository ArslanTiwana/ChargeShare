import {
  calculateRadiusFromRegion,
  buildNearbyRequest,
  debounce,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  DEFAULT_RADIUS_KM,
} from '../src/utils/nearby-request';

describe('Nearby Request Builder & Radius Calculation', () => {
  describe('calculateRadiusFromRegion', () => {
    it('calculates radius based on latitudeDelta (~111 km per degree / 2)', () => {
      // 0.1 degree latitude delta -> ~11.1 km visible height -> ~5.55 km radius -> rounds to 5.6 km
      const radius = calculateRadiusFromRegion({
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
      expect(radius).toBe(5.6);
    });

    it('caps radius at MAX_RADIUS_KM (50 km) when zoomed out far', () => {
      // 2.0 degrees latitude delta -> ~111 km radius, should cap at 50
      const radius = calculateRadiusFromRegion({
        latitudeDelta: 2.0,
        longitudeDelta: 2.0,
      });
      expect(radius).toBe(MAX_RADIUS_KM);
    });

    it('clamps radius to MIN_RADIUS_KM (1 km) when zoomed in very close', () => {
      // 0.005 degrees latitude delta -> ~0.28 km radius, should clamp to 1 km
      const radius = calculateRadiusFromRegion({
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      expect(radius).toBe(MIN_RADIUS_KM);
    });

    it('returns DEFAULT_RADIUS_KM when region is invalid or negative', () => {
      expect(calculateRadiusFromRegion({ latitudeDelta: 0 })).toBe(DEFAULT_RADIUS_KM);
      expect(calculateRadiusFromRegion({ latitudeDelta: -1 })).toBe(DEFAULT_RADIUS_KM);
      expect(calculateRadiusFromRegion(null as any)).toBe(DEFAULT_RADIUS_KM);
    });
  });

  describe('buildNearbyRequest', () => {
    it('builds request params with region-derived radius', () => {
      const params = buildNearbyRequest({
        lat: 33.68442,
        lng: 73.04791,
        region: { latitudeDelta: 0.2 },
        fastOnly: true,
        connectorType: 'TYPE2',
      });

      expect(params.lat).toBe(33.68442);
      expect(params.lng).toBe(73.04791);
      expect(params.radiusKm).toBe(11.1);
      expect(params.fastOnly).toBe(true);
      expect(params.connectorType).toBe('TYPE2');
      expect(params.limit).toBe(50);
    });

    it('caps explicit radiusKm at 50 km', () => {
      const params = buildNearbyRequest({
        lat: 33.6844,
        lng: 73.0479,
        radiusKm: 150, // exceeds max
      });

      expect(params.radiusKm).toBe(50);
    });

    it('caps limit at 50', () => {
      const params = buildNearbyRequest({
        lat: 33.6844,
        lng: 73.0479,
        limit: 200,
      });

      expect(params.limit).toBe(50);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('debounces multiple calls within wait window', () => {
      const mockFn = jest.fn();
      const debounced = debounce(mockFn, 300);

      debounced('call1');
      debounced('call2');
      debounced('call3');

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(299);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call3');
    });

    it('supports cancellation of pending debounce calls', () => {
      const mockFn = jest.fn();
      const debounced = debounce(mockFn, 300);

      debounced('test');
      debounced.cancel();

      jest.advanceTimersByTime(500);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
});
