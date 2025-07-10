const {
  generateRoomCode,
  shuffleArray,
  generateUUID,
  deepClone,
  isValidRoomName,
  isValidPlayerName,
  getCurrentTimestamp,
  formatTimestamp,
  debounce,
  throttle,
  arraysEqual,
  getRandomElement,
  getRandomNumber,
  isEmpty,
  deepMerge
} = require('../src/utils');

describe('Utility Functions Tests', () => {
  describe('generateRoomCode', () => {
    test('should generate 4-character uppercase string', () => {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
    });

    test('should generate different codes on multiple calls', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateRoomCode());
      }
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('shuffleArray', () => {
    test('should return array with same elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    test('should not modify original array', () => {
      const original = [1, 2, 3, 4, 5];
      const originalCopy = [...original];
      shuffleArray(original);
      expect(original).toEqual(originalCopy);
    });

    test('should handle empty array', () => {
      const original = [];
      const shuffled = shuffleArray(original);
      expect(shuffled).toEqual([]);
    });
  });

  describe('generateUUID', () => {
    test('should generate valid UUID v4 format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('should generate different UUIDs', () => {
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe('deepClone', () => {
    test('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('test')).toBe('test');
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    test('should clone objects deeply', () => {
      const original = { a: 1, b: { c: 2, d: [3, 4] } };
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
    });

    test('should clone arrays', () => {
      const original = [1, 2, { a: 3 }];
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[2]).not.toBe(original[2]);
    });

    test('should clone dates', () => {
      const original = new Date();
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });
  });

  describe('isValidRoomName', () => {
    test('should validate valid room names', () => {
      expect(isValidRoomName('Test Room')).toBe(true);
      expect(isValidRoomName('A')).toBe(true);
      expect(isValidRoomName('A'.repeat(20))).toBe(true);
    });

    test('should reject invalid room names', () => {
      expect(isValidRoomName('')).toBe(false);
      expect(isValidRoomName('   ')).toBe(false);
      expect(isValidRoomName(null)).toBe(false);
      expect(isValidRoomName(undefined)).toBe(false);
      expect(isValidRoomName('A'.repeat(21))).toBe(false);
    });
  });

  describe('isValidPlayerName', () => {
    test('should validate valid player names', () => {
      expect(isValidPlayerName('Player 1')).toBe(true);
      expect(isValidPlayerName('A')).toBe(true);
      expect(isValidPlayerName('A'.repeat(15))).toBe(true);
    });

    test('should reject invalid player names', () => {
      expect(isValidPlayerName('')).toBe(false);
      expect(isValidPlayerName('   ')).toBe(false);
      expect(isValidPlayerName(null)).toBe(false);
      expect(isValidPlayerName(undefined)).toBe(false);
      expect(isValidPlayerName('A'.repeat(16))).toBe(false);
    });
  });

  describe('getCurrentTimestamp', () => {
    test('should return current timestamp', () => {
      const before = Date.now();
      const timestamp = getCurrentTimestamp();
      const after = Date.now();
      
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('formatTimestamp', () => {
    test('should format timestamp correctly', () => {
      const timestamp = Date.now();
      const formatted = formatTimestamp(timestamp);
      
      expect(typeof formatted).toBe('string');
      expect(formatted).toMatch(/^\d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('debounce', () => {
    test('should debounce function calls', (done) => {
      let callCount = 0;
      const debouncedFn = debounce(() => {
        callCount++;
      }, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 150);
    });
  });

  describe('throttle', () => {
    test('should throttle function calls', (done) => {
      let callCount = 0;
      const throttledFn = throttle(() => {
        callCount++;
      }, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 50);
    });
  });

  describe('arraysEqual', () => {
    test('should return true for equal arrays', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(arraysEqual([3, 2, 1], [1, 2, 3])).toBe(true);
      expect(arraysEqual([], [])).toBe(true);
    });

    test('should return false for different arrays', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(arraysEqual([1, 2, 3], [1, 2])).toBe(false);
      expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    });
  });

  describe('getRandomElement', () => {
    test('should return element from array', () => {
      const array = [1, 2, 3, 4, 5];
      const element = getRandomElement(array);
      expect(array).toContain(element);
    });

    test('should handle empty array', () => {
      const element = getRandomElement([]);
      expect(element).toBeUndefined();
    });
  });

  describe('getRandomNumber', () => {
    test('should return number within range', () => {
      const min = 1;
      const max = 10;
      const number = getRandomNumber(min, max);
      
      expect(number).toBeGreaterThanOrEqual(min);
      expect(number).toBeLessThanOrEqual(max);
      expect(Number.isInteger(number)).toBe(true);
    });

    test('should handle same min and max', () => {
      const number = getRandomNumber(5, 5);
      expect(number).toBe(5);
    });
  });

  describe('isEmpty', () => {
    test('should return true for empty objects', () => {
      expect(isEmpty({})).toBe(true);
    });

    test('should return false for non-empty objects', () => {
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty({ a: 1, b: 2 })).toBe(false);
    });

    test('should handle non-objects', () => {
      expect(isEmpty(null)).toBe(false);
      expect(isEmpty(undefined)).toBe(false);
      expect(isEmpty([])).toBe(false);
      expect(isEmpty('string')).toBe(false);
    });
  });

  describe('deepMerge', () => {
    test('should merge objects deeply', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { d: 3 }, e: 4 };
      const result = deepMerge(target, source);
      
      expect(result).toEqual({
        a: 1,
        b: { c: 2, d: 3 },
        e: 4
      });
    });

    test('should not modify original objects', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { d: 3 } };
      const targetCopy = JSON.parse(JSON.stringify(target));
      const sourceCopy = JSON.parse(JSON.stringify(source));
      
      deepMerge(target, source);
      
      expect(target).toEqual(targetCopy);
      expect(source).toEqual(sourceCopy);
    });

    test('should handle nested arrays', () => {
      const target = { a: [1, 2], b: { c: [3, 4] } };
      const source = { a: [5], b: { c: [6] } };
      const result = deepMerge(target, source);
      
      expect(result).toEqual({
        a: [5],
        b: { c: [6] }
      });
    });
  });
}); 